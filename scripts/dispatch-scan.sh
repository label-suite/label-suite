#!/usr/bin/env bash
# List open, non-Epic issues in the Label Suite project's Ready column.
# Output: one tab-separated row per issue: number, open blocked-by numbers, title.
# Read-only by construction: the query is fixed and takes no arguments, so
# .claude/settings.json can allow this script without allowing arbitrary
# `gh api graphql` calls (which would also admit mutations).
set -euo pipefail

if [[ $# -ne 0 ]]; then
  echo "usage: scripts/dispatch-scan.sh (takes no arguments)" >&2
  exit 2
fi

# `gh --paginate` only advances when the cursor variable is named $endCursor;
# any other name re-reads the first page forever.
gh api graphql --paginate -f query='
query($endCursor: String) {
  organization(login: "label-suite") {
    projectV2(number: 1) {
      items(first: 100, after: $endCursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          status: fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue { name }
          }
          content {
            ... on Issue {
              number title state issueType { name }
              blockedBy(first: 20) { nodes { number state } }
            }
          }
        }
      }
    }
  }
}' --jq '.data.organization.projectV2.items.nodes[]
  | select(.status.name == "Ready" and .content.state == "OPEN" and .content.issueType.name != "Epic")
  | [.content.number,
     ([.content.blockedBy.nodes[] | select(.state == "OPEN") | .number] | tostring),
     .content.title]
  | @tsv'
