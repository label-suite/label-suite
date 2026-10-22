#!/usr/bin/env bash
# Regression tests for scripts/check-commit-msg.sh.
# Every fixture under valid/ must pass and every fixture under invalid/ must fail.
set -uo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
CHECK="$ROOT/scripts/check-commit-msg.sh"
FIXTURES="$ROOT/scripts/tests/fixtures/commit-msg"
failures=0

for f in "$FIXTURES"/valid/*.txt; do
  if ! out=$("$CHECK" "$f" 2>&1); then
    echo "FAIL (expected pass): ${f#"$ROOT"/}"
    echo "$out" | sed 's/^/    /'
    failures=$((failures + 1))
  fi
done

for f in "$FIXTURES"/invalid/*.txt; do
  if "$CHECK" "$f" >/dev/null 2>&1; then
    echo "FAIL (expected rejection): ${f#"$ROOT"/}"
    failures=$((failures + 1))
  fi
done

if [ "$failures" -gt 0 ]; then
  echo "$failures commit-msg test(s) failed."
  exit 1
fi
echo "All commit-msg tests passed."
