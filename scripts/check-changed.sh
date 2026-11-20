#!/usr/bin/env bash
# H3, H4 and H7 in one checker: route changed files to their checks (#111, D12).
#
# One checker serves a reminder trigger and two blocking ones. The routing and
# the verdict are identical in every mode; only the encoding of "cannot decide"
# differs, because H3 must never stop an edit while H4 and H7 must never let
# an undecided state through (D2).
#
# It reports and never repairs: every sub-tool runs in its checking mode and
# nothing is ever staged.
set -uo pipefail

MODE=""; EVENT=""; ARGS=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --event)       MODE="event"; EVENT="${2-}"; shift 2 ;;
    --files)       MODE="files"; shift; ARGS=("$@"); break ;;
    --range)       MODE="range"; ARGS=("${2-}"); shift 2 ;;
    --staged)      MODE="staged"; shift ;;
    --list-routes) MODE="list-routes"; shift ;;
    *) printf 'check-changed.sh: unknown argument: %s\n' "$1" >&2; exit 2 ;;
  esac
done
[ -n "$MODE" ] || { printf 'check-changed.sh: need a mode\n' >&2; exit 2; }

# The mode decides what an undecidable state costs. Everything else is shared.
blocking() { [ "$MODE" != "event" ]; }

FINISHED=0
on_exit() {
  local rc=$?
  if [ "$FINISHED" != "1" ]; then
    [ -n "${MIRROR:-}" ] && [ -d "$MIRROR" ] && rm -rf "$MIRROR"
    if blocking; then
      printf 'BLOCK: checker aborted unexpectedly\n' >&2
      hc_cleanup 2>/dev/null; exit 2
    fi
    printf 'UNKNOWN: checker aborted unexpectedly; nothing was judged\n' >&2
    hc_cleanup 2>/dev/null; exit 0
  fi
  hc_cleanup 2>/dev/null
  [ -n "${MIRROR:-}" ] && [ -d "$MIRROR" ] && rm -rf "$MIRROR"
  exit "$rc"
}

guard_fail() { # guard_fail <reason>
  if blocking; then
    printf 'BLOCK: %s\n' "$1" >&2
    exit 2
  fi
  printf 'UNKNOWN: %s\n' "$1" >&2
  exit 0
}

HERE=$(cd "$(dirname "$0")" && pwd)
command -v node >/dev/null 2>&1 || guard_fail "node 不存在，本次無法判定"
for lib in "$HERE/lib/hook-payload.mjs" "$HERE/lib/hook-common.sh"; do
  [ -r "$lib" ] || guard_fail "$lib 不存在或不可讀，本次無法判定"
done
. "$HERE/lib/hook-common.sh"
hc_init
trap on_exit EXIT

undecidable() { # undecidable <reason>
  if blocking; then
    emit_err "BLOCK: $1"
    FINISHED=1; hc_flush; exit 2
  fi
  emit_err "UNKNOWN: $1"
  FINISHED=1; hc_flush; exit 0
}

# ── Locate the checkout ──────────────────────────────────────────────
CWD="$PWD"; EVENT_PATH=""
if [ "$MODE" = "event" ]; then
  payload=$(cat)
  if ! printf '%s' "$payload" | node "$HERE/lib/hook-payload.mjs" --event "$EVENT" \
       > "$HC_BUFFER_DIR/records" 2>/dev/null; then
    undecidable "payload 無法解析，本次沒有任何一項被判定"
  fi
  hc_read_nul_list RECS < "$HC_BUFFER_DIR/records"
  for rec in ${RECS+"${RECS[@]}"}; do
    case "${rec%%$'\x1F'*}" in
      cwd)       CWD="${rec#*$'\x1F'}" ;;
      tool_path) EVENT_PATH="${rec#*$'\x1F'}" ;;
    esac
  done
fi

REPO=$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null)
[ -n "$REPO" ] || undecidable "無法從 $CWD 定位 git repo，本次沒有任何一項被判定"

BACKEND=0; [ -d "$REPO/backend" ] && BACKEND=1
FRONTEND=0; [ -d "$REPO/frontend" ] && FRONTEND=1

