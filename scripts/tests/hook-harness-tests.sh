#!/usr/bin/env bash
# Smoke tests for scripts/tests/lib/hook-harness.sh (issue #111, task 2.1).
#
# The harness is what lets every later checker test run against a repository it
# owns, with tools it controls. If it quietly fell back to the real ruff or the
# real repository, those tests would still pass while proving nothing — so this
# file checks the isolation itself rather than any checker.
set -uo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
# shellcheck source=scripts/tests/lib/hook-harness.sh
source "$ROOT/scripts/tests/lib/hook-harness.sh"

failures=0
fail() { echo "FAIL: $*"; failures=$((failures + 1)); }
ok()   { :; }

# A decoy "real" toolchain, planted on PATH *before* the harness runs. None of
# the four tools is installed on every developer machine, so without this the
# shadowing assertion below would pass simply because nothing else answers to
# the name — a test that cannot fail. The decoy makes the harness actually have
# to win.
DECOY=$(mktemp -d "${TMPDIR:-/tmp}/hook-harness-decoy.XXXXXX")
for tool in ruff mypy tsc eslint; do
  printf '#!/usr/bin/env bash\necho "DECOY-%s"\nexit 99\n' "$tool" > "$DECOY/$tool"
  chmod +x "$DECOY/$tool"
done
PATH="$PATH:$DECOY"
export PATH
trap 'rm -rf "$DECOY"' EXIT

# ── The isolated repository ──────────────────────────────────────────

harness_setup

[ -n "${HARNESS_REPO:-}" ] || fail "harness_setup did not export HARNESS_REPO"
[ -d "$HARNESS_REPO" ]     || fail "HARNESS_REPO is not a directory: $HARNESS_REPO"
[ -d "$HARNESS_REPO/.git" ] || fail "HARNESS_REPO is not a git repository"

# It must not be this repository, or a test could damage real work.
[ "$HARNESS_REPO" != "$ROOT" ] || fail "harness handed back the real repository"
case "$HARNESS_REPO" in
  "$ROOT"/*) fail "harness repository sits inside the real one: $HARNESS_REPO" ;;
esac

# A commit must be possible without the real repo's hooks or identity.
( cd "$HARNESS_REPO" && echo x > a.txt && git add a.txt \
  && git -c user.email=t@e -c user.name=t commit -q -m "x" --no-verify ) \
  || fail "could not make a commit inside the harness repository"

# ── The fake tools really shadow the real ones ───────────────────────

for tool in ruff mypy tsc eslint; do
  resolved=$(command -v "$tool" 2>/dev/null || true)
  [ -n "$resolved" ] || { fail "$tool is not on PATH inside the harness"; continue; }
  case "$resolved" in
    "$HARNESS_BIN"/*) ok ;;
    *) fail "$tool resolved to $resolved, not the harness copy" ;;
  esac
  # And prove it by running it: the decoy exits 99 and says so.
  out=$("$tool" --version 2>&1); code=$?
  [ "$code" -ne 99 ] || fail "$tool ran the decoy, not the harness copy"
  case "$out" in *DECOY*) fail "$tool produced decoy output: $out" ;; *) ok ;; esac
done

# Fixed output and a fixed exit code, both settable per tool.
harness_set_tool ruff 0 "ruff: clean"
out=$(ruff check . 2>&1); code=$?
[ "$code" -eq 0 ]        || fail "fake ruff exited $code, expected 0"
[ "$out" = "ruff: clean" ] || fail "fake ruff printed '$out'"

harness_set_tool ruff 1 "ruff: E501 line too long"
out=$(ruff check . 2>&1); code=$?
[ "$code" -eq 1 ] || fail "fake ruff exited $code after being set to 1"
case "$out" in *"E501"*) ok ;; *) fail "fake ruff printed '$out'" ;; esac

# The fake must record that it ran, so a test can prove a checker called it.
harness_reset_calls
ruff check . >/dev/null 2>&1
mypy . >/dev/null 2>&1
calls=$(harness_calls)
case "$calls" in *ruff*) ok ;; *) fail "ruff call was not recorded: [$calls]" ;; esac
case "$calls" in *mypy*) ok ;; *) fail "mypy call was not recorded: [$calls]" ;; esac
case "$calls" in *eslint*) fail "eslint was recorded but never ran: [$calls]" ;; esac

# ── Fake payloads, one per event ─────────────────────────────────────

for event in SessionStart PreToolUse PostToolUse Stop SubagentStop; do
  payload=$(harness_payload "$event")
  [ -n "$payload" ] || { fail "no payload produced for $event"; continue; }
  if ! node "$ROOT/scripts/lib/hook-payload.mjs" --event "$event" <<<"$payload" >/dev/null 2>&1; then
    fail "payload for $event was rejected by hook-payload.mjs"
  fi
done

# The payload's cwd must point at the harness repo, not the real one.
cwd=$(harness_payload PreToolUse | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).cwd))')
# Same directory, not same spelling: on Git Bash node receives the variable
# already converted, as `C:/Users/RUNNER~1/...` for `/tmp/...` (#830), which
# is also the form a Windows agent would send.
[ "$cwd" -ef "$HARNESS_REPO" ] || fail "payload cwd is $cwd, expected $HARNESS_REPO"

# Overriding one field must be possible without rebuilding the whole payload.
payload=$(harness_payload PreToolUse tool_name Write tool_path "$HARNESS_REPO/.env")
case "$payload" in *'"Write"'*) ok ;; *) fail "tool_name override did not take" ;; esac
case "$payload" in *'.env'*) ok ;; *) fail "tool_path override did not take" ;; esac

# ── Teardown removes everything it made ──────────────────────────────

repo_was="$HARNESS_REPO"
bin_was="$HARNESS_BIN"
harness_teardown
rm -rf "$DECOY"
[ ! -d "$repo_was" ] || fail "teardown left the repository behind: $repo_was"
[ ! -d "$bin_was" ]  || fail "teardown left the fake tools behind: $bin_was"

if [ "$failures" -gt 0 ]; then
  echo "$failures hook-harness test(s) failed."
  exit 1
fi
echo "All hook-harness tests passed."
