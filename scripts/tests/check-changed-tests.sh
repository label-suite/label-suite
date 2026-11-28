#!/usr/bin/env bash
# Tests for scripts/check-changed.sh (issue #111, task 3.4).
#
# One checker serves a reminder trigger (H3) and two blocking ones (H4, H7),
# so the same verdict has to come out encoded two different ways. Most of this
# file is about that: the route table and the exclusions are shared, and the
# mode decides only how an undecidable situation is reported.
#
# `--staged` acquires its file list in task 4.1. Here it must refuse rather
# than quietly pass, and there is an assertion that says so.
set -uo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
CHECKER="$ROOT/scripts/check-changed.sh"
. "$ROOT/scripts/tests/lib/hook-harness.sh"

failures=0
fail() { echo "FAIL: $*"; failures=$((failures + 1)); }

harness_setup
REPO="$HARNESS_REPO"
git -C "$REPO" config user.email t@example.com
git -C "$REPO" config user.name Test

TMP=$(mktemp -d "${TMPDIR:-/tmp}/check-changed-tests.XXXXXX")
trap 'rm -rf "$TMP"; harness_teardown' EXIT

seed() { # seed <relative-path> [content]
  mkdir -p "$REPO/$(dirname "$1")"
  printf '%s\n' "${2-x}" > "$REPO/$1"
}
commit_all() { git -C "$REPO" add -A >/dev/null; git -C "$REPO" commit -qm "$1"; }

seed README.md hello
commit_all seed

files() { ( cd "$REPO" && "$CHECKER" --files "$@" >"$TMP/out" 2>"$TMP/err" ); echo $?; }

# ── The route table, and what "enabled" means ────────────────────────

seed app.py 'print(1)'
rc=$(files app.py)
[ "$rc" = "0" ] || fail "a .py change with no backend/ did not exit 0 (got $rc)"
grep -q '^NA:' "$TMP/err" || fail "a .py change with no backend/ was not marked NA"
[ -z "$(harness_calls)" ] || fail "a tool ran even though backend/ does not exist"

mkdir -p "$REPO/backend/app"
# The project file, because the tools run from backend/ and ruff resolves
# `per-file-ignores` against that directory: a fixture without it would let the
# mirror assertion below pass on a repository that never had one.
seed backend/pyproject.toml '[tool.ruff]
line-length = 100
'
# Two fixtures: one inside the application package, because that is the only
# scope `mypy --strict` covers, and one outside it, which the later cases use.
seed backend/app.py 'print(1)'
seed backend/app/x.py 'print(1)'
harness_reset_calls
rc=$(files backend/app/x.py)
# Neither tool is on PATH in this repository -- `uv sync` installs them into
# `backend/.venv` -- so both are reached through the project runner, and the
# runner is what a test can watch.
harness_calls | grep -q 'uv run .* ruff check' || fail "ruff did not run once backend/ exists"
harness_calls | grep -q 'uv run .* mypy --strict' || fail "mypy did not run once backend/ exists"
harness_calls | grep -q -- '--fix' && fail "a tool was invoked in a mode that rewrites files"
harness_calls | grep -q -- '--no-sync' \
  || fail "the runner was allowed to provision an environment during a hook"

# ruff resolves `per-file-ignores` against its working directory, so the tools
# must run from `backend/` and be named the files relative to it. An absolute
# path, or a path carrying the `backend/` prefix, silently drops this project's
# per-file exemptions.
harness_calls | grep -q 'uv run --directory [^ ]*/backend --project [^ ]*/backend ' \
  || fail "the tools were not run from backend/: $(harness_calls | head -1)"
harness_calls | grep -q 'ruff check -- app/x.py' \
  || fail "the file was not named relative to backend/: $(harness_calls | head -1)"

# The two tools have different scopes, and `openspec/config.yaml` settles them:
# `ruff check .` is all of backend/, `mypy --strict app` is the app package. A
# change confined to backend/tests/ gets ruff and an explicit NA for mypy, not
# `--strict` over code this repository has never type-checked.
mkdir -p "$REPO/backend/tests"
seed backend/tests/test_x.py 'print(1)'
harness_reset_calls
rc=$(files backend/tests/test_x.py)
[ "$rc" = "0" ] || fail "a tests-only Python change did not exit 0 (got $rc)"
harness_calls | grep -q 'uv run .* ruff check' || fail "ruff did not run on a tests-only change"
harness_calls | grep -q 'mypy' && fail "mypy --strict ran outside the app package"
grep -q '^NA:.*mypy --strict' "$TMP/err" \
  || fail "mypy being out of scope was not reported: $(grep -E '^(NA|FAIL)' "$TMP/err" | head -2)"

