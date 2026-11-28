#!/usr/bin/env bash
# H2, the write half: refuse writes aimed at secret paths (#111, D11).
#
# The order is fixed: take the path, normalise it, check it is inside the
# workspace, apply the legitimate exceptions, then apply the deny list. The
# exceptions come first on purpose — that is the only reason `.env.example`
# survives a rule matching `**/.env.*`.
#
# The deny list is quoted from the spec and nothing is added to it here.
set -uo pipefail

EXIT_BLOCK=2
FINISHED=0
on_exit() {
  local rc=$?
  if [ "$FINISHED" != "1" ]; then
    printf 'BLOCK: checker aborted unexpectedly\n' >&2
    hc_cleanup 2>/dev/null
    exit 2
  fi
  hc_cleanup 2>/dev/null
  exit "$rc"
}

HERE=$(cd "$(dirname "$0")" && pwd)
command -v node >/dev/null 2>&1 || {
  printf 'BLOCK: node is not available, so this write cannot be judged\n' >&2; exit "$EXIT_BLOCK"; }
for lib in "$HERE/lib/hook-payload.mjs" "$HERE/lib/hook-common.sh"; do
  [ -r "$lib" ] || {
    printf 'BLOCK: %s is missing or unreadable, so this write cannot be judged\n' "$lib" >&2
    exit "$EXIT_BLOCK"; }
done
. "$HERE/lib/hook-common.sh"
hc_init
trap on_exit EXIT

# The three sentences that must travel together wherever this checker speaks:
# no one of them may stand in for the others (D11, D19).
gaps() {
  emit_err "  說明：以 shell 改檔的途徑由命令那一組判定，本檢查不涵蓋它。"
  emit_err "  說明：Codex 沒有讀取類的工具名，hook 層在讀取上沒有攔截點。"
  emit_err "  說明：Codex 的 apply_patch 沒有路徑欄位，hook 層在那條途徑沒有寫檔目標保護。以上兩項由平台權限層承接，而平台權限層本次尚未設定。"
}

payload=$(cat)
if ! printf '%s' "$payload" | node "$HERE/lib/hook-payload.mjs" --event PreToolUse \
     > "$HC_BUFFER_DIR/records" 2>"$HC_BUFFER_DIR/perr"; then
  emit_err "BLOCK: payload 無法解析，本次寫檔不判為通過（$(head -1 "$HC_BUFFER_DIR/perr" 2>/dev/null)）"
  FINISHED=1; hc_flush; exit "$EXIT_BLOCK"
fi

CWD=""; TOOL=""; TARGET=""; HAS_PATH=0
hc_read_nul_list RECS < "$HC_BUFFER_DIR/records"
for rec in ${RECS+"${RECS[@]}"}; do
  name="${rec%%$'\x1F'*}"; value="${rec#*$'\x1F'}"
  case "$name" in
    cwd)       CWD="$value" ;;
    tool_name) TOOL="$value" ;;
    tool_path) TARGET="$value"; HAS_PATH=1 ;;
  esac
done

# Every payload the reader accepts carries cwd, so a reader that exited 0
# without one did not run (#830: on Windows its entry-point test never
# matched). Carrying on would judge the hook's own directory instead.
if [ -z "$CWD" ]; then
  emit_err "BLOCK: payload 讀取器沒有回傳 cwd，本次寫檔不判為通過"
  FINISHED=1; hc_flush; exit "$EXIT_BLOCK"
fi

REPO=$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null)
if [ -z "$REPO" ]; then
  emit_err "BLOCK: 無法從 $CWD 定位 git repo，本次寫檔不判為通過"
  FINISHED=1; hc_flush; exit "$EXIT_BLOCK"
fi

