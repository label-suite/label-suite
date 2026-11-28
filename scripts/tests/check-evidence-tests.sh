#!/usr/bin/env bash
# Tests for scripts/check-evidence.sh (issue #111, task 3.5).
#
# H6 asks one question: for every file this change touched that a route covers,
# is there a passing record of the check having really run against *this*
# state? The three digests are what makes "this state" mean something — edit a
# covered file after the record was written and the record stops counting.
#
# Re-entry comes first, before any of that. A stop that was caused by H6's own
# refusal is let through, or the refusal triggers itself forever.
set -uo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
CHECKER="$ROOT/scripts/check-evidence.sh"
CHANGED="$ROOT/scripts/check-changed.sh"
. "$ROOT/scripts/tests/lib/hook-harness.sh"

failures=0
fail() { echo "FAIL: $*"; failures=$((failures + 1)); }

harness_setup
REPO="$HARNESS_REPO"
git -C "$REPO" config user.email t@example.com
git -C "$REPO" config user.name Test

TMP=$(mktemp -d "${TMPDIR:-/tmp}/check-evidence-tests.XXXXXX")
trap 'rm -rf "$TMP"; harness_teardown' EXIT

EV="$REPO/.git/label-suite/evidence"

seed() { mkdir -p "$REPO/$(dirname "$1")"; printf '%s\n' "${2-x}" > "$REPO/$1"; }
commit_all() { git -C "$REPO" add -A >/dev/null; git -C "$REPO" commit -qm "${1:-c}"; }

run() { # run [stop_hook_active] -> exit code
  printf '{"cwd":"%s","hook_event_name":"Stop","stop_hook_active":%s}' "$REPO" "${1:-false}" \
    | "$CHECKER" --event Stop >"$TMP/out" 2>"$TMP/err"
  echo $?
}
produce_evidence() { ( cd "$REPO" && "$CHANGED" --files "$@" >/dev/null 2>&1 ); }

seed AGENTS.md 'rules'
seed README.md hello
commit_all seed
mkdir -p "$REPO/backend"

# ── Re-entry is checked before anything else ─────────────────────────

rm -rf "$EV"
seed backend/app.py 'print(1)'
rc=$(run true)
[ "$rc" = "0" ] || fail "a stop caused by H6's own refusal was not let through (got $rc)"
[ -s "$TMP/err" ] && fail "the re-entry path still produced diagnostics"

# ── Missing evidence blocks, and says which item is missing ──────────

rc=$(run false)
[ "$rc" = "2" ] || fail "a completion with no evidence was not blocked (got $rc)"
grep -q 'backend/app.py' "$TMP/err" || fail "the refusal did not name the file whose evidence is missing"
grep -q '維護者' "$TMP/err" && fail "H6 asked for the maintainer, which would be a third gate"

# ── A fresh passing record lets the stop through ─────────────────────

harness_set_tool uv 0 ''
produce_evidence backend/app.py
rc=$(run false)
[ "$rc" = "0" ] || fail "a fresh passing record did not satisfy H6 (got $rc)"

# ── Editing a covered file invalidates the record ────────────────────

seed backend/app.py 'print(2)'
rc=$(run false)
[ "$rc" = "2" ] || fail "a record whose covered file changed afterwards was still accepted (got $rc)"
grep -q 'backend/app.py' "$TMP/err" || fail "the stale-record refusal did not name the file"

# A docs-only change has to be satisfiable too. Every case above routes a
# `.py` file, and that is why this went unnoticed: the evidence record listed
# only the Python and TypeScript layers, while H6 asks for coverage of every
# changed file whose route is enabled -- and the docs route always is. So a
# documentation change could never produce a record that covered it, and the
# Stop hook refused one on the day it was registered (2026-11-20).
rm -rf "$EV"
mkdir -p "$REPO/scripts" "$REPO/docs"
printf 'process.exit(0)\n' > "$REPO/scripts/check-specs.mjs"
# The .py files earlier cases left behind would make this case about them too.
mv "$REPO/backend" "$REPO/.backend-aside"
seed docs/a-page.mdx 'text'
rc=$(run false)
[ "$rc" = "2" ] || fail "a docs change with no evidence was not blocked (got $rc)"
produce_evidence docs/a-page.mdx
rc=$(run false)
[ "$rc" = "0" ] || fail "a docs-only change could not be satisfied (got $rc): $(cat "$TMP/err")"
# And the record must really name it, not pass by covering nothing.
grep -q '^covered:.*docs/a-page.mdx' "$EV/$(ls -1t "$EV" | head -1)" \
  || fail "the record does not name the docs file it covered"