# The discriminating case is a change that touches both: ruff must see both
# files and mypy must see only the one inside the package. A tests-only change
# cannot tell the scope split apart from the guard in front of it.
harness_reset_calls
rc=$( ( cd "$REPO" && "$CHECKER" --files backend/app/x.py backend/tests/test_x.py >"$TMP/out" 2>"$TMP/err" ); echo $? )
[ "$rc" = "0" ] || fail "a mixed Python change did not exit 0 (got $rc)"
harness_calls | grep -q 'ruff check -- app/x.py tests/test_x.py' \
  || fail "ruff did not see both files: $(harness_calls | grep ruff | head -1)"
harness_calls | grep -q 'mypy --strict -- app/x.py$' \
  || fail "mypy saw something outside the app package: $(harness_calls | grep mypy | head -1)"

# An enabled layer whose runner is missing is an explicit failure, not NA.
harness_reset_calls
# node must stay reachable here, or this measures the node guard instead of the
# missing-runner verdict -- but keeping node's whole directory on PATH is not a
# way to drop `uv`, because on this machine they are installed side by side and
# that is exactly how an earlier version of this test passed while measuring
# nothing. A directory holding node alone is what makes the runner absent.
# git has to be there too: Git for Windows keeps git.exe outside /usr/bin, so
# without it this measured "cannot locate the repository" instead (#830).
# Wrappers, not symlinks: Git Bash's `ln -s` makes a copy, and a copied
# `node` with no `.exe` is not something it will run.
NODE_ONLY="$TMP/node-only"; mkdir -p "$NODE_ONLY"
for tool in node git; do
  printf '#!/bin/sh\nexec "%s" "$@"\n' "$(command -v "$tool")" > "$NODE_ONLY/$tool"
  chmod +x "$NODE_ONLY/$tool"
done
command -v uv >/dev/null 2>&1 && PATH="$NODE_ONLY:/usr/bin:/bin" command -v uv >/dev/null 2>&1 \
  && fail "the stripped PATH still reaches uv, so this case measures nothing"
rc=$( ( cd "$REPO" && PATH="$NODE_ONLY:/usr/bin:/bin" "$CHECKER" --files backend/app/x.py >"$TMP/out" 2>"$TMP/err" ); echo $? )
[ "$rc" = "0" ] && fail "a missing runner for an enabled layer reported as passing"
grep -q 'uv' "$TMP/err" || fail "the failure did not name what was missing"
grep -q '^NA:' "$TMP/err" && fail "a missing runner for an enabled layer was marked NA"

# docs routes are always on, because their checker is already in the repo.
seed docs/specs/x.mdx '# x'
rc=$(files docs/specs/x.mdx)
grep -q 'check-specs' "$TMP/err" || fail "an .mdx change did not route to check-specs"
seed docs/development/y.md '# y'
rc=$(files docs/development/y.md)
grep -q 'check-specs' "$TMP/err" || fail "a .md change did not route to check-specs"

# Nothing matched is not applicable, not a failure.
seed notes.txt hello
rc=$(files notes.txt)
[ "$rc" = "0" ] || fail "an unrouted file did not exit 0 (got $rc)"
grep -q '^NA:' "$TMP/err" || fail "an unrouted file was not marked NA"

# ── The TypeScript route, which is the Python route's shape ──────────
#
# Same reasoning as above and the same two reasons a test has to watch the
# runner: `tsc` and `eslint` are not on PATH either, and eslint resolves its
# flat config from the working directory. `tsc -b` takes no file arguments on
# purpose -- a file compiled on its own sees none of the project's settings --
# while eslint takes the changed files, named relative to `frontend/`.
mkdir -p "$REPO/frontend/src"
seed frontend/package.json '{"name":"frontend"}'
seed frontend/src/a.ts 'export const a = 1;'
harness_reset_calls
rc=$(files frontend/src/a.ts)
[ "$rc" = "0" ] || fail "a .ts change with frontend/ present did not exit 0 (got $rc)"
harness_calls | grep -q 'pnpm -C [^ ]*/frontend exec tsc -b' \
  || fail "tsc was not reached through the project runner: $(harness_calls | head -1)"
harness_calls | grep -q 'pnpm -C [^ ]*/frontend exec eslint -- src/a.ts' \
  || fail "eslint did not get the file relative to frontend/: $(harness_calls | head -2)"
harness_calls | grep -qE 'tsc -b [^ ]' \
  && fail "tsc -b was given file arguments, which drops the project's settings"