# ── Route on the tool name, not on whether a path happens to be there ─
#
# Codex's apply_patch has no path field by documented design, so treating a
# missing path as an anomaly would refuse every patch on that platform. A
# Claude write tool missing its path field is a real anomaly. An unknown tool
# name is also an anomaly: it does not inherit Codex's documented gap.
if [ "$HAS_PATH" != "1" ]; then
  case "$TOOL" in
    apply_patch)
      emit_err "NA: apply_patch 的輸入只有命令欄位、沒有寫入路徑欄位（官方文件記載），hook 層在這條途徑沒有寫檔目標保護，不因此阻擋"
      gaps
      FINISHED=1; hc_flush; exit 0
      ;;
    *)
      emit_err "BLOCK: 工具 ${TOOL:-（未提供）} 的輸入缺少本該存在的寫入路徑欄位，這是無法判斷而不是已記載的平台缺口"
      FINISHED=1; hc_flush; exit "$EXIT_BLOCK"
      ;;
  esac
fi

read -r -d '' DECIDE_JS <<'JS'
// Normalise the target, place it against the workspace, then apply the
// exceptions before the deny list. Matching is done on the repo-relative
// path so a rule anchored at the root means what it says.
// The library path travels in the environment, not in argv. Putting it at
// argv[1] makes the module's own isEntryPoint() guard true, so requiring it
// would also run its command-line entry point.
const path = require('node:path');
const { resolveTargetPath } = require(process.env.HOOK_PAYLOAD_LIB);
const [repo, target] = process.argv.slice(1);

const { resolved, outsideWorkspace } = resolveTargetPath(target, repo);
if (outsideWorkspace) {
  process.stdout.write(`OUTSIDE\t${resolved}\n`);
  process.exit(0);
}
const rel = path.relative(repo, resolved);
const base = path.basename(rel);

// Legitimate exceptions, applied first (D11).
const EXCEPTIONS = [
  [base.endsWith('.example'), '*.example'],
  [base.endsWith('.pub'), '*.pub'],
  [rel.startsWith(`scripts${path.sep}tests${path.sep}fixtures${path.sep}`), 'scripts/tests/fixtures/**'],
];
for (const [hit, label] of EXCEPTIONS) {
  if (hit) {
    process.stdout.write(`ALLOW\t${resolved}\t${label}\n`);
    process.exit(0);
  }
}

// The deny list, quoted from the spec. `**/.env` and `**/.env.*` are two
// patterns, not one: the dotted form does not match the bare name.
const DENY = [
  [(r, b) => b === '.env', '**/.env'],
  [(r, b) => b.startsWith('.env.'), '**/.env.*'],
  [(r, b) => b.endsWith('.pem'), '*.pem'],
  [(r, b) => b.endsWith('.key'), '*.key'],
  [(r, b) => b.includes('id_rsa'), '*id_rsa*'],
  [(r, b) => b.endsWith('credentials.json'), '*credentials.json'],
];
for (const [hit, label] of DENY) {
  if (hit(rel, base)) {
    process.stdout.write(`DENY\t${resolved}\t${label}\n`);
    process.exit(0);
  }
}
process.stdout.write(`ALLOW\t${resolved}\t\n`);
JS

verdict=$(HOOK_PAYLOAD_LIB="$HERE/lib/hook-payload.mjs" node -e "$DECIDE_JS" -- "$REPO" "$TARGET")
kind="${verdict%%$'\t'*}"
rest="${verdict#*$'\t'}"
resolved="${rest%%$'\t'*}"
label="${rest#*$'\t'}"

case "$kind" in
  OUTSIDE)
    emit_err "BLOCK: 寫入目標 $resolved 在 workspace 之外，本檢查判斷不了它，依規定不判為通過"
    gaps
    FINISHED=1; hc_flush; exit "$EXIT_BLOCK"
    ;;
  DENY)
    emit_err "BLOCK: 寫入目標 $resolved 命中受保護路徑樣式 $label"
    gaps
    FINISHED=1; hc_flush; exit "$EXIT_BLOCK"
    ;;
  *)
    FINISHED=1; hc_flush; exit 0
    ;;
esac
