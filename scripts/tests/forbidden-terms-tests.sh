#!/usr/bin/env bash
# Tests for scripts/tests/forbidden-terms-lint.sh (issue #111, task 5.2).
#
# The lint is itself a gate, so the things worth asserting are the two ways a
# gate goes wrong: it misses what it was built to catch, and it fires on what
# it was built to tolerate. The fixtures carry both, and this file is what
# makes them mean something -- without it the regexes have no regression
# protection, which is how a version that matched only column zero, and so
# matched almost nothing in this layer, passed its own fixture.
set -uo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
LINT="$ROOT/scripts/tests/forbidden-terms-lint.sh"
BAD="$ROOT/scripts/tests/fixtures/forbidden-terms/bad-swallows-failure.sh"
GOOD="$ROOT/scripts/tests/fixtures/forbidden-terms/good-mentions-in-comments.sh"

TMP=$(mktemp -d "${TMPDIR:-/tmp}/forbidden-terms-tests.XXXXXX")
trap 'rm -rf "$TMP"' EXIT

failures=0
fail() { echo "FAIL: $*"; failures=$((failures + 1)); }

run() { # run <path...> -> exit code, stderr in $TMP/err
  bash "$LINT" "$@" >"$TMP/out" 2>"$TMP/err"
  echo $?
}

# ── The red fixture ──────────────────────────────────────────────────

rc=$(run "$BAD")
[ "$rc" = "1" ] || fail "the bad fixture did not fail the lint (got $rc)"

# Every rule must still be firing. A rule that quietly stops matching looks
# exactly like a clean file.
for label in \
  'swallows a failure' \
  'kills processes it did not start' \
  'runs a timeout of its own' \
  'repairs instead of reporting' \
  'stages files for the agent' \
  'digests with a tool that may be absent' \
  'runs a variable name into a non-ASCII character'
do
  grep -qF "$label" "$TMP/err" || fail "no rule reported [$label] on the bad fixture"
done

# ── The green fixture ────────────────────────────────────────────────

rc=$(run "$GOOD")
[ "$rc" = "0" ] || fail "the good fixture was refused (got $rc): $(cat "$TMP/err")"

# ── Indentation is command position ──────────────────────────────────

# The regression that produced this file. Each of these is a real command,
# written where this layer actually writes commands: inside a block.
printf '#!/usr/bin/env bash\nif true; then\n    %s\nfi\n' > /dev/null  # shape reference
for construct in \
  'shasum -a 256 "$1"' \
  'git add "$1"' \
  'eslint --fix "$1"' \
  'timeout 30 tsc' \
  'pkill -f tsc' \
  'ruff check || true'
do
  printf '#!/usr/bin/env bash\nif true; then\n    %s\nfi\n' "$construct" > "$TMP/indented.sh"
  rc=$(run "$TMP/indented.sh")
  [ "$rc" = "1" ] || fail "an indented [$construct] was not caught (got $rc)"
done

# ── The same words in a sentence are not commands ─────────────────────

for sentence in \
  'echo "never run shasum here"' \
  'echo "do not git add for the agent"' \
  'echo "a repair step would run eslint --fix"' \
  'echo "the platform timeout is 30s"' \
  'echo "never pkill a process you did not start"'
do
  printf '#!/usr/bin/env bash\nif true; then\n    %s\nfi\n' "$sentence" > "$TMP/prose.sh"
  rc=$(run "$TMP/prose.sh")
  [ "$rc" = "0" ] || fail "a sentence was refused: $sentence -- $(cat "$TMP/err")"
done

# ── Scanning nothing is not a pass ───────────────────────────────────

rc=$(run "$TMP/does-not-exist.sh")
[ "$rc" != "0" ] || fail "a target it could not read was reported as clean"

# ── The real checker layer is clean ──────────────────────────────────

# Run from elsewhere on purpose: the default target list is relative, and a
# lint that silently scans zero files from the wrong directory reports the
# same "clean" as one that scanned them all.
( cd "$TMP" && bash "$LINT" >"$TMP/layer.out" 2>"$TMP/layer.err" )
rc=$?
[ "$rc" = "0" ] || fail "the checker layer is not clean: $(cat "$TMP/layer.err")"
grep -qE '[1-9][0-9]* file\(s\) clean' "$TMP/layer.out" \
  || fail "the default run scanned no files: $(cat "$TMP/layer.out")"

if [ "$failures" -gt 0 ]; then
  echo "forbidden-terms-tests: $failures failure(s)"
  exit 1
fi
echo "forbidden-terms-tests: OK"