harness_calls | grep -q -- '--fix' && fail "eslint was invoked in a mode that rewrites files"
# The component reuse check rides on the same route and needs node only.
grep -q 'PASS: node scripts/check-component-reuse.mjs' "$TMP/err" \
  || fail "a .ts change did not run the component reuse check: $(cat "$TMP/err")"

# An enabled layer whose runner is missing is an explicit failure, not NA.
harness_reset_calls
rc=$( ( cd "$REPO" && PATH="$NODE_ONLY:/usr/bin:/bin" "$CHECKER" --files frontend/src/a.ts >"$TMP/out" 2>"$TMP/err" ); echo $? )
[ "$rc" = "0" ] && fail "a missing frontend runner reported as passing"
grep -q 'pnpm' "$TMP/err" || fail "the failure did not name what was missing"
grep -q '^NA:' "$TMP/err" && fail "a missing frontend runner was marked NA"

# ── The code routes are scoped to their projects ─────────────────────
#
# ruff/mypy and tsc/eslint take their configuration from backend/ and
# frontend/. A .py or .ts elsewhere is outside both projects: NA with the
# reason, never handed to a tool, never a failure.
for outside in .semgrep/tests/x.py e2e/a.ts .notecraft/components/x.tsx; do
  seed "$outside" 'x'
  harness_reset_calls
  rc=$(files "$outside")
  [ "$rc" = "0" ] || fail "a code file outside its project did not exit 0: $outside (got $rc)"
  [ -n "$(harness_calls)" ] && fail "a code file outside its project reached a tool: $outside"
  grep -qF "NA: $outside 不在 backend/ 或 frontend/ 專案內" "$TMP/err" \
    || fail "a code file outside its project was not marked NA with the reason: $outside: $(head -1 "$TMP/err")"
  grep -q '^FAIL' "$TMP/err" && fail "a code file outside its project was reported as a failure: $outside"
done
seed backend/app/scoped.py 'print(1)'
harness_reset_calls
rc=$(files backend/app/scoped.py)
harness_calls | grep -q 'ruff check -- app/scoped.py' || fail "backend/app/x.py was no longer routed to ruff"
seed frontend/src/scoped.tsx 'export const a = 1;'
harness_reset_calls
rc=$(files frontend/src/scoped.tsx)
harness_calls | grep -q 'eslint -- src/scoped.tsx' || fail "frontend/src/x.tsx was no longer routed to eslint"
rm -f "$REPO/.semgrep/tests/x.py" "$REPO/e2e/a.ts" "$REPO/.notecraft/components/x.tsx" \
      "$REPO/backend/app/scoped.py" "$REPO/frontend/src/scoped.tsx"

# ── The exclusions, applied before routing ───────────────────────────

for excluded in \
  frontend/src/api/generated/client.ts \
  backend/alembic/versions/0001_init.py \
  pnpm-lock.yaml \
  vendor/thing/lib.py \
  node_modules/pkg/index.ts
do
  seed "$excluded" 'x'
  harness_reset_calls
  rc=$(files "$excluded")
  [ "$rc" = "0" ] || fail "an excluded path did not exit 0: $excluded (got $rc)"
  [ -n "$(harness_calls)" ] && fail "an excluded path still ran a tool: $excluded"
done

# A path the change removed is skipped, not an error.
harness_reset_calls
rc=$(files backend/gone.py)
[ "$rc" = "0" ] || fail "a path that no longer exists did not exit 0 (got $rc)"
[ -n "$(harness_calls)" ] && fail "a tool ran against a path that no longer exists"

# A path outside the workspace is skipped, and says why.
rc=$(files /tmp/outside.py)
[ "$rc" = "0" ] || fail "a path outside the workspace did not exit 0 (got $rc)"
grep -q 'workspace' "$TMP/err" || fail "the skipped outside path did not print a reason"

# ── It must not touch the working tree ───────────────────────────────

seed backend/dirty.py 'print(2)'
before=$(git -C "$REPO" status --porcelain)
before_staged=$(git -C "$REPO" diff --cached --name-only)
files backend/dirty.py >/dev/null
[ "$(git -C "$REPO" status --porcelain)" = "$before" ] || fail "the working tree changed"
[ "$(git -C "$REPO" diff --cached --name-only)" = "$before_staged" ] || fail "something was staged"

# ── The same verdict, encoded per mode ───────────────────────────────