# Editing it afterwards still invalidates the record.
seed docs/a-page.mdx 'text, changed'
rc=$(run false)
[ "$rc" = "2" ] || fail "a stale docs record was still accepted (got $rc)"
rm -f "$REPO/docs/a-page.mdx"

# A routed file with a space (and CJK) in its name. `covered:` is a
# space-separated list, so the path is percent-encoded in it; read back
# unencoded, the digest broke and H6 refused the stop forever.
rm -rf "$EV"
seed 'docs/新 檔.md' 'text'
produce_evidence 'docs/新 檔.md'
grep -q '^covered: docs/新%20檔.md' "$EV/$(ls -1t "$EV" | head -1)" \
  || fail "the space in a covered path was not encoded: $(grep '^covered:' "$EV/$(ls -1t "$EV" | head -1)")"
rc=$(run false)
[ "$rc" = "0" ] || fail "a covered file with a space in its name was blocked (got $rc): $(cat "$TMP/err")"
# A record in the old format, with the space unencoded, is dropped rather
# than crashing or matching.
rm -rf "$EV"; mkdir -p "$EV"
{
  printf 'command: x\nexit: 0\ncovered: docs/新 檔.md \n'
  printf 'head: %s\n' "$(git -C "$REPO" rev-parse HEAD)"
  printf 'content: %s\n' "$(cat "$REPO/docs/新 檔.md" | node -e 'const c=require("node:crypto");let d=[];process.stdin.on("data",x=>d.push(x)).on("end",()=>process.stdout.write(c.createHash("sha256").update(Buffer.concat(d)).digest("hex")))')"
  printf 'agents: %s\n' "$(node -e 'process.stdout.write(require("node:crypto").createHash("sha256").update(require("node:fs").readFileSync(process.argv[1])).digest("hex"))' "$REPO/AGENTS.md")"
} > "$EV/old-format.rec"
rc=$(run false)
[ "$rc" = "2" ] || fail "an old-format record with an unencoded space was accepted or crashed (got $rc)"
grep -q 'aborted' "$TMP/err" && fail "an old-format record crashed the checker"
rm -f "$REPO/docs/新 檔.md"; rm -rf "$EV"

rm -f "$REPO/scripts/check-specs.mjs"
mv "$REPO/.backend-aside" "$REPO/backend"
rm -rf "$EV"
harness_set_tool uv 0 ''
produce_evidence backend/app.py

# ── A record that does not cover this change is not adopted ──────────

produce_evidence backend/app.py          # make it fresh again
seed backend/other.py 'print(3)'
rc=$(run false)
[ "$rc" = "2" ] || fail "a change outside the record's coverage was accepted (got $rc)"
grep -q 'backend/other.py' "$TMP/err" || fail "the refusal did not name the uncovered file"

# ── A failing record is not evidence ─────────────────────────────────

harness_set_tool uv 1 'E999'
produce_evidence backend/app.py backend/other.py
rc=$(run false)
[ "$rc" = "2" ] || fail "a record of a failing check was accepted as evidence (got $rc)"
harness_set_tool uv 0 ''

# ── Changing the rules invalidates every record ──────────────────────

produce_evidence backend/app.py backend/other.py
rc=$(run false)
[ "$rc" = "0" ] || fail "setup for the rules-digest case did not pass (got $rc)"
seed AGENTS.md 'rules, amended'
rc=$(run false)
[ "$rc" = "2" ] || fail "records survived a change to the rule file (got $rc)"
seed AGENTS.md 'rules'

# When the rule file cannot be digested at all, H6 refuses and says so. It
# refused before this was written too, but for the wrong reason -- the digest
# came back empty and merely failed to match the records' non-empty one, so
# the refusal named the files rather than the real obstacle. The assertion
# that carries weight here is the diagnosis, not the exit code.
produce_evidence backend/app.py backend/other.py
rc=$(run false)
[ "$rc" = "0" ] || fail "setup for the undigestible-rules case did not pass (got $rc)"
mv "$REPO/AGENTS.md" "$REPO/AGENTS.md.hidden"
rc=$(run false)
[ "$rc" = "2" ] || fail "H6 passed while it could not digest the rule file (got $rc)"
grep -q 'AGENTS.md 的指紋' "$TMP/err" \
  || fail "the refusal did not say the rule file could not be digested: $(cat "$TMP/err")"
