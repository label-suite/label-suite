#!/usr/bin/env bash
# Check every non-merge commit in BASE..HEAD with check-commit-msg.sh.
# Commits authored by Dependabot are skipped: it cannot write the "(#N)"
# suffix or the bold-verb body. Only the exact noreply author email is
# matched, so every other author is still checked.
# Usage: scripts/check-pr-commits.sh <base-sha> <head-sha>
set -uo pipefail

DEPENDABOT_EMAIL='49699333+dependabot[bot]@users.noreply.github.com'
ROOT=$(cd "$(dirname "$0")/.." && pwd)

base=${1:?usage: check-pr-commits.sh <base-sha> <head-sha>}
head=${2:?usage: check-pr-commits.sh <base-sha> <head-sha>}

msg=$(mktemp)
trap 'rm -f "$msg"' EXIT
failed=0
for sha in $(git rev-list --no-merges "$base..$head"); do
  if [ "$(git log -1 --format=%ae "$sha")" = "$DEPENDABOT_EMAIL" ]; then
    echo "skip $sha (authored by dependabot[bot])"
    continue
  fi
  git log -1 --format=%B "$sha" > "$msg"
  if ! "$ROOT/scripts/check-commit-msg.sh" "$msg"; then
    echo "::error::commit $sha has an invalid message (details above)"
    failed=1
  fi
done
exit "$failed"