# H3 reports and never blocks, including when the check genuinely fails. This
# is the requirement, not an edge case: the gate is H4, H5 and H7.
harness_set_tool uv 1 'app.py:1:1 E999 invalid syntax'
harness_reset_calls
rc=$(printf '{"cwd":"%s","hook_event_name":"PostToolUse","tool_name":"Write","tool_input":{"file_path":"%s/backend/app.py"}}' "$REPO" "$REPO" \
     | ( cd "$REPO" && "$CHECKER" --event PostToolUse >"$TMP/out" 2>"$TMP/err" ); echo $?)
[ "$rc" = "0" ] || fail "H3 blocked on a failing check (got $rc)"
grep -q '^FAIL: ruff check' "$TMP/err" || fail "H3 did not report the failing check"
grep -q 'E999' "$TMP/err" || fail "H3 swallowed the tool's own diagnostic"
[ -s "$REPO/backend/app.py" ] || fail "H3 touched the file it was reporting on"

# The same failure in a blocking mode is encoded as a non-zero exit.
rc=$(files backend/app.py)
[ "$rc" = "1" ] || fail "a blocking mode did not encode the violation as 1 (got $rc)"
harness_set_tool uv 0 ''

# bash is invoked by absolute path rather than found through the stripped
# PATH: on Git Bash `ln -s` copies bash.exe away from the msys-2.0.dll it
# needs, so the copy exits 127 before the checker runs (#830). The symlink
# stays for POSIX, where the checker may still look bash up by name.
BASH_BIN=$(command -v bash)
mkdir -p "$TMP/onlybash" && ln -sf "$(command -v bash)" "$TMP/onlybash/bash"
undecidable() { # undecidable <mode-args...> -> exit code
  ( cd "$REPO" && PATH="$TMP/onlybash" "$BASH_BIN" "$CHECKER" "$@" >"$TMP/out" 2>"$TMP/err" ); echo $?
}

rc=$(printf '{"cwd":"%s","hook_event_name":"PostToolUse","tool_name":"Write","tool_input":{"file_path":"%s/backend/app.py"}}' "$REPO" "$REPO" \
     | ( cd "$REPO" && PATH="$TMP/onlybash" "$BASH_BIN" "$CHECKER" --event PostToolUse >"$TMP/out" 2>"$TMP/err" ); echo $?)
[ "$rc" = "0" ] || fail "--event did not stay out of the way when it could not decide (got $rc)"
grep -q '^UNKNOWN:' "$TMP/err" || fail "--event did not name the item it could not decide"

# #830: a reader that exits 0 and returns no records stands in for every way
# the reader can fail to run (on Windows its entry-point test never matched).
# The checker must not fall back to its own directory for a cwd nobody sent.
# H3 is a reminder, so the cost is UNKNOWN and exit 0, not a block.
STUB="$TMP/stub-reader/scripts"
mkdir -p "$STUB" && cp -R "$ROOT/scripts/lib" "$STUB/" && cp "$ROOT/scripts/check-changed.sh" "$STUB/"
printf 'process.exitCode = 0;\n' > "$STUB/lib/hook-payload.mjs"
rc=$(printf '{"cwd":"%s","hook_event_name":"PostToolUse","tool_name":"Write","tool_input":{"file_path":"%s/backend/app.py"}}' "$REPO" "$REPO" \
     | ( cd "$REPO" && bash "$STUB/check-changed.sh" --event PostToolUse >/dev/null 2>"$TMP/err" ); echo $?)
[ "$rc" = "0" ] || fail "#830: --event blocked when the reader returned no records (got $rc)"
grep -q '^UNKNOWN:.*cwd' "$TMP/err" || fail "#830: --event did not report the missing cwd as undecided: $(head -1 "$TMP/err")"

for mode in "--files backend/app.py" "--range HEAD~1..HEAD" "--list-routes"; do
  rc=$(undecidable $mode)
  [ "$rc" = "2" ] || fail "a blocking mode did not fail closed: $mode (got $rc)"
done

# ── --staged judges the index, not the working tree ──────────────────
#
# The whole point of the pre-commit trigger is that what gets committed is
# what gets judged. A file fixed in the working tree but not staged must
# still be refused, or the hook passes on content nobody is committing.

staged() { ( cd "${2:-$REPO}" && "$CHECKER" --staged >"$TMP/out" 2>"$TMP/err" ); echo $?; }

git -C "$REPO" add -A >/dev/null; git -C "$REPO" commit -qm "before staged cases"
harness_set_tool uv 0 ''

