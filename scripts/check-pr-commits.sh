#!/usr/bin/env bash
# Check every non-merge commit in BASE..HEAD with check-commit-msg.sh.
# Commits authored by Dependabot are skipped: it cannot write the "(#N)"
# suffix or the bold-verb body. A commit is skipped only when the pull
# request author is exactly dependabot[bot] AND the commit author email is
# the exact Dependabot noreply address; the email alone can be set locally.
# Usage: scripts/check-pr-commits.sh <base-sha> <head-sha> [<pr-author-login>]
set -uo pipefail

DEPENDABOT_EMAIL='49699333+dependabot[bot]@users.noreply.github.com'
ROOT=$(cd "$(dirname "$0")/.." && pwd)

base=${1:?usage: check-pr-commits.sh <base-sha> <head-sha>}
head=${2:?usage: check-pr-commits.sh <base-sha> <head-sha> [<pr-author-login>]}
pr_author=${3:-}

msg=$(mktemp)
trap 'rm -f "$msg"' EXIT
failed=0
for sha in $(git rev-list --no-merges "$base..$head"); do
  if [ "$pr_author" = 'dependabot[bot]' ] &&
    [ "$(git log -1 --format=%ae "$sha")" = "$DEPENDABOT_EMAIL" ]; then
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
