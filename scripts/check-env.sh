#!/usr/bin/env bash
# H1: report the state of the rule-enforcement environment (issue #111, D9).
#
# This checker never blocks. Under --event it exits 0 come what may, enforced by
# a trap rather than by discipline, so a bug in here cannot stop a session from
# starting. Under --ci the same judgements are expressed as a non-zero exit,
# because there the point is to catch a registration that drifted.
#
# Everything it prints goes to stdout through hook-common's single exit. Lines
# are prefixed PASS/FAIL/NA/UNKNOWN, and the distinction between the last two
# matters: NA is a layer that does not exist yet, UNKNOWN is something this
# checker cannot determine and therefore refuses to call passing.
set -uo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/lib/hook-common.sh"

MODE=""
EVENT=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --event) MODE="event"; EVENT="${2-}"; shift 2 ;;
    --ci)    MODE="ci"; shift ;;
    *) printf 'check-env.sh: unknown argument: %s\n' "$1" >&2; exit 2 ;;
  esac
done
[ -n "$MODE" ] || { printf 'check-env.sh: need --event <Name> or --ci\n' >&2; exit 2; }

hc_init
had_fail=0
note_fail() { had_fail=1; emit_out "FAIL: $1"; }

# node is required, as it is in the other checkers: the payload reader, the
# digest and the diagnostic filter all run on it. H1 reports rather than
# blocks, so this is a verdict and not a refusal -- but it is a stated one.
# Left unsaid, a missing node emptied every line this checker produces.
command -v node >/dev/null 2>&1 \
  || note_fail "node 不存在，本輪只能回報這一項；其餘檢查需要 node 才能執行"

# Under --event nothing may change the exit code, including an unexpected error
# in this script. The trap is the enforcement; the code below does not try.
if [ "$MODE" = "event" ]; then
  trap 'hc_flush; hc_cleanup; exit 0' EXIT
fi

# ── Locate the checkout under inspection ─────────────────────────────
if [ "$MODE" = "event" ]; then
  # The records are NUL-framed, and command substitution drops NUL bytes, so
  # they go to a file and are read back with the library's own reader. Taking
  # them through $(...) silently collapses the framing into one string.
  payload=$(cat)
  ROOT=""
  if printf '%s' "$payload" | node "$HERE/lib/hook-payload.mjs" --event "$EVENT" \
       > "$HC_BUFFER_DIR/records" 2>/dev/null; then
    hc_read_nul_list PAYLOAD_RECS < "$HC_BUFFER_DIR/records"
    for rec in ${PAYLOAD_RECS+"${PAYLOAD_RECS[@]}"}; do
      [ "${rec%%$'\x1F'*}" = "cwd" ] && ROOT="${rec#*$'\x1F'}"
    done
  fi
  if [ -z "$ROOT" ]; then
    emit_out "UNKNOWN: payload 無法解析，本次只回報不依賴 payload 的項目"
    ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
  fi
else
  ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
fi
[ -d "$ROOT" ] || ROOT=$(pwd)

CLAUDE_CFG="$ROOT/.claude/settings.json"
CODEX_CFG="$ROOT/.codex/hooks.json"

# ── 1. Git entry point and the rule file ─────────────────────────────
emit_out "  ── Git 與規則入口 ──"
hooks_path=$(git -C "$ROOT" config --get core.hooksPath 2>/dev/null)
if [ "$MODE" = "ci" ]; then
  emit_out "NA: Git hooksPath 在 CI 不適用；CI 的必要檢查不依賴本機 hook"
elif [ "$hooks_path" = "scripts/git-hooks" ]; then
  emit_out "PASS: Git hooksPath 指向 scripts/git-hooks"
else
  note_fail "Git hooksPath 尚未指向 scripts/git-hooks（目前：${hooks_path:-未設定}）；執行 scripts/setup.sh 啟用"
fi

if [ -f "$ROOT/AGENTS.md" ]; then
  emit_out "PASS: AGENTS.md 存在"
else
  note_fail "AGENTS.md 不存在；規則入口缺失，確認 checkout 完整後重跑 scripts/setup.sh"
fi

# ── 2. Tool versions, with NA for layers that do not exist yet ───────
emit_out "  ── 工具版本 ──"
for tool in node pnpm; do
  if command -v "$tool" >/dev/null 2>&1; then
    emit_out "PASS: $tool $("$tool" --version 2>/dev/null | head -1)"
  else
    note_fail "$tool 不存在；它是本 repo 已啟用的檢查所需"
  fi
done
if [ ! -d "$ROOT/backend" ]; then
  emit_out "NA: uv 尚未需要（backend/ 不存在）"
elif command -v uv >/dev/null 2>&1; then
  emit_out "PASS: uv $(uv --version 2>/dev/null | head -1)"