seed backend/staged.py 'print(1)'
git -C "$REPO" add backend/staged.py >/dev/null
harness_reset_calls
rc=$(staged)
[ "$rc" = "0" ] || fail "a clean staged change was refused (got $rc)"
harness_calls | grep -q 'uv run .* ruff check' || fail "--staged did not route the staged file to its tool"
# Under --staged the tools run from the mirror's backend/, and the mirror has to
# carry the whole index, not only the changed files: ruff needs
# `backend/pyproject.toml` beside it or `per-file-ignores` stops matching, and
# `mypy --strict` needs the package tree or every `app.*` import in a staged
# test reads as unresolvable. Measured against the real toolchain before this
# assertion existed: 12 such errors on files the change never touched.
harness_calls | grep -q 'uv cwd .*/backend pyproject=yes app=yes' \
  || fail "the mirror did not carry the project beside the staged file: $(harness_calls | grep 'uv cwd' | head -1)"

# The tool must see the staged bytes, not whatever the working tree holds.
# The harness logs the first line of every file it is handed, so this asserts
# on the content rather than on the path, which is identical either way.
seed backend/staged.py 'print(2)   # fixed here but never staged'
harness_set_tool uv 1 'staged.py:1:1 E999 the staged version is broken'
harness_reset_calls
rc=$(staged)
[ "$rc" = "1" ] || fail "a fix left unstaged was treated as if it counted (got $rc)"
grep -q 'E999' "$TMP/err" || fail "--staged did not report the tool output"
harness_calls | grep -q 'uv saw .*<<print(1)' \
  || fail "the tool was handed the working-tree copy, not the staged one"
harness_calls | grep -q 'never staged' \
  && fail "the working-tree copy reached the tool"
harness_set_tool uv 0 ''

# The sharpest discriminator: stage a file, then delete it from the working
# tree without staging the deletion. Only a checker reading the index can see
# it at all; one reading the working tree finds nothing and skips it.
seed backend/only-in-index.py 'print("lives in the index only")'
git -C "$REPO" add backend/only-in-index.py >/dev/null
rm -f "$REPO/backend/only-in-index.py"
harness_reset_calls
rc=$(staged)
harness_calls | grep -q 'only-in-index.py' \
  || fail "--staged skipped a file that exists only in the index; it is reading the working tree"
[ "$rc" = "0" ] || fail "a file staged then removed from the working tree was not judged cleanly (got $rc)"
git -C "$REPO" checkout -- backend/only-in-index.py 2>/dev/null || git -C "$REPO" reset -q backend/only-in-index.py

# A staged deletion is not a file to check. Without the ACMR filter it would
# arrive in the list and the attempt to read it out of the index would turn
# the whole commit into an undecidable refusal.
seed backend/doomed.py 'print("about to go")'
git -C "$REPO" add -A >/dev/null; git -C "$REPO" commit -qm "add the file to delete"
git -C "$REPO" rm -q backend/doomed.py
harness_reset_calls
rc=$(staged)
[ "$rc" = "0" ] || fail "a staged deletion was not skipped (got $rc)"
harness_calls | grep -q 'doomed.py' && fail "a staged deletion was handed to a tool"
git -C "$REPO" reset -q --hard HEAD >/dev/null

# Partially staged: only the staged hunk counts.
seed backend/partial.py 'print("staged")'
git -C "$REPO" add backend/partial.py >/dev/null
seed backend/partial.py 'print("working tree only")'
rc=$(staged)
[ "$rc" = "0" ] || fail "a partially staged file judged the working tree copy (got $rc)"

# Run from a subdirectory: the whole staged list is still covered.
mkdir -p "$REPO/backend/deep"
seed backend/deep/sub.py 'print(3)'
git -C "$REPO" add -A >/dev/null
harness_reset_calls
rc=$(staged 0 "$REPO/backend/deep")
[ "$rc" = "0" ] || fail "--staged from a subdirectory failed (got $rc)"
harness_calls | grep -q 'sub.py' || fail "--staged from a subdirectory missed the staged file"

# Paths with spaces and CJK survive the NUL-separated list.
seed 'backend/有 空白 的檔名.py' 'print(4)'
git -C "$REPO" add -A >/dev/null
harness_reset_calls
rc=$(staged)
[ "$rc" = "0" ] || fail "a path with spaces and CJK broke --staged (got $rc)"
harness_calls | grep -q '空白' || fail "the CJK path never reached the tool"

# The mirror is a temporary directory per run; leaving it behind would litter
# one per commit.
mirrors_before=$(ls -1d "${TMPDIR:-/tmp}"/check-changed-index.* 2>/dev/null | wc -l | tr -d ' ')
staged >/dev/null
mirrors_after=$(ls -1d "${TMPDIR:-/tmp}"/check-changed-index.* 2>/dev/null | wc -l | tr -d ' ')
[ "$mirrors_after" = "$mirrors_before" ] || fail "--staged left its index mirror behind"