mv "$REPO/AGENTS.md.hidden" "$REPO/AGENTS.md"

# Moving HEAD invalidates a record even when nothing it covered was touched:
# the check ran against a different commit, so it is not about this state.
rm -rf "$EV"
seed backend/app.py 'print(1)'
seed backend/other.py 'print(3)'
produce_evidence backend/app.py backend/other.py
rc=$(run false)
[ "$rc" = "0" ] || fail "setup for the head-digest case did not pass (got $rc)"
# Only README moves: `git add -A` would commit the .py files too, and then
# there would be nothing left for H6 to ask about.
seed README.md 'hello again'
git -C "$REPO" add README.md >/dev/null
git -C "$REPO" commit -qm 'move HEAD without touching the covered files'
rc=$(run false)
[ "$rc" = "2" ] || fail "a record made on a different commit was still accepted (got $rc)"

# ── Layers that do not exist yet are NA, not a refusal ───────────────

rm -rf "$EV" "$REPO/backend"
seed app.ts 'export const a = 1'
rc=$(run false)
[ "$rc" = "0" ] || fail "an absent frontend/ blocked the stop (got $rc)"

# A .py or .ts outside backend/ and frontend/ has no enabled route, so no
# evidence is asked for it even when those layers exist.
mkdir -p "$REPO/backend" "$REPO/frontend"
seed .semgrep/tests/fixture.py 'x'
seed e2e/spec.ts 'x'
rc=$(run false)
[ "$rc" = "0" ] || fail "a code file outside its project was asked for evidence (got $rc)"
rm -rf "$REPO/backend" "$REPO/frontend" "$REPO/.semgrep" "$REPO/e2e"

# ── Nothing changed since HEAD is nothing to prove ───────────────────

commit_all 'everything committed'
rm -rf "$EV"
rc=$(run false)
[ "$rc" = "0" ] || fail "a clean tree was blocked (got $rc)"

# ── D7 guards ────────────────────────────────────────────────────────

# bash is invoked by absolute path rather than found through the stripped
# PATH: on Git Bash `ln -s` copies bash.exe away from the msys-2.0.dll it
# needs, so the copy exits 127 before the checker runs (#830). The symlink
# stays for POSIX, where the checker may still look bash up by name.
BASH_BIN=$(command -v bash)
mkdir -p "$TMP/onlybash" && ln -sf "$(command -v bash)" "$TMP/onlybash/bash"
rc=$(printf '{"cwd":"%s","hook_event_name":"Stop","stop_hook_active":false}' "$REPO" \
     | env PATH="$TMP/onlybash" "$BASH_BIN" "$CHECKER" --event Stop >/dev/null 2>&1; echo $?)
[ "$rc" = "2" ] || fail "D7: a missing node did not block (got $rc)"

rc=$(printf 'not json' | "$CHECKER" --event Stop >/dev/null 2>&1; echo $?)
[ "$rc" = "2" ] || fail "D7: an unparseable payload did not block (got $rc)"

# #830: a reader that exits 0 and returns no records stands in for every way
# the reader can fail to run (on Windows its entry-point test never matched).
# The checker must not fall back to its own directory for a cwd nobody sent.
STUB="$TMP/stub-reader/scripts"
mkdir -p "$STUB" && cp -R "$ROOT/scripts/lib" "$STUB/" && cp "$ROOT/scripts/check-evidence.sh" "$STUB/"
printf 'process.exitCode = 0;\n' > "$STUB/lib/hook-payload.mjs"
rc=$(printf '{"cwd":"%s","hook_event_name":"Stop","stop_hook_active":false}' "$REPO" \
     | ( cd "$REPO" && bash "$STUB/check-evidence.sh" --event Stop >/dev/null 2>"$TMP/err" ); echo $?)
[ "$rc" = "2" ] || fail "#830: a reader that returned no records did not block (got $rc)"
grep -q 'cwd' "$TMP/err" || fail "#830: the empty-reader refusal did not say what was missing: $(head -1 "$TMP/err")"

rc=$(printf '{"hook_event_name":"Stop"}' | "$CHECKER" --event Stop >/dev/null 2>&1; echo $?)
[ "$rc" = "2" ] || fail "D7: a payload missing required fields did not block (got $rc)"

if [ "$failures" -eq 0 ]; then
  echo "check-evidence-tests: OK"
else
  echo "check-evidence-tests: $failures failure(s)"
  exit 1
fi