if [ "$MODE" = "list-routes" ]; then
  emit_out "routes:"
  [ "$BACKEND" = "1" ] && emit_out "  py -> ruff check, mypy (backend/ 存在)" || emit_out "  py -> NA (backend/ 不存在)"
  [ "$FRONTEND" = "1" ] && emit_out "  ts,tsx -> tsc --noEmit, eslint (frontend/ 存在)" || emit_out "  ts,tsx -> NA (frontend/ 不存在)"
  emit_out "  docs/**/*.mdx, docs/**/*.md -> node scripts/check-specs.mjs docs (一律啟用)"
  FINISHED=1; hc_flush; exit 0
fi

# ── The file list ────────────────────────────────────────────────────
CANDIDATES=()
case "$MODE" in
  event) [ -n "$EVENT_PATH" ] && CANDIDATES=("$EVENT_PATH") ;;
  files) CANDIDATES=(${ARGS+"${ARGS[@]}"}) ;;
  range)
    range="${ARGS[0]-}"
    [ -n "$range" ] || undecidable "--range 沒有收到範圍"
    if ! git -C "$REPO" diff --name-only --diff-filter=ACMR -z "$range" \
         > "$HC_BUFFER_DIR/list" 2>/dev/null; then
      undecidable "無法取得 $range 的變更清單"
    fi
    hc_read_nul_list CANDIDATES < "$HC_BUFFER_DIR/list"
    ;;
  staged)
    # ACMR drops deletions, which matches "only files that still exist"; -z
    # keeps paths with spaces and CJK intact.
    if ! git -C "$REPO" diff --cached --name-only --diff-filter=ACMR -z \
         > "$HC_BUFFER_DIR/list" 2>/dev/null; then
      undecidable "無法取得 staged 清單，本次不判為通過"
    fi
    hc_read_nul_list CANDIDATES < "$HC_BUFFER_DIR/list"
    ;;
esac

# ── Exclusions, applied before routing ───────────────────────────────
. "$HERE/lib/hook-routes.sh"
EXCLUDED_RE="$HOOK_EXCLUDED_RE"

PY_FILES=(); TS_FILES=(); DOC_FILES=(); DOC_HITS=0; SKIPPED=0
for cand in ${CANDIDATES+"${CANDIDATES[@]}"}; do
  [ -n "$cand" ] || continue
  case "$cand" in /*) abs="$cand" ;; *) abs="$REPO/$cand" ;; esac
  # Both sides must be resolved before they are compared. `git rev-parse
  # --show-toplevel` hands back a realpath while a payload's file_path keeps
  # whatever symlinked form the platform used, and on macOS $TMPDIR sits under
  # a symlinked /var — so a plain path.relative calls a file in the repository
  # "outside the workspace". resolveTargetPath resolves both.
  rel=$(HOOK_PAYLOAD_LIB="$HERE/lib/hook-payload.mjs" node -e '
    const path = require("node:path");
    const { resolveTargetPath } = require(process.env.HOOK_PAYLOAD_LIB);
    const [root, target] = process.argv.slice(1);
    const { resolved, outsideWorkspace } = resolveTargetPath(target, root);
    let base = root;
    try { base = require("node:fs").realpathSync(root); } catch { /* keep the literal root */ }
    process.stdout.write(outsideWorkspace ? "" : path.relative(base, resolved));
  ' -- "$REPO" "$abs")
  if [ -z "$rel" ]; then
    emit_err "NA: $cand 在 workspace 之外，略過（不在本檢查的範圍內）"
    SKIPPED=$((SKIPPED + 1)); continue
  fi
  # In --staged mode the working tree is not the authority: ACMR already
  # dropped deletions from the list, and a file staged then removed from the
  # working tree is still being committed.
  if [ "$MODE" != "staged" ] && [ ! -f "$REPO/$rel" ]; then
    emit_err "NA: $rel 已不存在（被刪除或改名），略過"
    SKIPPED=$((SKIPPED + 1)); continue
  fi
  if printf '%s' "$rel" | grep -qE "$EXCLUDED_RE"; then
    emit_err "NA: $rel 在排除清單內（產物、migration、lockfile 或 vendor），略過"
    SKIPPED=$((SKIPPED + 1)); continue
  fi
  case "$(hook_route_for "$rel")" in
    py)   PY_FILES+=("$rel") ;;
    ts)   TS_FILES+=("$rel") ;;
    docs) DOC_HITS=1; DOC_FILES+=("$rel") ;;
    *)    emit_err "NA: $rel 沒有命中任何路由" ;;
  esac
done