# Nothing it does may touch the working tree or the index.
before=$(git -C "$REPO" status --porcelain)
before_staged=$(git -C "$REPO" diff --cached --name-only)
staged >/dev/null
[ "$(git -C "$REPO" status --porcelain)" = "$before" ] || fail "--staged changed the working tree"
[ "$(git -C "$REPO" diff --cached --name-only)" = "$before_staged" ] || fail "--staged changed the index"

# git stash is forbidden: it would move the working tree out from under the user.
grep -q 'git stash' "$ROOT/scripts/check-changed.sh" && fail "the checker reaches for git stash"

# --staged fails closed, like the other blocking modes.
rc=$( ( cd "$REPO" && PATH="$TMP/onlybash" "$BASH_BIN" "$CHECKER" --staged >"$TMP/out" 2>"$TMP/err" ); echo $? )
[ "$rc" = "2" ] || fail "--staged did not fail closed when node was missing (got $rc)"

git -C "$REPO" reset -q

# ── apply_patch: no path field, so the candidates come from the patch ─
#
# Codex's apply_patch PostToolUse payload carries only tool_input.command.
# H3 reads the files the patch touched from its headers, falls back to git
# only when the text has no Add, Update or Delete header at all, and never
# reports files the patch deleted or moved away from.

git -C "$REPO" add -A >/dev/null; git -C "$REPO" commit -qm "before apply_patch cases" >/dev/null
harness_set_tool uv 0 ''
seed backend/ap_update.py 'print(1)'
seed backend/ap_delete.py 'print(1)'
seed backend/ap_move_from.py 'print(1)'
git -C "$REPO" add -A >/dev/null; git -C "$REPO" commit -qm "apply_patch baseline" >/dev/null

patch_event() { # patch_event <command text> -> exit code; output in $TMP/out, $TMP/err
  node -e 'process.stdout.write(JSON.stringify({session_id:"s",cwd:process.argv[1],hook_event_name:"PostToolUse",tool_name:"apply_patch",tool_use_id:"c",tool_input:{command:process.argv[2]},tool_response:"Success."}))' \
    "$REPO" "$1" \
    | ( cd "$REPO" && "$CHECKER" --event PostToolUse >"$TMP/out" 2>"$TMP/err" ); echo $?
}

# What the patch below did to the working tree: add (with spaces and CJK in
# the name), update, delete, and move.
seed 'backend/新增 的 檔.py' 'print(2)'
seed backend/ap_update.py 'print(2)'
rm -f "$REPO/backend/ap_delete.py"
mv "$REPO/backend/ap_move_from.py" "$REPO/backend/ap_move_to.py"
PATCH='*** Begin Patch
*** Add File: backend/新增 的 檔.py
+print(2)
*** Update File: backend/ap_update.py
@@
-print(1)
+print(2)
*** Delete File: backend/ap_delete.py
*** Update File: backend/ap_move_from.py
*** Move to: backend/ap_move_to.py
*** End Patch'
harness_reset_calls
rc=$(patch_event "$PATCH")
[ "$rc" = "0" ] || fail "apply_patch: H3 did not exit 0 (got $rc)"
calls=$(harness_calls | grep 'ruff check' | head -1)
for want in '新增 的 檔.py' 'ap_update.py' 'ap_move_to.py'; do
  printf '%s' "$calls" | grep -qF "$want" || fail "apply_patch: $want was not routed: $calls"
done
for unwanted in 'ap_delete.py' 'ap_move_from.py'; do
  printf '%s' "$calls" | grep -qF "$unwanted" && fail "apply_patch: a path that no longer exists reached a tool: $unwanted"
  grep -qF "$unwanted" "$TMP/err" && fail "apply_patch: a removed path was reported: $unwanted"
done
grep -q '^FAIL' "$TMP/err" && fail "apply_patch: a false failure was reported: $(grep '^FAIL' "$TMP/err" | head -1)"
grep -q '讀不到檔案標頭' "$TMP/err" && fail "apply_patch: a readable patch fell back to the git list"
EVD="$REPO/.git/label-suite/evidence"
rec="$EVD/$(ls -1t "$EVD" | head -1)"
grep -qF 'ap_update.py' "$rec" || fail "apply_patch: the evidence record does not cover the updated file"

