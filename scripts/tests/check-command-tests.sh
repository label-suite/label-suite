#!/usr/bin/env bash
# Tests for scripts/check-command.sh (issue #111, task 3.2).
#
# Two matrices, kept apart on purpose. The first asserts what the spec's
# requirements say in so many words. The second asserts the spellings D10 adds
# on its own judgement — `rm -fr`, `npm i`, `--force-with-lease` and the rest —
# which are NOT in the spec text, and whose assertions must therefore cite D10
# rather than claim the spec demands them.
#
# Nothing destructive is ever executed. The checker is a string analyser, so a
# sentinel file proves the difference between judging a command and running it.
set -uo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
CHECKER="$ROOT/scripts/check-command.sh"

failures=0
fail() { echo "FAIL: $*"; failures=$((failures + 1)); }

TMP=$(mktemp -d "${TMPDIR:-/tmp}/check-command-tests.XXXXXX")
trap 'rm -rf "$TMP"' EXIT

make_repo() { # make_repo <name> <branch>
  local d="$TMP/$1"
  mkdir -p "$d"
  git -C "$d" init -q -b "$2"
  git -C "$d" config core.hooksPath /dev/null
  git -C "$d" config commit.gpgsign false
  git -C "$d" config user.email t@example.com
  git -C "$d" config user.name Test
  : > "$d/seed"; git -C "$d" add seed; git -C "$d" commit -qm "seed"
  printf '%s' "$d"
}

WORK=$(make_repo work feature)
ON_MAIN=$(make_repo onmain main)

payload() { # payload <repo> <command>
  REPO="$1" CMD="$2" python3 -c '
import json, os
print(json.dumps({"cwd": os.environ["REPO"], "hook_event_name": "PreToolUse",
                  "tool_name": "Bash", "tool_input": {"command": os.environ["CMD"]}}))'
}

run() { # run <repo> <command> -> exit code, stderr in $TMP/err
  payload "$1" "$2" | "$CHECKER" >"$TMP/out" 2>"$TMP/err"
  echo $?
}

block() { # block <repo> <command> <why>
  local rc; rc=$(run "$1" "$2")
  [ "$rc" = "2" ] || fail "$3 — expected exit 2, got $rc: $2"
}
allow() { # allow <repo> <command> <why>
  local rc; rc=$(run "$1" "$2")
  [ "$rc" = "0" ] || fail "$3 — expected exit 0, got $rc: $2"
}

# ═══ Matrix one: what the spec requires in so many words ═════════════

# spec requirement: destructive commands are refused before they run (HR10).
block "$WORK" 'rm -rf /tmp/does-not-matter'  'rm -rf was not blocked'
block "$WORK" 'git reset --hard HEAD~1'      'git reset --hard was not blocked'
block "$WORK" 'git push --force origin x'    'git push --force was not blocked'
block "$WORK" 'git branch -D feature-x'      'git branch -D was not blocked'
grep -q '10' "$TMP/err" || fail "the refusal did not name which hard rule"

# …and judging a command must never be running it.
sentinel="$TMP/sentinel-must-survive"; : > "$sentinel"
run "$WORK" "rm -rf $sentinel" >/dev/null
[ -f "$sentinel" ] || fail "the checker executed the command it was asked to judge"

# spec requirement: reaching for another tool is not authorisation.
block "$WORK" 'bash -c "rm -rf /tmp/x"' 'a destructive action wrapped in bash -c was not blocked'

# spec requirement: a confirmed destructive command is still refused here;
# the confirmed path runs outside the hook, and no in-band signal exists.
block "$WORK" 'rm -rf /tmp/x # maintainer approved' 'an in-band approval claim was honoured'

# spec requirement: commits and pushes aimed at main are refused (HR2).
block "$ON_MAIN" 'git commit -m "x"'                   'a commit on main was not blocked'
allow "$WORK"    'git commit -m "x"'                   'a commit off main was blocked'
block "$WORK"    'git push origin HEAD:refs/heads/main' 'a refspec aimed at main was not blocked'
block "$WORK"    "git -C $ON_MAIN commit -m \"x\""      'a commit into another checkout on main was not blocked'
block "$WORK"    "git --work-tree=$ON_MAIN --git-dir=$ON_MAIN/.git commit -m \"x\"" \
                 'a commit aimed by --git-dir at a checkout on main was not blocked'

# spec requirement: installs that bypass this repo's package managers are
# refused, and uv add / pnpm add are allowed (HR3).
block "$WORK" 'npm install left-pad' 'npm install was not blocked'
grep -q 'pnpm add' "$TMP/err" || fail "the refusal did not point at pnpm add"
block "$WORK" 'pip install requests' 'pip install was not blocked'
allow "$WORK" 'pnpm add left-pad'    'pnpm add was blocked'
allow "$WORK" 'uv add requests'      'uv add was blocked'

# spec requirement: a command *mentioned* in prose is not an execution.
block "$WORK" 'echo hello && rm -rf /tmp/x' 'a forbidden command after && was not blocked'
allow "$WORK" 'git commit -m "note: never run rm -rf here"' \
              'a forbidden command quoted inside a commit message was treated as an execution'
allow "$WORK" 'echo "pip install is banned; use uv add"' \
              'a forbidden command quoted inside echo was treated as an execution'