# ── In --staged mode the tools must see the index, not the working tree ──
#
# A file fixed in the working tree but never staged is not what is being
# committed, so judging the working tree would pass on content nobody is
# about to commit. Stashing would do that by moving the working tree out
# from under the user; materialising the index into a mirror does not touch
# it at all (D13).
CONTENT_ROOT="$REPO"
if [ "$MODE" = "staged" ] && { [ "${#PY_FILES[@]}" -gt 0 ] || [ "${#TS_FILES[@]}" -gt 0 ] || [ "$DOC_HITS" = "1" ]; }; then
  MIRROR=$(mktemp -d "${TMPDIR:-/tmp}/check-changed-index.XXXXXX") || \
    undecidable "無法建立鏡像目錄，本次不判為通過"
  # Whole-tree checks need the whole index; per-file checks need only their
  # own files, which is much cheaper on a large repository.
  if [ "$DOC_HITS" = "1" ] || [ "${#TS_FILES[@]}" -gt 0 ]; then
    git -C "$REPO" checkout-index -a --prefix="$MIRROR/" 2>/dev/null || \
      undecidable "無法把索引物化到鏡像目錄，本次不判為通過"
  fi
  for rel in ${PY_FILES+"${PY_FILES[@]}"} ${TS_FILES+"${TS_FILES[@]}"}; do
    mkdir -p "$MIRROR/$(dirname "$rel")"
    git -C "$REPO" show ":$rel" > "$MIRROR/$rel" 2>/dev/null || \
      undecidable "無法取出 $rel 的 staged 內容，本次不判為通過"
  done
  CONTENT_ROOT="$MIRROR"
fi
cd "$CONTENT_ROOT" || undecidable "無法進入 $CONTENT_ROOT，本次不判為通過"

# ── Run the routed checks ────────────────────────────────────────────
violations=0
RAN=()
run_tool() { # run_tool <label> <command...>
  local label="$1"; shift
  RAN+=("$label")
  if "$@" > "$HC_BUFFER_DIR/tool" 2>&1; then
    emit_err "PASS: $label"
  else
    violations=1
    emit_err "FAIL: $label"
    while IFS= read -r line; do emit_err "    $line"; done < "$HC_BUFFER_DIR/tool"
  fi
}
need_tool() { # need_tool <name> -> 0 when present, else record an explicit failure
  command -v "$1" >/dev/null 2>&1 && return 0
  violations=1
  emit_err "FAIL: $1 不存在，而它所屬的層已經存在（已宣告啟用），這一項無法執行"
  return 1
}

if [ "${#PY_FILES[@]}" -gt 0 ]; then
  if [ "$BACKEND" = "0" ]; then
    emit_err "NA: backend/ 不存在，Python 檢查尚未啟用（${#PY_FILES[@]} 個檔案）"
  else
    # Not a subshell: need_tool records a violation, and a subshell would
    # throw that away while still looking like it had run.
    if need_tool ruff; then run_tool "ruff check" ruff check -- "${PY_FILES[@]}"; fi
    if need_tool mypy; then run_tool "mypy" mypy -- "${PY_FILES[@]}"; fi
  fi
fi

if [ "${#TS_FILES[@]}" -gt 0 ]; then
  if [ "$FRONTEND" = "0" ]; then
    emit_err "NA: frontend/ 不存在，TypeScript 檢查尚未啟用（${#TS_FILES[@]} 個檔案）"
  else
    if need_tool tsc; then run_tool "tsc --noEmit" tsc --noEmit; fi
    if need_tool eslint; then run_tool "eslint" eslint -- "${TS_FILES[@]}"; fi
  fi
fi

if [ "$DOC_HITS" = "1" ]; then
  emit_err "說明：以下是整棵 docs/ 的檢查，診斷可能包含本次沒有改到的檔案；觸發它的是本次變更中的 docs 檔。"
  run_tool "node scripts/check-specs.mjs docs" node "$REPO/scripts/check-specs.mjs" docs
fi

# "Nothing applied" and "the tool for an applicable route is missing" are
# different verdicts. Only the first is not applicable; reporting the second
# as NA would turn an explicit failure into a shrug.
if [ "${#PY_FILES[@]}" -eq 0 ] && [ "${#TS_FILES[@]}" -eq 0 ] && [ "$DOC_HITS" = "0" ]; then
  emit_err "NA: 本次沒有命中任何已啟用的路由"
