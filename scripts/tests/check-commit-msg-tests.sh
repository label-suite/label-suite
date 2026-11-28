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

# check-pr-commits.sh skips commits authored by dependabot[bot] (exact noreply
# email) and still checks everyone else, including a spoofed display name.
PRC="$ROOT/scripts/check-pr-commits.sh"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git -C "$tmp" init -q
git -C "$tmp" config user.name tester
git -C "$tmp" config user.email tester@example.com
git -C "$tmp" commit -q --allow-empty -m "chore: base (#1)"
base=$(git -C "$tmp" rev-parse HEAD)

run_prc() { (cd "$tmp" && "$PRC" "$base" HEAD >/dev/null 2>&1); }

git -C "$tmp" -c user.name='dependabot[bot]' \
  -c user.email='49699333+dependabot[bot]@users.noreply.github.com' \
  commit -q --allow-empty -m "Bump foo from 1 to 2"
if ! run_prc; then
  echo "FAIL (expected pass): dependabot-authored commit was not skipped"
  failures=$((failures + 1))
fi

git -C "$tmp" -c user.name='dependabot[bot]' -c user.email='someone@example.com' \
  commit -q --allow-empty -m "Bump bar from 1 to 2"
if run_prc; then
  echo "FAIL (expected rejection): spoofed dependabot display name was skipped"
  failures=$((failures + 1))
fi

if [ "$failures" -gt 0 ]; then
  echo "$failures commit-msg test(s) failed."
  exit 1
fi
echo "All commit-msg tests passed."
