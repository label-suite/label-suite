#!/usr/bin/env bash
# Refuses the constructs that would let a checker pass something it did not
# judge, or repair what it was only meant to report (issue #111, D5/D7/D12).
#
# Two kinds of rule, and the difference is the whole point. A construct that
# swallows a failure means the same thing wherever it appears, so it is
# matched anywhere. A word like `timeout` or `--fix` is forbidden as a command
# or an argument and perfectly ordinary as English, so those are anchored to
# the position where they would actually run. Matching them anywhere turns a
# sentence explaining the platform's own timeout field into a CI failure.
#
# Usage: forbidden-terms-lint.sh [path...]   (defaults to the checker layer)
set -uo pipefail

if [ "$#" -gt 0 ]; then
  TARGETS=("$@")
else
  # Relative to the repository root, so the default run does not depend on
  # where it was invoked from.
  cd "$(cd "$(dirname "$0")/../.." && pwd)" || exit 2
  TARGETS=()
  for candidate in scripts/check-*.sh scripts/lib/*.sh scripts/git-hooks/*; do
    [ -f "$candidate" ] && TARGETS+=("$candidate")
  done
fi

# A gate that scanned nothing must not report that nothing is wrong. This is
# the same mistake in miniature as the one that motivates the digest rule
# below: an empty result and a clean result are not the same answer.
if [ "${#TARGETS[@]}" -eq 0 ]; then
  printf 'forbidden-terms-lint: no files to scan\n' >&2
  exit 2
fi

found=0
FILE=""

# Command position: the start of a line, indentation included, or just after a
# separator; plus an optional leading path so `/usr/bin/shasum` still counts.
# Whitespace in the middle of a line is deliberately NOT command position --
# that is what keeps a sentence about `eslint --fix` from failing the lint
# whose whole purpose is to keep that sentence true.
CMD='(^[[:space:]]*|[;&|(][[:space:]]*)([^[:space:];&|()]*/)?'

# rule <label> <extended-regex> — reports every matching line in $FILE.
rule() {
  local label="$1" regex="$2" hit
  while IFS= read -r hit; do
    [ -n "$hit" ] || continue
    printf '%s:%s: %s\n' "$FILE" "${hit%%:*}" "$label" >&2
    printf '    %s\n' "${hit#*:}" >&2
    found=1
  done < <(grep -nE "$regex" "$FILE" 2>/dev/null)
}

for FILE in ${TARGETS+"${TARGETS[@]}"}; do
  # Named but unreadable is an error, not a skip: counting it among the clean
  # files is how a gate ends up reporting that it checked something it never
  # opened.
  if [ ! -f "$FILE" ]; then
    printf 'forbidden-terms-lint: cannot read %s\n' "$FILE" >&2
    found=1
    continue
  fi

  # Anywhere: these only ever mean "ignore what just failed". The terminator
  # admits `;` and `&`, because `ruff check || true; echo ok` swallows the
  # failure exactly as thoroughly as the version without the semicolon.
  rule 'swallows a failure'            '\|\|[[:space:]]*(true|:)([[:space:]]|[;&)]|$)'
  rule 'swallows a failure'            '\|\|[[:space:]]*exit[[:space:]]+0([[:space:]]|[;&)]|$)'

  # Command position only: the same words are ordinary English. The
  # distinction $CMD draws is between a command and a word inside a sentence,
  # NOT between column zero and anything else. Nearly every line in this layer
  # sits inside an `if` or a `for`, and a prefix that admitted only the start
  # of the line left these rules matching almost nothing -- a nine-violation
  # probe of indented commands reported "clean" (measured 2026-11-19).
  rule 'kills processes it did not start' "$CMD(pkill|killall)[[:space:]]"
  rule 'runs a timeout of its own'     "$CMD(timeout|gtimeout)[[:space:]]"
  rule 'repairs instead of reporting'  "$CMD(eslint|ruff|prettier)[[:space:]]+--(fix|write)([[:space:]]|\$)"
  rule 'stages files for the agent'    "${CMD}git[[:space:]]+add[[:space:]]"
  # Digests must come from node, which these checkers already require, not
  # from whichever of shasum/sha256sum/md5 the machine happens to carry. The
  # cost of getting this wrong was not a portability warning: the call sites
  # discarded stderr, so a missing tool yielded an empty digest, and an empty
  # digest matched the empty digest in a stale evidence record. See hc_sha256
  # in scripts/lib/hook-common.sh.
  rule 'digests with a tool that may be absent' \
    "$CMD(shasum|sha256sum|sha1sum|md5|md5sum|openssl[[:space:]]+dgst)[[:space:]]"
done

if [ "$found" = "1" ]; then
  printf 'forbidden-terms-lint: refused (see above)\n' >&2
  exit 1
fi
printf 'forbidden-terms-lint: %d file(s) clean\n' "${#TARGETS[@]}"
