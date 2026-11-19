#!/usr/bin/env bash
# Tests for scripts/git-hooks/ (issue #111, tasks 4.1 and 4.2).
#
# These drive real `git commit` calls in an isolated repository with the real
# hook files installed, because the thing under test is the wiring: whether
# git actually runs them, whether a refusal stops the commit, and whether the
# two hooks stay independent of one another.
set -uo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
. "$ROOT/scripts/tests/lib/hook-harness.sh"

failures=0
fail() { echo "FAIL: $*"; failures=$((failures + 1)); }

harness_setup
REPO="$HARNESS_REPO"
git -C "$REPO" config user.email t@example.com
git -C "$REPO" config user.name Test

# The repository under test gets a copy of the checkers and the hooks, so the
# hook's own `cd` to the top level resolves to this repository, not the real
# one. hooksPath is set the way scripts/setup.sh sets it.
mkdir -p "$REPO/scripts/lib" "$REPO/scripts/git-hooks" "$REPO/backend"
cp "$ROOT/scripts/check-changed.sh" "$ROOT/scripts/check-commit-msg.sh" "$REPO/scripts/"
cp "$ROOT"/scripts/lib/* "$REPO/scripts/lib/"
cp "$ROOT"/scripts/git-hooks/* "$REPO/scripts/git-hooks/" 2>/dev/null
git -C "$REPO" config core.hooksPath scripts/git-hooks
printf 'rules\n' > "$REPO/AGENTS.md"
git -C "$REPO" add -A >/dev/null
git -C "$REPO" commit -qm "chore: seed the fixture repository (#111)" --no-verify

MSG='fix: a message the commit-msg checker accepts (#111)

- **Add** a line so the body has a bold verb bullet.
'

commit() { # commit <extra git args...> -> exit code
  git -C "$REPO" commit -m "$MSG" "$@" >"$HARNESS_BIN/.commit-out" 2>&1
  echo $?
}

# ── The hook runs at all, and a clean change commits ─────────────────

harness_set_tool ruff 0 ''
harness_set_tool mypy 0 ''
printf 'print(1)\n' > "$REPO/backend/ok.py"
git -C "$REPO" add backend/ok.py >/dev/null
harness_reset_calls
rc=$(commit)
[ "$rc" = "0" ] || fail "a clean staged change was refused by the hook (got $rc)"
harness_calls | grep -q '^ruff ' || fail "the pre-commit hook never reached the checker"

# ── A refusal actually stops the commit ──────────────────────────────

before=$(git -C "$REPO" rev-parse HEAD)
harness_set_tool ruff 1 'bad.py:1:1 E999 broken'
printf 'print(2)\n' > "$REPO/backend/bad.py"
git -C "$REPO" add backend/bad.py >/dev/null
rc=$(commit)
[ "$rc" = "0" ] && fail "the hook let a failing check through"
[ "$(git -C "$REPO" rev-parse HEAD)" = "$before" ] || fail "a refused commit was created anyway"
grep -q 'E999' "$HARNESS_BIN/.commit-out" || fail "the tool's diagnostic never reached the committer"

# ── Fixing the working tree without staging does not help ────────────

printf 'print(3)  # fixed but not staged\n' > "$REPO/backend/bad.py"
harness_set_tool ruff 1 'bad.py:1:1 E999 the staged copy is still broken'
rc=$(commit)
[ "$rc" = "0" ] && fail "an unstaged fix was enough to get past the hook"
[ "$(git -C "$REPO" rev-parse HEAD)" = "$before" ] || fail "the commit happened despite the refusal"

# ── --no-verify skips it, which is why CI is the real gate ───────────

rc=$(commit --no-verify)
[ "$rc" = "0" ] || fail "--no-verify did not skip the hook (got $rc)"
[ "$(git -C "$REPO" rev-parse HEAD)" = "$before" ] && fail "--no-verify did not produce a commit"
harness_set_tool ruff 0 ''

# ── The two hooks are independent (H5 unchanged) ─────────────────────
#
# A message the commit-msg checker rejects must be rejected even when every
# staged file is clean, and the refusal must come from that checker.

before=$(git -C "$REPO" rev-parse HEAD)
printf 'print(4)\n' > "$REPO/backend/clean.py"
git -C "$REPO" add backend/clean.py >/dev/null
rc=$(git -C "$REPO" commit -m "沒有 type 前綴也沒有 body" >"$HARNESS_BIN/.commit-out" 2>&1; echo $?)
[ "$rc" = "0" ] && fail "commit-msg stopped firing once pre-commit was added"
[ "$(git -C "$REPO" rev-parse HEAD)" = "$before" ] || fail "a bad message still produced a commit"
grep -qi 'commit message rejected\|subject' "$HARNESS_BIN/.commit-out" \
  || fail "the refusal did not come from the commit-message checker"

# And a good message with clean files commits, proving neither hook blocks
# the other's happy path.
rc=$(commit)
[ "$rc" = "0" ] || fail "both hooks together refused a commit that satisfies both (got $rc)"

# ── The hook is three lines of wiring, with no judgement in it ────────

# Not covered, and it cannot be: the hook opens with a `cd` to the top level,
# but git already runs hooks from there — measured, including `git commit`
# from a subdirectory. Removing that line changes nothing observable, so no
# assertion here can hold it in place. It stays as the same belt-and-braces
# the commit-msg hook uses.
HOOK="$ROOT/scripts/git-hooks/pre-commit"
[ -x "$HOOK" ] || fail "the pre-commit hook is not executable"
grep -q 'check-changed.sh --staged' "$HOOK" || fail "the hook does not call the shared checker"
grep -qE 'ruff|mypy|tsc|eslint|diff-filter|\.py|\.ts' "$HOOK" \
  && fail "the hook carries judgement of its own; that belongs in the checker"

# H5's own files must be untouched by this task. The comparison is against
# the merge base, not origin/main: main moves under this branch, and a change
# someone else landed there is not a change this task made.
BASE=$(git -C "$ROOT" merge-base HEAD origin/main 2>/dev/null)
if [ -n "$BASE" ]; then
  git -C "$ROOT" diff --quiet "$BASE" HEAD -- scripts/check-commit-msg.sh scripts/git-hooks/commit-msg \
    || fail "this task changed the commit-message checker or its hook"
else
  echo "NOTE: no merge base with origin/main; skipped the H5 zero-diff check"
fi

if [ "$failures" -eq 0 ]; then
  echo "git-hooks-tests: OK"
else
  echo "git-hooks-tests: $failures failure(s)"
  exit 1
fi