# Only what this patch touched: another dirty file stays out of the report.
harness_reset_calls
rc=$(patch_event '*** Begin Patch
*** Update File: backend/ap_move_to.py
*** End Patch')
calls=$(harness_calls | grep 'ruff check' | head -1)
printf '%s' "$calls" | grep -qF 'ap_move_to.py' || fail "apply_patch: the one patched file was not routed: $calls"
printf '%s' "$calls" | grep -qF 'ap_update.py' && fail "apply_patch: a file the patch did not touch was routed: $calls"

# A relative header is relative to the session cwd, not the repository root.
harness_reset_calls
rc=$(node -e 'process.stdout.write(JSON.stringify({cwd:process.argv[1],hook_event_name:"PostToolUse",tool_name:"apply_patch",tool_input:{command:"*** Begin Patch\n*** Update File: ap_update.py\n*** End Patch"}}))' \
       "$REPO/backend" | ( cd "$REPO/backend" && "$CHECKER" --event PostToolUse >"$TMP/out" 2>"$TMP/err" ); echo $?)
[ "$rc" = "0" ] || fail "apply_patch: a patch from a subdirectory did not exit 0 (got $rc)"
harness_calls | grep 'ruff check' | grep -qF 'ap_update.py' \
  || fail "apply_patch: a header relative to the session cwd was not resolved: $(grep -E '^(NA|FAIL)' "$TMP/err" | head -2)"

# Malformed patch text: no header to read, so the git list stands in.
harness_reset_calls
rc=$(patch_event 'this is not a patch *** Update File:')
[ "$rc" = "0" ] || fail "apply_patch: malformed patch text did not exit 0 (got $rc)"
harness_calls | grep 'ruff check' | grep -qF 'ap_update.py' \
  || fail "apply_patch: malformed patch text lost the git-based candidates"
grep -q '讀不到檔案標頭' "$TMP/err" || fail "apply_patch: the git fallback was not explained"
grep -q '^UNKNOWN' "$TMP/err" && fail "apply_patch: malformed patch text was treated as an unusable payload"

# A path outside the workspace named in a header goes through the header
# path, and the normalisation in the routing loop skips it with a reason.
harness_reset_calls
rc=$(patch_event '*** Begin Patch
*** Add File: /etc/ap-outside.py
+x
*** Update File: ../ap-outside-sibling.py
*** End Patch')
[ "$rc" = "0" ] || fail "apply_patch: an outside path in the patch did not exit 0 (got $rc)"
harness_calls | grep -qF 'ap-outside' && fail "apply_patch: a path outside the workspace reached a tool"
grep -q 'ap-outside.py 在 workspace 之外' "$TMP/err" || fail "apply_patch: the outside path was not reported as skipped"

# A delete-only patch has headers but leaves nothing behind: NA, and the
# other dirty files in the checkout stay out of it (no git fallback).
seed docs/ap-a.md 'a'
seed docs/ap-b.md 'b'
git -C "$REPO" add -A >/dev/null; git -C "$REPO" commit -qm "docs for the delete-only case" >/dev/null
rm -f "$REPO/docs/ap-a.md"
seed docs/ap-b.md 'b, edited before this patch'
harness_reset_calls
rc=$(patch_event '*** Begin Patch
*** Delete File: docs/ap-a.md
*** End Patch')
[ "$rc" = "0" ] || fail "apply_patch: a delete-only patch did not exit 0 (got $rc)"
grep -q 'check-specs' "$TMP/err" && fail "apply_patch: a delete-only patch ran the docs check for another dirty file"
grep -q '讀不到檔案標頭' "$TMP/err" && fail "apply_patch: a delete-only patch fell back to the git list"
grep -q '^NA: 本次沒有命中任何已啟用的路由' "$TMP/err" || fail "apply_patch: a delete-only patch was not reported as NA"
git -C "$REPO" checkout -q -- docs/ap-a.md docs/ap-b.md

# A clean checkout, in both modes. Header mode on a file whose content did
# not change still routes it: the header, not git, decides what to check.
git -C "$REPO" add -A >/dev/null; git -C "$REPO" commit -qm "apply_patch results" >/dev/null
harness_reset_calls
rc=$(patch_event '*** Begin Patch
*** Update File: backend/ap_update.py
*** End Patch')
[ "$rc" = "0" ] || fail "apply_patch: a header-mode patch on a clean tree did not exit 0 (got $rc)"
harness_calls | grep 'ruff check' | grep -qF 'ap_update.py' \
  || fail "apply_patch: a header-mode patch on a clean tree did not route the named file"
# An empty patch has no header, so it falls back to git, which on a clean
# tree has nothing to offer.
harness_reset_calls
rc=$(patch_event '*** Begin Patch
*** End Patch')
[ "$rc" = "0" ] || fail "apply_patch: an empty patch on a clean tree did not exit 0 (got $rc)"
[ -z "$(harness_calls)" ] || fail "apply_patch: an empty patch on a clean tree still ran a tool"
grep -q '^NA: 本次沒有命中任何已啟用的路由' "$TMP/err" || fail "apply_patch: an empty patch on a clean tree was not reported as NA"

# A Claude write tool still uses its own path, not the git list.
seed backend/ap_update.py 'print(3)'
seed backend/ap_other.py 'print(3)'
harness_reset_calls
printf '{"cwd":"%s","hook_event_name":"PostToolUse","tool_name":"Write","tool_input":{"file_path":"%s/backend/ap_other.py"}}' "$REPO" "$REPO" \
  | ( cd "$REPO" && "$CHECKER" --event PostToolUse >"$TMP/out" 2>"$TMP/err" )
harness_calls | grep 'ruff check' | grep -qF 'ap_update.py' \
  && fail "a Write event picked up files it did not write"
git -C "$REPO" checkout -q -- backend/ap_update.py; rm -f "$REPO/backend/ap_other.py"

# ── --list-routes names the routes that are on ───────────────────────

( cd "$REPO" && "$CHECKER" --list-routes >"$TMP/out" 2>"$TMP/err" )
grep -q 'docs' "$TMP/out" || fail "--list-routes did not list the docs route"
grep -q 'py' "$TMP/out"   || fail "--list-routes did not list the python route"
grep -qF 'backend/**/*.py' "$TMP/out" || fail "--list-routes did not scope the python route to backend/"
grep -qF 'frontend/**/*.ts,tsx' "$TMP/out" || fail "--list-routes did not scope the typescript route to frontend/"

# ── Evidence, the by-product of a check having really run ────────────

EV="$REPO/.git/label-suite/evidence"
rm -rf "$EV"
files backend/app.py >/dev/null
[ -d "$EV" ] || fail "no evidence directory was created"
[ "$(ls -1 "$EV" | wc -l | tr -d ' ')" -ge 1 ] || fail "no evidence record was written"
rec="$EV/$(ls -1 "$EV" | tail -1)"
for field in command: commit: exit: covered: head: content: agents:; do
  grep -q "^$field" "$rec" || fail "the evidence record has no $field field"
done
grep -q 'backend/app.py' "$rec" || fail "the evidence record did not record what it covered"

# The record is masked by the same exit the diagnostics use.
seed 'backend/token=abc123supersecret.py' 'x'
files 'backend/token=abc123supersecret.py' >/dev/null
rec="$EV/$(ls -1 "$EV" | tail -1)"
grep -q 'abc123supersecret' "$rec" && fail "a secret-shaped string reached the evidence record"

# A record that cannot carry its digests is not written at all. H6 compares
# the stored value against a freshly computed one, so a record holding blanks
# would match a blank and read as current however stale it was -- the exact
# shape that let H6 accept evidence for a file that had since been edited
# when the digest came from a `shasum` that was not installed.
rm -rf "$EV"
files backend/app.py >/dev/null
baseline=$(ls -1 "$EV" | wc -l | tr -d ' ')
[ "$baseline" -ge 1 ] || fail "setup for the undigestible-record case wrote no record"
mv "$REPO/AGENTS.md" "$REPO/AGENTS.md.hidden"
files backend/app.py >/dev/null
after=$(ls -1 "$EV" | wc -l | tr -d ' ')
[ "$after" = "$baseline" ] \
  || fail "a record was written while the rule file could not be digested ($baseline -> $after)"
grep -q 'AGENTS.md 的指紋' "$TMP/err" \
  || fail "the run did not say why it kept no record: $(cat "$TMP/err")"
mv "$REPO/AGENTS.md.hidden" "$REPO/AGENTS.md"
# And it starts writing records again once the rule file is back.
files backend/app.py >/dev/null
[ "$(ls -1 "$EV" | wc -l | tr -d ' ')" -gt "$after" ] \
  || fail "no record was written after the rule file came back"

# Evidence lives under .git, so it can never appear as an untracked change.
git -C "$REPO" status --porcelain | grep -q 'label-suite/evidence' \
  && fail "the evidence records showed up in git status"

# Retention: the directory is capped, oldest first.
for i in $(seq 1 210); do printf 'filler\n' > "$EV/0000-$i.rec"; done
files backend/app.py >/dev/null
count=$(ls -1 "$EV" | wc -l | tr -d ' ')
[ "$count" -le 200 ] || fail "the evidence directory grew past its cap ($count records)"

if [ "$failures" -eq 0 ]; then
  echo "check-changed-tests: OK"
else
  echo "check-changed-tests: $failures failure(s)"
  exit 1
fi
