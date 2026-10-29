#!/usr/bin/env bash
# check-commit-msg.sh — validate one commit message file against the commit
# rules in AGENTS.md § Commits and docs/development/commit-and-release.md.
#
# Usage: scripts/check-commit-msg.sh <message-file>
# Shared by the local commit-msg hook and the CI commit-messages job, so the
# two can never drift apart.
#
# Rules:
#   - Subject: <type>(<scope>)?: <text>, type in the AGENTS.md list, <= 72 chars
#   - Blank line after the subject, then a body with at least one `- **Verb**` bullet
#   - No `Claude-Session:` trailer
#   - No CJK characters (CJK punctuation, ideographs, fullwidth forms)
#
# Exemptions: merge commits (subject starts with "Merge "); comment lines and
# everything below the scissors line, which git strips after this check runs;
# Co-authored-by / Signed-off-by trailers, which carry people's real names.
set -uo pipefail

MSG_FILE="$1"

COMMENT_CHAR=$(git config core.commentChar 2>/dev/null || true)
case "$COMMENT_CHAR" in
  ""|auto) COMMENT_CHAR='#' ;;
esac

COMMENT_CHAR="$COMMENT_CHAR" perl -CSD -e '
  my $cc = quotemeta($ENV{COMMENT_CHAR});
  my @lines;
  while (<>) {
    last if /^$cc\s*-+\s*>8\s*-+/;
    next if /^$cc/;
    s/\s+$//;
    push @lines, $_;
  }
  shift @lines while @lines && $lines[0] eq "";
  exit 0 if @lines && $lines[0] =~ /^Merge /;

  my @errors;
  my $subject = $lines[0] // "";
  my $types = "feat|fix|docs|refactor|test|chore|ci|perf|build";
  push @errors, "subject must be <type>(<scope>)?: <text> with type one of: " . join(" ", split /\|/, $types)
    unless $subject =~ /^(?:$types)(?:\([a-z0-9._-]+\))?: \S/;
  push @errors, sprintf("subject is %d characters; the limit is 72", length $subject)
    if length($subject) > 72;
  push @errors, "the line after the subject must be blank"
    if @lines > 1 && $lines[1] ne "";
  push @errors, "body needs at least one bullet starting with a bold verb, e.g. \"- **Add** ...\""
    unless grep { /^- \*\*[A-Z][a-z]+\*\* \S/ } @lines[1 .. $#lines];
  push @errors, "remove the Claude-Session trailer; only Co-Authored-By is allowed"
    if grep { /^Claude-Session:/i } @lines;
  for my $i (0 .. $#lines) {
    next if $lines[$i] =~ /^(?:Co-authored-by|Signed-off-by):/i;
    my @bad = $lines[$i] =~ /([\x{3000}-\x{9FFF}\x{F900}-\x{FAFF}\x{FF00}-\x{FFEF}])/g;
    push @errors, sprintf("line %d has CJK characters (%s); commit messages are English only", $i + 1, join(" ", @bad)) if @bad;
  }

  exit 0 unless @errors;
  print STDERR "Commit message rejected (see AGENTS.md, Commits):\n";
  print STDERR "  - $_\n" for @errors;
  exit 1;
' "$MSG_FILE"
