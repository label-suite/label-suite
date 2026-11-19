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

mkdir -p "$REPO/backend"
seed backend/app.py 'print(1)'
harness_reset_calls
rc=$(files backend/app.py)
harness_calls | grep -q '^ruff ' || fail "ruff did not run once backend/ exists"
harness_calls | grep -q '^mypy ' || fail "mypy did not run once backend/ exists"
harness_calls | grep -q '^ruff check' || fail "ruff was not invoked with the check subcommand"
harness_calls | grep -q -- '--fix' && fail "a tool was invoked in a mode that rewrites files"

# An enabled layer whose tool is missing is an explicit failure, not NA.
harness_reset_calls
# node must stay reachable here, or this measures the node guard instead of
# the missing-tool verdict. ruff and mypy are genuinely absent on this machine,
# so dropping the harness directory from PATH is enough.
NODE_DIR=$(dirname "$(command -v node)")
rc=$( ( cd "$REPO" && PATH="$NODE_DIR:/usr/bin:/bin" "$CHECKER" --files backend/app.py >"$TMP/out" 2>"$TMP/err" ); echo $? )
[ "$rc" = "0" ] && fail "a missing tool for an enabled layer reported as passing"
grep -q 'ruff' "$TMP/err" || fail "the failure did not name the missing tool"
grep -q '^NA:' "$TMP/err" && fail "a missing tool for an enabled layer was marked NA"

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

# ── The exclusions, applied before routing ───────────────────────────

mkdir -p "$REPO/frontend"
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
harness_set_tool ruff 1 'app.py:1:1 E999 invalid syntax'
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
harness_set_tool ruff 0 ''

mkdir -p "$TMP/onlybash" && ln -sf "$(command -v bash)" "$TMP/onlybash/bash"
undecidable() { # undecidable <mode-args...> -> exit code
  ( cd "$REPO" && PATH="$TMP/onlybash" "$CHECKER" "$@" >"$TMP/out" 2>"$TMP/err" ); echo $?
}

rc=$(printf '{"cwd":"%s","hook_event_name":"PostToolUse","tool_name":"Write","tool_input":{"file_path":"%s/backend/app.py"}}' "$REPO" "$REPO" \
     | ( cd "$REPO" && PATH="$TMP/onlybash" "$CHECKER" --event PostToolUse >"$TMP/out" 2>"$TMP/err" ); echo $?)
[ "$rc" = "0" ] || fail "--event did not stay out of the way when it could not decide (got $rc)"
grep -q '^UNKNOWN:' "$TMP/err" || fail "--event did not name the item it could not decide"

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
harness_set_tool ruff 0 ''
harness_set_tool mypy 0 ''

seed backend/staged.py 'print(1)'
git -C "$REPO" add backend/staged.py >/dev/null
harness_reset_calls
rc=$(staged)
[ "$rc" = "0" ] || fail "a clean staged change was refused (got $rc)"
harness_calls | grep -q '^ruff ' || fail "--staged did not route the staged file to its tool"

# The tool must see the staged bytes, not whatever the working tree holds.
# The harness logs the first line of every file it is handed, so this asserts
# on the content rather than on the path, which is identical either way.
seed backend/staged.py 'print(2)   # fixed here but never staged'
harness_set_tool ruff 1 'staged.py:1:1 E999 the staged version is broken'
harness_reset_calls
rc=$(staged)
[ "$rc" = "1" ] || fail "a fix left unstaged was treated as if it counted (got $rc)"
grep -q 'E999' "$TMP/err" || fail "--staged did not report the tool output"
harness_calls | grep -q 'ruff saw .*<<print(1)' \
  || fail "the tool was handed the working-tree copy, not the staged one"
harness_calls | grep -q 'never staged' \
  && fail "the working-tree copy reached the tool"
harness_set_tool ruff 0 ''

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
rc=$( ( cd "$REPO" && PATH="$TMP/onlybash" "$CHECKER" --staged >"$TMP/out" 2>"$TMP/err" ); echo $? )
[ "$rc" = "2" ] || fail "--staged did not fail closed when node was missing (got $rc)"

git -C "$REPO" reset -q

# ── --list-routes names the routes that are on ───────────────────────

( cd "$REPO" && "$CHECKER" --list-routes >"$TMP/out" 2>"$TMP/err" )
grep -q 'docs' "$TMP/out" || fail "--list-routes did not list the docs route"
grep -q 'py' "$TMP/out"   || fail "--list-routes did not list the python route"

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
