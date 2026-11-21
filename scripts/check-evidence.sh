#!/usr/bin/env bash
# H6: before a completion is announced, check the proof exists (#111, D14).
#
# Evidence is the by-product of check-changed having really run, not something
# an agent can assert. A record counts only while three digests still match the
# current state: the commit it ran on, the contents of the paths it covered,
# and the rule file. Edit a covered file afterwards and the record stops being
# about this state.
#
# Re-entry is handled first. A stop caused by this checker's own refusal is let
# through, or the refusal triggers itself forever (contract §H6: do not invent
# a marker file, the payload already says so).
set -uo pipefail

EXIT_BLOCK=2
EVENT=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --event) EVENT="${2-}"; shift 2 ;;
    *) printf 'check-evidence.sh: unknown argument: %s\n' "$1" >&2; exit 2 ;;
  esac
done
[ -n "$EVENT" ] || { printf 'check-evidence.sh: need --event <Name>\n' >&2; exit 2; }

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
  printf 'BLOCK: node 不存在，本次完成宣告無法核對證據\n' >&2; exit "$EXIT_BLOCK"; }
for lib in "$HERE/lib/hook-payload.mjs" "$HERE/lib/hook-common.sh" "$HERE/lib/hook-routes.sh"; do
  [ -r "$lib" ] || { printf 'BLOCK: %s 不存在或不可讀，本次無法核對證據\n' "$lib" >&2; exit "$EXIT_BLOCK"; }
done
. "$HERE/lib/hook-common.sh"
. "$HERE/lib/hook-routes.sh"
hc_init
trap on_exit EXIT

payload=$(cat)
if ! printf '%s' "$payload" | node "$HERE/lib/hook-payload.mjs" --event "$EVENT" \
     > "$HC_BUFFER_DIR/records" 2>/dev/null; then
  emit_err "BLOCK: payload 無法解析，本次完成宣告不判為通過"
  FINISHED=1; hc_flush; exit "$EXIT_BLOCK"
fi

CWD=""; REENTRY="false"
hc_read_nul_list RECS < "$HC_BUFFER_DIR/records"
for rec in ${RECS+"${RECS[@]}"}; do
  case "${rec%%$'\x1F'*}" in
    cwd)              CWD="${rec#*$'\x1F'}" ;;
    stop_hook_active) REENTRY="${rec#*$'\x1F'}" ;;
  esac
done

# Always first, and silent: this stop exists because of the previous refusal.
if [ "$REENTRY" = "true" ]; then
  FINISHED=1; hc_flush; exit 0
fi

REPO=$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null)
if [ -z "$REPO" ]; then
  emit_err "BLOCK: 無法從 $CWD 定位 git repo，本次完成宣告不判為通過"
  FINISHED=1; hc_flush; exit "$EXIT_BLOCK"
fi

# ── What has to be proven ────────────────────────────────────────────
# -uall matters: without it git collapses an untracked directory into one
# entry, so every file in a newly created module would be invisible here —
# which is exactly the case H6 exists for.
git -C "$REPO" status --porcelain -z -uall > "$HC_BUFFER_DIR/status" 2>/dev/null
hc_read_nul_list STATUS < "$HC_BUFFER_DIR/status"

NEED=(); NA_NOTED=""
for entry in ${STATUS+"${STATUS[@]}"}; do
  rel="${entry:3}"
  [ -n "$rel" ] || continue
  [ -f "$REPO/$rel" ] || continue
  printf '%s' "$rel" | grep -qE "$HOOK_EXCLUDED_RE" && continue
  route=$(hook_route_for "$rel")
  [ -n "$route" ] || continue
  if ! hook_route_enabled "$route" "$REPO"; then
    case "$NA_NOTED" in
      *"[$route]"*) : ;;
      *) emit_err "NA: $route 這一層尚未建立，該層的證據項不適用，不因此擋下"
         NA_NOTED="$NA_NOTED[$route]" ;;
    esac
    continue
  fi
  NEED+=("$rel")
done

if [ "${#NEED[@]}" -eq 0 ]; then
  emit_err "PASS: 自 HEAD 以來沒有需要證據的變更"
  FINISHED=1; hc_flush; exit 0
fi

# ── Which records still describe the current state ───────────────────
GIT_DIR=$(git -C "$REPO" rev-parse --git-dir 2>/dev/null)
case "$GIT_DIR" in /*) EV="$GIT_DIR/label-suite/evidence" ;; *) EV="$REPO/$GIT_DIR/label-suite/evidence" ;; esac
HEAD_SHA=$(git -C "$REPO" rev-parse HEAD 2>/dev/null)
if ! AGENTS_SHA=$(hc_sha256 "$REPO/AGENTS.md" 2>/dev/null); then
  emit_err "BLOCK: 無法計算 AGENTS.md 的指紋，無從判斷證據是在哪一版規則下取得的"
  FINISHED=1; hc_flush; exit "$EXIT_BLOCK"
fi

COVERED=""
if [ -d "$EV" ]; then
  for rec in "$EV"/*; do
    [ -f "$rec" ] || continue
    field() { sed -n "s/^$1: //p" "$rec" | head -1; }
    [ "$(field exit)" = "0" ] || continue
    [ "$(field head)" = "$HEAD_SHA" ] || continue
    [ "$(field agents)" = "$AGENTS_SHA" ] || continue
    rec_covered=$(field covered)
    [ -n "$rec_covered" ] && [ "$rec_covered" != "（無）" ] || continue
    # A record whose contents cannot be digested does not count. `|| continue`
    # rather than a default: the failing direction here must drop the record,
    # never supply a value that something could match.
    now=$(cd "$REPO" && cat $rec_covered </dev/null 2>/dev/null | hc_sha256 2>/dev/null) || continue
    [ "$(field content)" = "$now" ] || continue
    COVERED="$COVERED $rec_covered"
  done
fi

missing=0
for rel in "${NEED[@]}"; do
  case " $COVERED " in
    *" $rel "*) : ;;
    *) missing=1; emit_err "BLOCK: $rel 沒有一筆涵蓋它、通過且與目前狀態一致的證據" ;;
  esac
done

if [ "$missing" = "1" ]; then
  emit_err "說明：證據是 check-changed 真的跑過留下的副產物。對應的檢查跑過之後再宣告完成即可；本檢查不等任何人輸入。"
  FINISHED=1; hc_flush; exit "$EXIT_BLOCK"
fi

emit_err "PASS: 每個需要證據的檔案都有一筆與目前狀態一致的通過紀錄"
FINISHED=1; hc_flush; exit 0