else
  note_fail "uv 不存在，而 backend/ 已經存在；後端檢查無法執行"
fi

# ── 3. Cross-check the two hand-written registrations ────────────────
#
# This is the only drift guard the two files have (D9, contract gap 7).
# Placeholders are substituted literally — never expanded by a shell — and
# anything else that looks like shell is reported as unverifiable rather than
# guessed at, because a wrong guess here would be reported as agreement.
emit_out "  ── 兩份 hook 註冊設定 ──"
read -r -d '' SCAN_JS <<'JS'
const fs = require('node:fs');
// `node -e` leaves no script name in argv, so the extra arguments start at 1.
const [file, label, root] = process.argv.slice(1);
const EVENTS = new Set(['SessionStart', 'PreToolUse', 'PostToolUse', 'Stop', 'SubagentStop']);
let data;
try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch { process.stdout.write(`MISSING\x1f${label}\x1f\x1f\n`); process.exit(0); }

const found = [];
(function walk(node, event) {
  if (Array.isArray(node)) { for (const item of node) walk(item, event); return; }
  if (node === null || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    if (key === 'command' && typeof value === 'string') found.push([event || '(未標示事件)', value]);
    else walk(value, EVENTS.has(key) ? key : event);
  }
})(data, null);

for (const [event, raw] of found) {
  // The two tokens the registrations are allowed to use, replaced as text.
  // Each is accepted quoted as well as bare: Codex has no project-root
  // placeholder, so its registrations spell the root as a command
  // substitution, which has to be quoted or the shell that runs the hook
  // splits a path containing a space apart. Those quotes are for that
  // shell; this check does its own splitting below, and had to be fixed
  // separately. The quoted spelling is replaced first -- replacing the
  // bare token inside it would leave the quotes behind and turn a real
  // path into one that does not exist.
  const resolved = raw
    .replaceAll('"${CLAUDE_PROJECT_DIR}"', root)
    .replaceAll('${CLAUDE_PROJECT_DIR}', root)
    .replaceAll('"$(git rev-parse --show-toplevel)"', root)
    .replaceAll('$(git rev-parse --show-toplevel)', root);
  if (/\$\(|\$\{?[A-Za-z_]/.test(resolved)) {
    process.stdout.write(`OPAQUE\x1f${label}\x1f${event}\x1f${raw}\n`);
    continue;
  }
  // The target is the path, not the `--event <Event>` after it. Splitting
  // on whitespace took the first word, which truncates any checkout whose
  // path contains a space -- `/x/my repo/scripts/check-env.sh` was reported
  // ABSENT as `/x/my`, and every handler in both registrations failed with
  // it. Take the shortest prefix ending in `.sh`, and keep the old split as
  // the fallback for a command that is not a script.
  const trimmed = resolved.trim();
  const script = trimmed.match(/^(.*?\.sh)(?:\s|$)/);
  const target = script ? script[1] : trimmed.split(/\s+/)[0];
  // 0x1F, not a tab: a tab is IFS whitespace and bash collapses a run of them,
  // so an empty field in the middle would silently shift every later field.
  process.stdout.write(`${fs.existsSync(target) ? 'OK' : 'ABSENT'}\x1f${label}\x1f${event}\x1f${target}\n`);
}
JS

pair_ok=1
for pair in "$CLAUDE_CFG|.claude/settings.json" "$CODEX_CFG|.codex/hooks.json"; do
  cfg="${pair%%|*}"; label="${pair##*|}"
  while IFS=$'\x1f' read -r verdict lbl event target; do
    [ -n "$verdict" ] || continue
    case "$verdict" in
      MISSING) pair_ok=0; note_fail "$lbl 不存在或不是合法 JSON" ;;
      ABSENT)  pair_ok=0; note_fail "$lbl 的 $event 指向不存在的檢查目標：$target" ;;
      OPAQUE)  pair_ok=0; emit_out "UNKNOWN: $lbl 的 $event 的 command 含無法靜態解析的展開，不執行 shell 去展開，因此不計入核對" ;;
      OK)      : ;;
    esac
  done < <(node -e "$SCAN_JS" -- "$cfg" "$label" "$ROOT" 2>/dev/null)
done
[ "$pair_ok" = "1" ] && emit_out "PASS: 兩份 hook 註冊設定指向的目標都存在且一致"

# ── 4. Will these hooks actually run this time ───────────────────────
emit_out "  ── 本次 hook 是否真的會執行 ──"
read -r -d '' DISABLED_JS <<'JS'
const fs = require('node:fs');
for (const f of process.argv.slice(1)) {
  try {
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (d && d.disableAllHooks === true) { process.stdout.write(f); break; }
  } catch { /* absent or unreadable is simply not a disable */ }
}
JS
disabled_in=$(node -e "$DISABLED_JS" -- \
  "$CLAUDE_CFG" "$ROOT/.claude/settings.local.json" "$HOME/.claude/settings.json" 2>/dev/null)
