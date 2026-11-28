#!/usr/bin/env bash
# The contract the five checkers share (issue #111, task 3.6).
#
# Each checker was written on its own, so this file asks the questions that
# only make sense across all of them: does an undecidable state cost the same
# everywhere it should, does every line carry a prefix a parser can read, and
# does the same input produce the same words whichever mode asked.
#
# Where it finds a disagreement the checkers are wrong, not this file.
set -uo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)

failures=0
fail() { echo "FAIL: $*"; failures=$((failures + 1)); }

TMP=$(mktemp -d "${TMPDIR:-/tmp}/checker-contract.XXXXXX")
trap 'rm -rf "$TMP"' EXIT

REPO="$TMP/repo"; mkdir -p "$REPO"
git -C "$REPO" init -q
git -C "$REPO" config core.hooksPath /dev/null
git -C "$REPO" config user.email t@example.com
git -C "$REPO" config user.name Test
printf 'rules\n' > "$REPO/AGENTS.md"
git -C "$REPO" add -A >/dev/null; git -C "$REPO" commit -qm seed

# bash is invoked by absolute path rather than found through the stripped
# PATH: on Git Bash `ln -s` copies bash.exe away from the msys-2.0.dll it
# needs, so the copy exits 127 before the checker runs (#830). The symlink
# stays for POSIX, where the checker may still look bash up by name.
BASH_BIN=$(command -v bash)
mkdir -p "$TMP/onlybash" && ln -sf "$(command -v bash)" "$TMP/onlybash/bash"

# A copy of the checkers with no lib/ beside them, for the missing-library guard.
mkdir -p "$TMP/nolib"
cp "$ROOT"/scripts/check-*.sh "$TMP/nolib/"

payload() { # payload <event> [tool_name] [extra-json]
  # The default is set on its own line: a `}` inside ${x:-...} closes the
  # expansion early, so ${3:-{}} silently appends a stray brace to every value.
  local extra="${3-}"
  [ -n "$extra" ] || extra='{}'
  REPO="$REPO" EV="$1" TOOL="${2-}" EXTRA="$extra" python3 -c '
import json, os
p = {"cwd": os.environ["REPO"], "hook_event_name": os.environ["EV"]}
p.update(json.loads(os.environ["EXTRA"]))
if os.environ["TOOL"]:
    p["tool_name"] = os.environ["TOOL"]
print(json.dumps(p))'
}

# How each checker is driven, and what a guard failure must cost it.
#   name|argv|payload-event|payload-tool|extra|expected-guard-exit
CASES=(
  "check-command|--|PreToolUse|Bash|{\"tool_input\":{\"command\":\"ls\"}}|2"
  "check-write-target|--|PreToolUse|Write|{\"tool_input\":{\"file_path\":\"a.txt\"}}|2"
  "check-evidence|--event Stop|Stop||{\"stop_hook_active\":false}|2"
  "check-changed|--event PostToolUse|PostToolUse|Write|{\"tool_input\":{\"file_path\":\"a.py\"}}|0"
  "check-changed|--files a.py|||{}|2"
  "check-changed|--range HEAD~0..HEAD|||{}|2"
  "check-changed|--list-routes|||{}|2"
)

drive() { # drive <checker-dir> <name> <argv> <event> <tool> <extra> <path-override>
  local dir="$1" name="$2" argv="$3" ev="$4" tool="$5" extra="$6" pathover="$7"
  local args=()
  [ "$argv" != "--" ] && read -r -a args <<< "$argv"
  if [ -n "$ev" ]; then
    payload "$ev" "$tool" "$extra" > "$TMP/p"
  else
    : > "$TMP/p"
  fi
  ( cd "$REPO" && PATH="$pathover" "$BASH_BIN" "$dir/$name.sh" ${args+"${args[@]}"} \
      < "$TMP/p" > "$TMP/out" 2>"$TMP/err" )
  echo $?
}

# ── D7: the same undecidable state costs the same in every blocking mode ──

NODE_DIR=$(dirname "$(command -v node)")
FULL="$NODE_DIR:/usr/bin:/bin"

for case in "${CASES[@]}"; do
  IFS='|' read -r name argv ev tool extra want <<< "$case"
  label="$name ${argv/--/}"

  rc=$(drive "$ROOT/scripts" "$name" "$argv" "$ev" "$tool" "$extra" "$TMP/onlybash")
  [ "$rc" = "$want" ] || fail "guard(node missing): $label expected $want, got $rc"

  rc=$(drive "$TMP/nolib" "$name" "$argv" "$ev" "$tool" "$extra" "$FULL")
  [ "$rc" = "$want" ] || fail "guard(lib missing): $label expected $want, got $rc"

  if [ -n "$ev" ]; then
    printf 'not json' > "$TMP/p"
    rc=$( ( cd "$REPO" && PATH="$FULL" "$ROOT/scripts/$name.sh" $([ "$argv" != "--" ] && echo "$argv") \
            < "$TMP/p" >"$TMP/out" 2>"$TMP/err" ); echo $? )
    [ "$rc" = "$want" ] || fail "guard(bad payload): $label expected $want, got $rc"
  fi
