#!/usr/bin/env bash
# Tests for scripts/check-env.sh (issue #111, task 3.1).
#
# H1 reports the state of the rule-enforcement environment at session start. It
# never blocks, so the only thing that can go wrong is the report itself: a
# missing piece not named, a piece that was never checked reported as if it had
# been, or a secret read when existence was the question. Each case below is
# one of those.
set -uo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
CHECKER="$ROOT/scripts/check-env.sh"

failures=0
fail() { echo "FAIL: $*"; failures=$((failures + 1)); }

TMP=$(mktemp -d "${TMPDIR:-/tmp}/check-env-tests.XXXXXX")
trap 'rm -rf "$TMP"' EXIT

# make_repo <name> — a checkout with both registrations wired correctly, both
# checker targets present, AGENTS.md present and hooksPath set. Each case below
# then breaks exactly one of those.
make_repo() {
  local d="$TMP/$1"
  mkdir -p "$d/scripts/git-hooks" "$d/.claude" "$d/.codex"
  git -C "$d" init -q
  git -C "$d" config core.hooksPath scripts/git-hooks
  git -C "$d" config commit.gpgsign false
  : > "$d/AGENTS.md"
  for s in check-env.sh check-command.sh; do
    printf '#!/usr/bin/env bash\nexit 0\n' > "$d/scripts/$s"
    chmod +x "$d/scripts/$s"
  done
  cat > "$d/.claude/settings.json" <<'JSON'
{"hooks":{"SessionStart":[{"hooks":[{"type":"command","command":"${CLAUDE_PROJECT_DIR}/scripts/check-env.sh --event SessionStart"}]}],
          "PreToolUse":[{"matcher":"Bash","hooks":[{"type":"command","command":"${CLAUDE_PROJECT_DIR}/scripts/check-command.sh"}]}]}}
JSON
  cat > "$d/.codex/hooks.json" <<'JSON'
{"hooks":{"SessionStart":[{"command":"\"$(git rev-parse --show-toplevel)\"/scripts/check-env.sh --event SessionStart"}],
          "PreToolUse":[{"matcher":"Bash","command":"\"$(git rev-parse --show-toplevel)\"/scripts/check-command.sh"}]}}
JSON
  printf '%s' "$d"
}

# run_h1 <repo> — drives the checker the way SessionStart does, capturing the
# two streams separately so the stream split can be asserted.
run_h1() {
  local d="$1"
  printf '{"cwd":"%s","hook_event_name":"SessionStart","session_id":"t"}' "$d" \
    | "$CHECKER" --event SessionStart >"$TMP/out" 2>"$TMP/err"
  echo $?
}

# ── It never blocks, whatever it finds ───────────────────────────────

d=$(make_repo ok)
[ "$(run_h1 "$d")" = "0" ] || fail "a healthy checkout did not exit 0"
[ -s "$TMP/out" ] || fail "nothing was written to stdout"
[ -s "$TMP/err" ] && fail "H1 wrote to stderr; the contract puts its report on stdout"

d=$(make_repo broken)
rm -f "$d/AGENTS.md"
rm -f "$d/scripts/check-command.sh"
git -C "$d" config --unset core.hooksPath
[ "$(run_h1 "$d")" = "0" ] || fail "several faults together did not still exit 0"

# ── Section one: git entry point and the rule file ───────────────────

grep -q 'AGENTS.md' "$TMP/out" || fail "a missing AGENTS.md was not named"
grep -q 'setup.sh' "$TMP/out" || fail "a disabled git hook path did not print how to fix it"

d=$(make_repo hooks_on); run_h1 "$d" >/dev/null
grep -q '^PASS:.*hooksPath' "$TMP/out" || fail "an enabled hooksPath produced no PASS line"

# ── Section two: tool versions, and NA rather than failure ───────────

d=$(make_repo tools); run_h1 "$d" >/dev/null
grep -q '^PASS: node' "$TMP/out" || fail "node version was not reported"
grep -q '^PASS: pnpm' "$TMP/out" || fail "pnpm version was not reported"
grep -q '^NA: uv' "$TMP/out" || fail "uv was not marked NA while backend/ is absent"
grep -q '^FAIL:.*uv' "$TMP/out" && fail "an absent backend/ made uv a failure instead of NA"

mkdir -p "$d/backend"; run_h1 "$d" >/dev/null
grep -q '^NA: uv' "$TMP/out" && fail "uv stayed NA even though backend/ exists"