# A heredoc body is prose being passed to a command, not commands being run.
# The body must *begin* a line with a forbidden command, or dropping heredoc
# handling would still pass: an ordinary first word matches no rule anyway.
allow "$WORK" "$(printf 'git commit -F - <<EOF\nrm -rf /tmp/x\nnpm install left-pad\nEOF\n')" \
              'commands quoted inside a heredoc body were treated as executions'

# A commit aimed at a directory whose branch cannot be resolved is undecidable,
# and undecidable blocks.
mkdir -p "$TMP/not-a-repo"
block "$WORK" "git -C $TMP/not-a-repo commit -m \"x\"" \
              'a commit into a path with no resolvable branch was not blocked'

# With no refspec, the destination is the upstream branch.
UPSTREAM=$(make_repo upstream main)
git -C "$WORK" remote add origin "$UPSTREAM" 2>/dev/null
git -C "$WORK" fetch -q origin 2>/dev/null
git -C "$WORK" branch --set-upstream-to=origin/main -q 2>/dev/null
block "$WORK" 'git push' 'a push whose upstream is main was not blocked'
git -C "$WORK" branch --unset-upstream -q 2>/dev/null
git -C "$WORK" remote remove origin 2>/dev/null

# spec requirement: a refusal states the limits of string matching.
run "$WORK" 'rm -rf /tmp/x' >/dev/null
grep -q '字串比對' "$TMP/err" || fail "the refusal did not say string matching is not the boundary"
grep -q '權限層' "$TMP/err"   || fail "the refusal did not name the layer that actually protects"

# spec requirement: undecidable never reports as passing. D10 narrows
# "undecidable" to exactly three shapes, and no more.
block "$WORK" 'echo "unterminated'            'an unbalanced quote was not treated as undecidable'
block "$WORK" 'eval "$SOMETHING"'             'eval with a non-literal argument was not blocked'
block "$WORK" 'sh -c "$SOMETHING"'            'sh -c with a non-literal argument was not blocked'
block "$WORK" '$(pick-a-tool) --go'           'a command substitution in command position was not blocked'
allow "$WORK" 'echo "today is $(date)"'       'a command substitution in an operand was blocked'
allow "$WORK" 'ls -la && echo "$HOME"'        'an ordinary variable in an operand was blocked'

# ═══ Matrix two: spellings D10 adds on its own judgement ═════════════
# These are not in the spec text. Each assertion cites D10 so a later reader
# does not mistake them for spec requirements.

block "$WORK" 'rm -fr /tmp/x'                  'D10: rm -fr (equivalent spelling) was not blocked'
block "$WORK" 'rm -r -f /tmp/x'                'D10: rm -r -f (split flags) was not blocked'
block "$WORK" 'rm --recursive --force /tmp/x'  'D10: rm --recursive --force was not blocked'
block "$WORK" 'git push -f origin x'           'D10: git push -f (short flag) was not blocked'
block "$WORK" 'git push --force-with-lease origin x' \
              'D10: --force-with-lease (a different command, same history rewrite) was not blocked'
block "$WORK" 'git push origin +feature:feature' \
              'D10: a + refspec (forced update) was not blocked'
block "$WORK" 'git branch -d --force feature-x' 'D10: git branch -d --force was not blocked'
block "$WORK" 'pip3 install requests'           'D10: pip3 install was not blocked'
block "$WORK" 'npm i left-pad'                  'D10: npm i was not blocked'
block "$WORK" 'npm add left-pad'                'D10: npm add was not blocked'

# ═══ D7: the entry guards, all of which block ════════════════════════

guard() { # guard <description> <env-prefix...> -- builds a crippled environment
  :
}

# node missing — bash itself must stay reachable, or the test measures the
# shebang failing to resolve rather than the guard.
mkdir -p "$TMP/onlybash" && ln -sf "$(command -v bash)" "$TMP/onlybash/bash"
rc=$(payload "$WORK" 'ls' | env PATH="$TMP/onlybash" "$CHECKER" >/dev/null 2>"$TMP/err"; echo $?)
[ "$rc" = "2" ] || fail "D7: a missing node did not block (got $rc)"

# payload that is not JSON
rc=$(printf 'not json' | "$CHECKER" >/dev/null 2>"$TMP/err"; echo $?)
[ "$rc" = "2" ] || fail "D7: an unparseable payload did not block (got $rc)"

# payload missing the fields this event must carry
rc=$(printf '{"hook_event_name":"PreToolUse"}' | "$CHECKER" >/dev/null 2>"$TMP/err"; echo $?)
[ "$rc" = "2" ] || fail "D7: a payload missing required fields did not block (got $rc)"

# a cwd that is not a git repository
rc=$(payload "$TMP" 'ls' | "$CHECKER" >/dev/null 2>"$TMP/err"; echo $?)
[ "$rc" = "2" ] || fail "D7: failing to locate the repository did not block (got $rc)"

# Everything a checker says goes to stderr; stdout belongs to H1 alone.
run "$WORK" 'rm -rf /tmp/x' >/dev/null
[ -s "$TMP/out" ] && fail "the command checker wrote to stdout"

if [ "$failures" -eq 0 ]; then
  echo "check-command-tests: OK"
else
  echo "check-command-tests: $failures failure(s)"
  exit 1
fi