if [ -n "$disabled_in" ]; then
  note_fail "Claude 設定 $disabled_in 的 disableAllHooks 為真，**本次 hook 不會執行**"
else
  emit_out "PASS: Claude 的 disableAllHooks 未開啟"
fi
emit_out "UNKNOWN: 組織層 managed policy 無法在此查詢，本項未經確認，不代表已通過"

codex_off=""
for toml in "$ROOT/.codex/config.toml" "$HOME/.codex/config.toml"; do
  [ -f "$toml" ] || continue
  if awk '/^\[features\]/{f=1;next} /^\[/{f=0} f && /^[[:space:]]*hooks[[:space:]]*=[[:space:]]*false/{found=1} END{exit !found}' "$toml"; then
    codex_off="$toml"; break
  fi
done
if [ -n "$codex_off" ]; then
  note_fail "Codex 的 $codex_off 把 [features] hooks 關掉了，**本次 hook 不會執行**"
else
  emit_out "PASS: Codex 的 [features] hooks 未被關閉"
fi

# Codex binds trust to the digest of the hook definitions, so a change to either
# registration means they are skipped until trusted again. That is computable;
# the trust state itself is not, and is not guessed at.
git_dir=$(git -C "$ROOT" rev-parse --git-dir 2>/dev/null)
if [ -n "$git_dir" ]; then
  case "$git_dir" in /*) state_dir="$git_dir/label-suite" ;; *) state_dir="$ROOT/$git_dir/label-suite" ;; esac
  mkdir -p "$state_dir" 2>/dev/null
  digest_file="$state_dir/hook-defs.sha256"
  # An undigestible pair of configs is reported as undigestible. The empty
  # string this used to fall back to matched the empty string a previous run
  # had stored, which reads as "the hook definitions are unchanged" -- the one
  # conclusion that cannot be drawn without the digest.
  # The two registrations are concatenated by hand rather than with
  # `cat a b | hc_sha256`. Under `pipefail` that pipeline reports failure
  # whenever either file is absent, so a checkout carrying only one of them
  # made every run report a digest it had in fact computed as uncomputable,
  # and blank the stored value with it. A missing registration contributes no
  # bytes, which is a fact, not an error.
  : > "$HC_BUFFER_DIR/hookdefs"
  for cfg in "$CLAUDE_CFG" "$CODEX_CFG"; do
    if [ -f "$cfg" ]; then cat "$cfg" >> "$HC_BUFFER_DIR/hookdefs"; fi
  done
  if ! now=$(hc_sha256 "$HC_BUFFER_DIR/hookdefs" 2>/dev/null); then
    note_fail "無法計算 hook 定義的指紋，這一輪無從判斷它有沒有變更"
    now=""
  fi
  if [ -z "$now" ]; then
    : # already reported above; the stored value is left alone rather than
      # overwritten with a blank that the next run would read as a digest.
  elif [ -f "$digest_file" ]; then
    was=$(cat "$digest_file" 2>/dev/null)
    if [ "$was" != "$now" ]; then
      note_fail "hook 定義已變更，Codex 側在**重新信任**前會被跳過；在 Codex 以 /hooks 重新信任本 repo"
    else
      emit_out "PASS: hook 定義與上次執行時相同"
    fi
    printf '%s\n' "$now" > "$digest_file" 2>/dev/null
  else
    emit_out "NA: 這是第一次記錄 hook 定義摘要，沒有可比對的前值"
    printf '%s\n' "$now" > "$digest_file" 2>/dev/null
  fi
else
  emit_out "UNKNOWN: 找不到 git 目錄，無法記錄或比對 hook 定義摘要"
fi
emit_out "UNKNOWN: Codex 的信任狀態沒有非互動的查詢方式；被 Claude 叫起時本檢查不替它作保，請在 Codex 以 /hooks 確認"

# ── Secrets: existence only, never contents ──────────────────────────
if [ -e "$ROOT/.env" ]; then
  emit_out "NA: .env 存在（本檢查只判斷存在與否，不讀取也不輸出其中任何鍵值）"
else
  emit_out "NA: .env 不存在"
fi

# ── The two gaps the permission layer has to carry (D19) ─────────────
emit_out "  ── hook 層與權限層的分工 ──"
emit_out "NA: Codex 的 hook 層沒有讀取攔截點（沒有 Read／Grep／Glob 之類的工具名），該項由平台權限層承接，而權限層尚未設定"
emit_out "NA: Codex 的 apply_patch 沒有路徑欄位，hook 層在該途徑沒有寫檔目標保護，同樣由平台權限層承接，而權限層尚未設定"

hc_flush
if [ "$MODE" = "ci" ]; then
  exit "$had_fail"
fi
exit 0
