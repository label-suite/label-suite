#!/usr/bin/env bash
# Asserts that every test file in this directory is actually run by CI
# (issue #111, task 5.1).
#
# The shell suites are picked up by a glob in the hooks job, so they need no
# maintenance. The node tests are named one by one, and a named list is the
# thing that gets forgotten: scripts/tests/hook-payload.test.mjs sat unrun by
# any job until this was written. A test nobody runs is indistinguishable from
# a test that passes.
set -uo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
CI="$ROOT/.github/workflows/ci.yml"

failures=0
fail() { echo "FAIL: $*"; failures=$((failures + 1)); }

[ -f "$CI" ] || { echo "FAIL: $CI does not exist"; exit 1; }

# Every node test must be named somewhere in the workflow.
for t in "$ROOT"/scripts/tests/*.test.mjs; do
  [ -f "$t" ] || continue
  rel="scripts/tests/$(basename "$t")"
  grep -qF "$rel" "$CI" || fail "$rel is not run by any CI job"
done

# The shell suites are covered by a glob rather than a list, so assert the
# glob itself is still there. Without it every *-tests.sh silently stops
# running, and nothing else in this file would notice.
grep -qF 'scripts/tests/*-tests.sh' "$CI" \
  || fail "the hooks job no longer globs scripts/tests/*-tests.sh"

# And that the glob currently matches something.
count=0
for t in "$ROOT"/scripts/tests/*-tests.sh; do
  [ -f "$t" ] && count=$((count + 1))
done
[ "$count" -gt 0 ] || fail "the shell suite glob matches no files"

if [ "$failures" -gt 0 ]; then
  echo "ci-wiring-tests: $failures failure(s)"
  exit 1
fi
echo "ci-wiring-tests: OK ($count shell suite(s))"
