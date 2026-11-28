#!/usr/bin/env bash
# Tests for scripts/setup.sh (issue #111, tasks 4.3 and 4.4).
#
# The installer touches a developer's own git configuration, so the two things
# worth pinning are that running it twice is the same as running it once, and
# that it never quietly replaces a setting somebody chose on purpose.
#
# Every case runs with GIT_CONFIG_GLOBAL pointed at a temporary file. Without
# that, a test for user-level conflicts would write to the real one.
set -uo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SETUP="$ROOT/scripts/setup.sh"

failures=0
fail() { echo "FAIL: $*"; failures=$((failures + 1)); }

TMP=$(mktemp -d "${TMPDIR:-/tmp}/setup-tests.XXXXXX")
trap 'rm -rf "$TMP"' EXIT
: > "$TMP/gitconfig-global"

fresh_repo() { # fresh_repo <name> -> path
  local d="$TMP/$1"; mkdir -p "$d/scripts/git-hooks"
  git -C "$d" init -q
  git -C "$d" config user.email t@example.com
  git -C "$d" config user.name Test
  printf '%s' "$d"
}

run_setup() { # run_setup <repo> -> exit code, output in $TMP/out
  ( cd "$1" && GIT_CONFIG_GLOBAL="$TMP/gitconfig-global" HOME="$TMP" \
      bash "$SETUP" >"$TMP/out" 2>&1 )
  echo $?
}
hooks_path() { git -C "$1" config --local --get core.hooksPath 2>/dev/null; }

# ── A fresh checkout gets the hooks enabled ──────────────────────────

d=$(fresh_repo fresh)
rc=$(run_setup "$d")
[ "$rc" = "0" ] || fail "setup failed on a fresh checkout (got $rc)"
[ "$(hooks_path "$d")" = "scripts/git-hooks" ] || fail "core.hooksPath was not set"

# ── Running it again is the same as running it once ──────────────────

cp "$TMP/out" "$TMP/out-first"
rc=$(run_setup "$d")
[ "$rc" = "0" ] || fail "the second run failed (got $rc)"
[ "$(hooks_path "$d")" = "scripts/git-hooks" ] || fail "the second run changed core.hooksPath"
grep -qi '已啟用\|already' "$TMP/out" || fail "the second run did not say it was already enabled"

# ── An existing setting of someone else's is never overwritten ───────

d=$(fresh_repo conflict_local)
git -C "$d" config core.hooksPath .my-own-hooks
rc=$(run_setup "$d")
[ "$(hooks_path "$d")" = ".my-own-hooks" ] || fail "setup overwrote a hooksPath somebody else chose"
grep -q '.my-own-hooks' "$TMP/out" || fail "the conflict report did not name the current value"
grep -q 'scripts/git-hooks' "$TMP/out" || fail "the conflict report did not say what it wanted to set"

# …including one that lives at the user level, where it is easy to miss.
d=$(fresh_repo conflict_global)
# No leading `/`: Git Bash rewrites such an argument into a Windows path on
# its way to git.exe, so the value read back would differ from the one this
# test thinks it wrote (#830). What matters is that setup leaves it alone.
git config --file "$TMP/gitconfig-global" core.hooksPath somewhere-global
rc=$(run_setup "$d")
grep -qi 'global\|使用者層\|全域' "$TMP/out" || fail "a user-level hooksPath was not reported"
[ "$(git config --file "$TMP/gitconfig-global" --get core.hooksPath)" = "somewhere-global" ] \
  || fail "setup modified the user-level configuration"
git config --file "$TMP/gitconfig-global" --unset core.hooksPath

# ── It says how to turn this off again, and what that does not do ────

d=$(fresh_repo offswitch)
run_setup "$d" >/dev/null
grep -q 'git config --unset core.hooksPath' "$TMP/out" || fail "no way to disable the git hooks was printed"
grep -q 'disableAllHooks' "$TMP/out" || fail "Claude's disable switch was not mentioned"
grep -q 'hooks = false' "$TMP/out" || fail "Codex's disable switch was not mentioned"
grep -qi 'CI' "$TMP/out" || fail "it did not say that disabling local hooks leaves CI in place"

# ── Codex users are told their hooks are skipped until trusted ───────
#
# Trust is bound to the hash of the hook definitions, so every change to a
# hook silently un-trusts them again. Someone who never hears this assumes
# the hooks are running.

grep -q '/hooks' "$TMP/out" || fail "the Codex trust command was not printed"
grep -qi '靜默\|silent' "$TMP/out" || fail "it did not say the skip is silent"
grep -qi '重新信任\|re-trust\|trust again' "$TMP/out" || fail "it did not say how to trust again"

d=$(fresh_repo trust_twice)
run_setup "$d" >/dev/null; cp "$TMP/out" "$TMP/trust-1"
run_setup "$d" >/dev/null
diff <(grep -A4 '/hooks' "$TMP/trust-1") <(grep -A4 '/hooks' "$TMP/out") >/dev/null \
  || fail "the trust guidance differed between two runs"

# The guidance lives in one function with one call site, so it stays in one
# place if the answer ever changes.
defs=$(grep -cE '^[a-z_]*trust[a-z_]*\(\)' "$SETUP")
[ "$defs" = "1" ] || fail "expected exactly one trust-guidance function, found $defs"

if [ "$failures" -eq 0 ]; then
  echo "setup-tests: OK"
else
  echo "setup-tests: $failures failure(s)"
  exit 1
fi
