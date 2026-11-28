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

# check-pr-commits.sh skips a commit only when the PR author is dependabot[bot]
# AND the commit author email is the exact noreply address.
PRC="$ROOT/scripts/check-pr-commits.sh"
DEP_EMAIL='49699333+dependabot[bot]@users.noreply.github.com'
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git -C "$tmp" init -q
git -C "$tmp" config user.name tester
git -C "$tmp" config user.email tester@example.com
git -C "$tmp" commit -q --allow-empty -m "chore: base (#1)"
base=$(git -C "$tmp" rev-parse HEAD)

# run_prc <pr-author or empty>: output in $prc_out, status in $prc_rc.
run_prc() {
  prc_out=$(cd "$tmp" && "$PRC" "$base" HEAD ${1:+"$1"} 2>&1)
  prc_rc=$?
}
expect() { # expect <pass|fail> <label>
  if { [ "$1" = pass ] && [ "$prc_rc" -ne 0 ]; } || { [ "$1" = fail ] && [ "$prc_rc" -eq 0 ]; }; then
    echo "FAIL (expected $1): $2"
    failures=$((failures + 1))
  fi
}

git -C "$tmp" -c user.name='dependabot[bot]' -c user.email="$DEP_EMAIL" \
  commit -q --allow-empty -m "Bump foo from 1 to 2"
dep_sha=$(git -C "$tmp" rev-parse HEAD)

run_prc 'dependabot[bot]'
expect pass "dependabot PR with dependabot-authored commit was not skipped"
case "$prc_out" in
  *"skip $dep_sha"*) ;;
  *) echo "FAIL: skip line for $dep_sha not printed"; failures=$((failures + 1)) ;;
esac

run_prc someone
expect fail "dependabot email from a non-dependabot PR author was skipped"
run_prc ''
expect fail "dependabot email with no PR author was skipped"

git -C "$tmp" -c user.name='dependabot[bot]' -c user.email=someone@example.com \
  commit -q --allow-empty -m "Bump bar from 1 to 2"
run_prc 'dependabot[bot]'
expect fail "spoofed dependabot display name was skipped"

git -C "$tmp" reset -q --hard "$dep_sha"
git -C "$tmp" commit -q --allow-empty -m "bad human commit"
run_prc 'dependabot[bot]'
expect fail "invalid human commit in a dependabot PR range was not rejected"

if [ "$failures" -gt 0 ]; then
  echo "$failures commit-msg test(s) failed."
  exit 1
fi
echo "All commit-msg tests passed."