# ── Section three: the two registrations are cross-checked ───────────

d=$(make_repo pair); run_h1 "$d" >/dev/null
grep -q '^PASS:.*兩份' "$TMP/out" || fail "two agreeing registrations produced no affirmative line"

d=$(make_repo one_side); rm -f "$d/scripts/check-command.sh"; run_h1 "$d" >/dev/null
grep -q '^FAIL:' "$TMP/out" || fail "a registration pointing at a missing target did not fail"
grep -q '\.claude/settings\.json' "$TMP/out" || fail "the failing line did not name which registration"
grep -q 'PreToolUse' "$TMP/out" || fail "the failing line did not name which event"
grep -q '^PASS:.*兩份' "$TMP/out" && fail "it still claimed the two registrations agree"

# The two known placeholders are substituted literally, never expanded.
d=$(make_repo literal); run_h1 "$d" >/dev/null
grep -q 'CLAUDE_PROJECT_DIR' "$TMP/out" && fail "the placeholder was echoed instead of resolved"
grep -q '^UNKNOWN:.*settings\.json' "$TMP/out" && fail "a known placeholder was treated as unresolvable"

# Anything else that looks like shell is refused, not guessed at.
d=$(make_repo opaque)
cat > "$d/.claude/settings.json" <<'JSON'
{"hooks":{"SessionStart":[{"hooks":[{"type":"command","command":"$MY_TOOLS/check-env.sh"}]}]}}
JSON
run_h1 "$d" >/dev/null
grep -q '^UNKNOWN:' "$TMP/out" || fail "an unknown \$VAR was not reported as unverifiable"
grep -q '^PASS:.*兩份' "$TMP/out" && fail "an unverifiable command still counted as agreement"

d=$(make_repo subst)
cat > "$d/.codex/hooks.json" <<'JSON'
{"hooks":{"SessionStart":[{"command":"$(find-my-repo)/scripts/check-env.sh"}]}}
JSON
run_h1 "$d" >/dev/null
grep -q '^UNKNOWN:' "$TMP/out" || fail "an unknown command substitution was not reported as unverifiable"

# ── Section four: will these hooks actually run this time ────────────

d=$(make_repo disabled)
printf '{"disableAllHooks":true,"hooks":{}}' > "$d/.claude/settings.json"
run_h1 "$d" >/dev/null
grep -q '本次 hook 不會執行' "$TMP/out" || fail "disableAllHooks did not say hooks will not run"

d=$(make_repo codex_off)
printf '[features]\nhooks = false\n' > "$d/.codex/config.toml"
run_h1 "$d" >/dev/null
grep -q '本次 hook 不會執行' "$TMP/out" || fail "Codex hooks=false did not say hooks will not run"

# Trust is bound to the digest of the hook definitions, so a change to either
# registration means Codex skips them until they are trusted again.
d=$(make_repo trust); run_h1 "$d" >/dev/null
digest="$(git -C "$d" rev-parse --git-dir)/label-suite/hook-defs.sha256"
[ -f "$d/$digest" ] || [ -f "$digest" ] || fail "the hook definition digest was not recorded"
printf '{"hooks":{"SessionStart":[{"command":"/changed"}]}}' > "$d/.codex/hooks.json"
run_h1 "$d" >/dev/null
grep -q '重新信任' "$TMP/out" || fail "a changed hook definition did not mention re-trusting"