done

# A reminder trigger that cannot decide says so instead of staying silent.
rc=$(drive "$ROOT/scripts" check-changed "--event PostToolUse" PostToolUse Write '{"tool_input":{"file_path":"a.py"}}' "$TMP/onlybash")
grep -q '^UNKNOWN:' "$TMP/err" || fail "the reminder trigger passed without naming what it could not decide"

# ── Every line a checker prints is machine-readable ──────────────────
#
# A line either opens with one of the five prefixes, or is indented and
# belongs to the prefixed line above it.
check_prefixes() { # check_prefixes <file> <label>
  local n=0
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    case "$line" in
      PASS:*|FAIL:*|BLOCK:*|NA:*|UNKNOWN:*) ;;
      " "*|"	"*) ;;
      *) n=$((n + 1)); [ "$n" -le 2 ] && fail "$2 printed an unreadable line: $line" ;;
    esac
  done < "$1"
}

printf 'print(1)\n' > "$REPO/a.py"
( cd "$REPO" && PATH="$FULL" "$ROOT/scripts/check-changed.sh" --files a.py >"$TMP/out" 2>"$TMP/err" )
check_prefixes "$TMP/err" "check-changed --files"

payload PreToolUse Bash '{"tool_input":{"command":"rm -rf /tmp/x"}}' > "$TMP/p"
( cd "$REPO" && PATH="$FULL" "$ROOT/scripts/check-command.sh" <"$TMP/p" >"$TMP/out" 2>"$TMP/err" )
check_prefixes "$TMP/err" "check-command"

payload PreToolUse Write '{"tool_input":{"file_path":".env"}}' > "$TMP/p"
( cd "$REPO" && PATH="$FULL" "$ROOT/scripts/check-write-target.sh" <"$TMP/p" >"$TMP/out" 2>"$TMP/err" )
check_prefixes "$TMP/err" "check-write-target"

payload Stop '' '{"stop_hook_active":false}' > "$TMP/p"
( cd "$REPO" && PATH="$FULL" "$ROOT/scripts/check-evidence.sh" --event Stop <"$TMP/p" >"$TMP/out" 2>"$TMP/err" )
check_prefixes "$TMP/err" "check-evidence"

payload SessionStart > "$TMP/p"
( cd "$REPO" && PATH="$FULL" "$ROOT/scripts/check-env.sh" --event SessionStart <"$TMP/p" >"$TMP/out" 2>"$TMP/err" )
check_prefixes "$TMP/out" "check-env"

# ── The streams are split the same way everywhere ────────────────────
[ -s "$TMP/err" ] && fail "check-env wrote to stderr; H1 owns stdout and only stdout"

for pair in "check-command|PreToolUse|Bash|{\"tool_input\":{\"command\":\"rm -rf /x\"}}" \
            "check-write-target|PreToolUse|Write|{\"tool_input\":{\"file_path\":\".env\"}}"; do
  IFS='|' read -r name ev tool extra <<< "$pair"
  payload "$ev" "$tool" "$extra" > "$TMP/p"
  ( cd "$REPO" && PATH="$FULL" "$ROOT/scripts/$name.sh" <"$TMP/p" >"$TMP/out" 2>"$TMP/err" )
  [ -s "$TMP/out" ] && fail "$name wrote to stdout; only H1 may"
  [ -s "$TMP/err" ] || fail "$name wrote nothing to stderr"
done

# ── The same input reads the same whichever mode asked ───────────────
printf 'print(1)\n' > "$REPO/a.py"
payload PostToolUse Write "{\"tool_input\":{\"file_path\":\"$REPO/a.py\"}}" > "$TMP/p"
( cd "$REPO" && PATH="$FULL" "$ROOT/scripts/check-changed.sh" --event PostToolUse <"$TMP/p" 2>"$TMP/event-err" >/dev/null )
( cd "$REPO" && PATH="$FULL" "$ROOT/scripts/check-changed.sh" --files a.py 2>"$TMP/files-err" >/dev/null )
if ! diff -q "$TMP/event-err" "$TMP/files-err" >/dev/null; then
  fail "the same input produced different diagnostics in --event and --files"
  diff "$TMP/event-err" "$TMP/files-err" | head -6
fi

if [ "$failures" -eq 0 ]; then
  echo "checker-contract-tests: OK"
else
  echo "checker-contract-tests: $failures failure(s)"
  exit 1
fi