fi

# ── Evidence: the by-product of a check having really run (D14) ──────
GIT_DIR=$(git -C "$REPO" rev-parse --git-dir 2>/dev/null)
if [ -n "$GIT_DIR" ]; then
  case "$GIT_DIR" in /*) EV="$GIT_DIR/label-suite/evidence" ;; *) EV="$REPO/$GIT_DIR/label-suite/evidence" ;; esac
  mkdir -p "$EV"
  # Every file this run actually routed, not just the two code layers. H6
  # asks for evidence covering each changed file whose route is enabled, and
  # the docs route is always enabled -- leaving its files out meant no
  # docs-only change could ever satisfy H6, which is how the Stop hook came to
  # block a documentation commit on the day it was registered.
  covered=$(printf '%s ' ${PY_FILES+"${PY_FILES[@]}"} ${TS_FILES+"${TS_FILES[@]}"} \
                         ${DOC_FILES+"${DOC_FILES[@]}"})
  # The record has two halves. The first carries text that came from outside —
  # tool names, paths — and goes through the same masking the diagnostics do.
  # The second carries digests this checker computed itself from content that
  # is already in the repository. Masking those would be pointless and
  # destructive: a sha is exactly the shape the base64 rule matches, and the
  # digests are the only reason the record is worth keeping (D14 freshness).
  {
    printf 'command: %s\n' "${RAN[*]:-（無）}"
    printf 'tools: node=%s\n' "$(node --version 2>/dev/null)"
    printf 'exit: %s\n' "$violations"
    printf 'covered: %s\n' "${covered:-（無）}"
    printf 'skipped: %s\n' "$SKIPPED"
  } > "$HC_BUFFER_DIR/evidence"
  # Both digests are taken before the record exists, because a record that
  # cannot carry them is worse than no record at all: H6 compares the stored
  # value against a freshly computed one, so a pair of blanks would match and
  # a stale record would read as current. No record simply makes H6 refuse,
  # which is the safe direction.
  #
  # `cat` with no arguments reads stdin and waits forever, which is what a run
  # that routed nothing would do. The redirect makes the empty case digest
  # empty input instead of hanging.
  if ! rec_content=$(cd "$CONTENT_ROOT" \
       && cat ${PY_FILES+"${PY_FILES[@]}"} ${TS_FILES+"${TS_FILES[@]}"} \
              ${DOC_FILES+"${DOC_FILES[@]}"} </dev/null 2>/dev/null \
       | hc_sha256 2>/dev/null); then
    emit_err "NOTE: 無法計算涵蓋檔案的指紋，本次不留證據記錄"
    rec_content=""
  fi
  if ! rec_agents=$(hc_sha256 "$REPO/AGENTS.md" 2>/dev/null); then
    emit_err "NOTE: 無法計算 AGENTS.md 的指紋，本次不留證據記錄"
    rec_agents=""
  fi
  if [ -n "$rec_content" ] && [ -n "$rec_agents" ]; then
    rec_file="$EV/$(date -u +%Y%m%dT%H%M%SZ)-$$.rec"
    hc_mask < "$HC_BUFFER_DIR/evidence" > "$rec_file"
    {
      printf 'commit: %s\n' "$(git -C "$REPO" rev-parse HEAD 2>/dev/null)"
      printf 'head: %s\n' "$(git -C "$REPO" rev-parse HEAD 2>/dev/null)"
      printf 'content: %s\n' "$rec_content"
      printf 'agents: %s\n' "$rec_agents"
    } >> "$rec_file"
  fi

  # Retention: newest 200 records and under 1 MiB, oldest trimmed first.
  while [ "$(ls -1 "$EV" | wc -l | tr -d ' ')" -gt 200 ]; do
    oldest=$(ls -1t "$EV" | tail -1)
    rm -f "$EV/$oldest"
  done
  while [ "$(du -sk "$EV" | cut -f1)" -gt 1024 ] && [ "$(ls -1 "$EV" | wc -l | tr -d ' ')" -gt 1 ]; do
    oldest=$(ls -1t "$EV" | tail -1)
    rm -f "$EV/$oldest"
  done
fi

FINISHED=1
hc_flush
# H3 reports; it never blocks. The blocking modes encode a violation as 1.
if [ "$MODE" = "event" ]; then exit 0; fi
exit "$violations"