# An unusable node must not quietly rewrite the stored digest. The value is
# what "unchanged since last run" is judged against, so writing a blank over
# it turns the next run's comparison into blank-against-blank -- the shape
# that let a stale evidence record read as current in H6. The shim exits
# non-zero rather than being absent, so `command -v node` still succeeds and
# this exercises the digest path rather than the startup guard.
d=$(make_repo brokennode); run_h1 "$d" >/dev/null
digest="$(git -C "$d" rev-parse --git-dir)/label-suite/hook-defs.sha256"
case "$digest" in /*) : ;; *) digest="$d/$digest" ;; esac
before=$(cat "$digest" 2>/dev/null)
[ -n "$before" ] || fail "setup for the broken-node case recorded no digest"

SHIM="$TMP/shim-brokennode"; mkdir -p "$SHIM"
printf '#!/usr/bin/env bash\nexit 127\n' > "$SHIM/node"; chmod +x "$SHIM/node"
# Run from inside the fixture. Neither of the other two routes reaches it
# when node is unusable: --ci resolves the root from the working directory,
# and --event needs node to parse the cwd out of the payload, so both fall
# back to whichever repository the test itself is running in. This assertion
# passed twice without touching the fixture before that was noticed.
( cd "$d" && PATH="$SHIM:$PATH" "$CHECKER" --ci ) >"$TMP/out" 2>"$TMP/err" </dev/null

after=$(cat "$digest" 2>/dev/null)
[ "$before" = "$after" ] || fail "an unusable node overwrote the stored digest: [$before] -> [$after]"
# Silence is the other half: every verdict is buffered and flushed through
# node, so a run that cannot flush must still say that it could not.
[ -s "$TMP/out" ] || fail "a run with an unusable node produced no output at all"
grep -q 'UNKNOWN' "$TMP/out" \
  || fail "a run with an unusable node did not report that it could not: $(cat "$TMP/out")"

# One registration present and the other absent must still produce a digest.
# Taken as `cat a b | hc_sha256` under `pipefail`, the missing file made the
# pipeline report failure, so a checkout carrying only one of them called a
# digest it had actually computed uncomputable and blanked the stored value
# with it.
d=$(make_repo onecfg); rm -f "$d/.codex/hooks.json"
( cd "$d" && "$CHECKER" --ci ) >"$TMP/out" 2>"$TMP/err" </dev/null
grep -q '無法計算 hook 定義的指紋' "$TMP/out" \
  && fail "an absent .codex/hooks.json was reported as an uncomputable digest"
digest="$(git -C "$d" rev-parse --git-dir)/label-suite/hook-defs.sha256"
case "$digest" in /*) : ;; *) digest="$d/$digest" ;; esac
stored=$(cat "$digest" 2>/dev/null)
[ "${#stored}" -eq 64 ] \
  || fail "no digest was stored when one registration was absent: [$stored]"
# And the value must be the digest of the file that is there, not of nothing.
present=$(cd "$d" && bash -c '. "$1"; hc_init; hc_sha256 .claude/settings.json' _ "$ROOT/scripts/lib/hook-common.sh")
[ "$stored" = "$present" ] \
  || fail "the stored digest is not the digest of the present registration"

# Codex has no project-root placeholder, so its registrations spell the root
# as a command substitution, and that has to be quoted or the shell running
# the hook splits a path with a space in it apart. The fixture above uses the quoted spelling on the Codex
# side and the bare placeholder on the Claude side, which is exactly what this
# repository ships. Resolving the quoted form by replacing only the bare token
# inside it leaves the quotes in the path, so every target reads as missing --
# measured on 2026-11-20, when the real configs landed and all six Codex
# entries were reported absent.
d=$(make_repo quoted); run_h1 "$d" >/dev/null
grep -q '指向不存在的檢查目標' "$TMP/out" \
  && fail "the quoted command substitution was not resolved: $(grep '指向不存在' "$TMP/out" | head -1)"
grep -q '^PASS:.*兩份' "$TMP/out" \
  || fail "the two registrations were not reported as agreeing: $(grep -E '兩份|FAIL' "$TMP/out" | head -2)"

# Those quotes are for the shell that runs the hook. This checker does its own
# splitting, and splitting on whitespace to drop the `--event <Event>` took the
# first word -- so a checkout whose path contains a space had every handler in
# both registrations reported absent at the first segment. Measured on
# 2026-11-20 against `.../scratchpad/sp space v2`: twelve FAIL lines, all
# naming `.../scratchpad/sp`.
d=$(make_repo "has space"); run_h1 "$d" >/dev/null
grep -q '指向不存在的檢查目標' "$TMP/out" \
  && fail "a checkout path containing a space was truncated: $(grep '指向不存在' "$TMP/out" | head -1)"
grep -q '^PASS:.*兩份' "$TMP/out" \
  || fail "a checkout path containing a space did not agree: $(grep -E '兩份|FAIL' "$TMP/out" | head -2)"

# The quoted spelling of the Claude token is accepted too. No configuration
# this repository ships uses it, so nothing else exercises that replacement;
# pinning it here keeps it from being dropped as dead on a later reading.
d=$(make_repo quotedclaude)
cat > "$d/.claude/settings.json" <<'JSON'
{"hooks":{"SessionStart":[{"hooks":[{"type":"command","command":"\"${CLAUDE_PROJECT_DIR}\"/scripts/check-env.sh --event SessionStart"}]}],
          "PreToolUse":[{"matcher":"Bash","hooks":[{"type":"command","command":"\"${CLAUDE_PROJECT_DIR}\"/scripts/check-command.sh"}]}]}}
JSON
run_h1 "$d" >/dev/null
grep -q '指向不存在的檢查目標' "$TMP/out" \
  && fail "the quoted Claude placeholder was not resolved: $(grep '指向不存在' "$TMP/out" | head -1)"

# ── Secrets: existence is the question, never the contents ───────────

# The payload deliberately matches none of hook-common's masking patterns. With
# a key named API_KEY the shared exit would scrub it whatever this checker did,
# and the assertion would pass without testing anything here.
d=$(make_repo secret)
printf 'PLAIN_SETTING=zzTOPSECRETzz\nAPI_KEY=maskedanyway\n' > "$d/.env"
run_h1 "$d" >/dev/null
grep -q 'zzTOPSECRETzz' "$TMP/out" "$TMP/err" && fail "the .env contents were read into the report"
grep -q 'maskedanyway' "$TMP/out" "$TMP/err" && fail "a masked key still reached the report"
grep -q '\.env' "$TMP/out" || fail "the presence of .env was not reported at all"

# ── The two gaps the permission layer has to carry, stated as gaps ───

d=$(make_repo gaps); run_h1 "$d" >/dev/null
grep -q '讀取' "$TMP/out" || fail "the missing read interception on Codex was not stated"
grep -q 'apply_patch' "$TMP/out" || fail "the missing write-target protection on Codex was not stated"
grep -q '權限層' "$TMP/out" || fail "the report did not say which layer carries those gaps"
grep -q '尚未設定' "$TMP/out" || fail "the report implied the permission layer is already configured"

# ── --ci expresses the same verdict as a non-zero exit ───────────────

d=$(make_repo ci_ok)
( cd "$d" && "$CHECKER" --ci >"$TMP/out" 2>"$TMP/err" )
[ $? = 0 ] || fail "--ci failed on a healthy checkout"

d=$(make_repo ci_bad); rm -f "$d/scripts/check-command.sh"
( cd "$d" && "$CHECKER" --ci >"$TMP/out" 2>"$TMP/err" )
[ $? != 0 ] || fail "--ci exited 0 despite a registration pointing at a missing target"

# ── The repository's own registrations: onFailure only where it means something ──
# H1 compares the two registrations by target, not by field, so it would not
# notice the Claude H2 handlers losing `onFailure: "block"`. Without it a
# mistyped path or a crashed H2 script lets the call through again. It is not
# set on Stop/SubagentStop (Claude ignores it there), and Codex has no such
# field, so `.codex/hooks.json` must not carry one either.
node - "$ROOT/.claude/settings.json" "$ROOT/.codex/hooks.json" >"$TMP/out" 2>&1 <<'JS'
const fs = require('node:fs');
const [claudePath, codexPath] = process.argv.slice(2);
const handlers = (cfg) =>
  Object.entries(cfg.hooks || {}).flatMap(([event, groups]) =>
    groups.flatMap((g) => (g.hooks || []).map((h) => ({ event, matcher: g.matcher, ...h }))));
const problems = [];
const claude = handlers(JSON.parse(fs.readFileSync(claudePath, 'utf8')));
const h2 = claude.filter((h) => h.event === 'PreToolUse');
if (h2.length !== 2) problems.push(`expected 2 Claude PreToolUse handlers, found ${h2.length}`);
for (const h of h2) {
  if (h.onFailure !== 'block') problems.push(`Claude PreToolUse ${h.matcher} lacks onFailure: "block"`);
}
for (const h of claude.filter((h) => h.event !== 'PreToolUse')) {
  if ('onFailure' in h) problems.push(`Claude ${h.event} carries onFailure, which is H2-only`);
}
for (const h of handlers(JSON.parse(fs.readFileSync(codexPath, 'utf8')))) {
  if ('onFailure' in h) problems.push(`Codex ${h.event} carries onFailure, a field Codex does not have`);
}
if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
JS
[ $? = 0 ] || fail "the real hook registrations: $(cat "$TMP/out")"

if [ "$failures" -eq 0 ]; then
  echo "check-env-tests: OK"
else
  echo "check-env-tests: $failures failure(s)"
  exit 1
fi
