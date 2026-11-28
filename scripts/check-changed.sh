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
CWD="$PWD"; HAVE_CWD=0; EVENT_PATH=""; EVENT_TOOL=""; PATCH_PATHS=(); PATCH_HEADERS=0
if [ "$MODE" = "event" ]; then
  payload=$(cat)
  if ! printf '%s' "$payload" | node "$HERE/lib/hook-payload.mjs" --event "$EVENT" \
       > "$HC_BUFFER_DIR/records" 2>/dev/null; then
    undecidable "payload 無法解析，本次沒有任何一項被判定"
  fi
  hc_read_nul_list RECS < "$HC_BUFFER_DIR/records"
  for rec in ${RECS+"${RECS[@]}"}; do
    case "${rec%%$'\x1F'*}" in
      cwd)       CWD="${rec#*$'\x1F'}"; HAVE_CWD=1 ;;
      tool_name) EVENT_TOOL="${rec#*$'\x1F'}" ;;
      tool_path) EVENT_PATH="${rec#*$'\x1F'}" ;;
      patch_path) PATCH_PATHS+=("${rec#*$'\x1F'}") ;;
      patch_headers) PATCH_HEADERS=1 ;;
    esac
  done
  # Every payload the reader accepts carries cwd, so a reader that exited 0
  # without one did not run (#830: on Windows its entry-point test never
  # matched). The default $PWD would then stand in for a cwd nobody sent.
  [ "$HAVE_CWD" = "1" ] || undecidable "payload 讀取器沒有回傳 cwd，本次沒有任何一項被判定"
fi

REPO=$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null)
[ -n "$REPO" ] || undecidable "無法從 $CWD 定位 git repo，本次沒有任何一項被判定"

BACKEND=0; [ -d "$REPO/backend" ] && BACKEND=1
FRONTEND=0; [ -d "$REPO/frontend" ] && FRONTEND=1

if [ "$MODE" = "list-routes" ]; then
  emit_out "routes:"
  [ "$BACKEND" = "1" ] && emit_out "  backend/**/*.py -> ruff check, mypy --strict (backend/ 存在)" || emit_out "  backend/**/*.py -> NA (backend/ 不存在)"
  [ "$FRONTEND" = "1" ] && emit_out "  frontend/**/*.ts,tsx -> tsc -b, eslint, node scripts/check-component-reuse.mjs (frontend/ 存在)" || emit_out "  frontend/**/*.ts,tsx -> NA (frontend/ 不存在)"
  emit_out "  其他位置的 *.py, *.ts, *.tsx -> NA (不在 backend/、frontend/ 專案內)"
  emit_out "  docs/**/*.mdx, docs/**/*.md -> node scripts/check-specs.mjs docs (一律啟用)"
  FINISHED=1; hc_flush; exit 0
fi

# ── The file list ────────────────────────────────────────────────────
CANDIDATES=()
case "$MODE" in
  event)
    if [ "$EVENT_TOOL" = "apply_patch" ] && [ "$PATCH_HEADERS" = "1" ]; then
      # Codex's apply_patch has no path field. hook-payload.mjs reads the
      # files the patch added, updated or moved to out of its own headers;
      # they are relative to the session's cwd, not to the repository root.
      # The loop below normalises them and drops anything outside the
      # workspace or no longer on disk. A delete-only patch has headers but
      # leaves nothing to check, which ends as NA rather than in the git
      # fallback below.
      for p in ${PATCH_PATHS+"${PATCH_PATHS[@]}"}; do
        case "$p" in
          /*|[A-Za-z]:[/\\]*) CANDIDATES+=("$p") ;;   # POSIX or Windows absolute
          *) CANDIDATES+=("$CWD/$p") ;;
        esac
      done
    elif [ "$EVENT_TOOL" = "apply_patch" ]; then
      # No Add, Update or Delete header at all: the patch text is in a shape this checker
      # does not recognise. Rather than check nothing, take what git reports
      # as changed in this checkout -- tracked files that differ from HEAD
      # (staged or not) plus untracked files that are not ignored. That is a
      # superset of what the patch touched, and the same set H6 later asks
      # evidence for. ACMR leaves deletions out; -z keeps spaces and CJK
      # intact; git only ever names paths inside the checkout.
      if git -C "$REPO" rev-parse -q --verify HEAD >/dev/null 2>&1; then
        git -C "$REPO" diff --name-only --diff-filter=ACMR -z HEAD \
          > "$HC_BUFFER_DIR/list" 2>/dev/null \
          || undecidable "無法取得 apply_patch 之後的變更清單，本次沒有任何一項被判定"
      else
        # No commit yet: everything in the index is new.
        git -C "$REPO" ls-files --cached -z > "$HC_BUFFER_DIR/list" 2>/dev/null \
          || undecidable "無法取得 apply_patch 之後的變更清單，本次沒有任何一項被判定"
      fi
      git -C "$REPO" ls-files --others --exclude-standard -z \
        >> "$HC_BUFFER_DIR/list" 2>/dev/null \
        || undecidable "無法取得 apply_patch 之後的未追蹤檔案清單，本次沒有任何一項被判定"
      hc_read_nul_list CANDIDATES < "$HC_BUFFER_DIR/list"
      emit_err "說明：apply_patch 的命令裡讀不到檔案標頭，候選檔案改取這個 checkout 相對 HEAD 的全部變更，可能包含這次 patch 之前就已改動的檔案。"
    elif [ -n "$EVENT_PATH" ]; then
      CANDIDATES=("$EVENT_PATH")
    fi
    ;;
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
  case "$cand" in /*|[A-Za-z]:[/\\]*) abs="$cand" ;; *) abs="$REPO/$cand" ;; esac
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
    try { base = require("node:fs").realpathSync.native(root); } catch { /* keep the literal root */ }
    process.stdout.write(outsideWorkspace ? "" : path.relative(base, resolved).split(path.sep).join("/"));
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
    *)
      if hook_route_outside_project "$rel"; then
        emit_err "NA: $rel 不在 backend/ 或 frontend/ 專案內，那兩條路由的工具設定只涵蓋各自的專案，略過"
      else
        emit_err "NA: $rel 沒有命中任何路由"
      fi
      ;;
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
  # Python needs the whole index too, not only the changed files: the tools run
  # with `backend/` as their working directory (see the Python route below), so
  # `backend/pyproject.toml` has to be there for ruff's `per-file-ignores` to
  # match, and the package tree has to be there or `mypy --strict` reports every
  # `app.*` import in a staged test as unresolvable.
  if [ "$DOC_HITS" = "1" ] || [ "${#TS_FILES[@]}" -gt 0 ] || [ "${#PY_FILES[@]}" -gt 0 ]; then
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
cd "$CONTENT_ROOT" || undecidable "無法進入 ${CONTENT_ROOT}，本次不判為通過"

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
    # `ruff` and `mypy` are not on PATH here -- `uv sync` installs them into
    # `backend/.venv` -- so they are reached through the project's own runner,
    # the spelling `openspec/config.yaml` and backend-agent-rules B2 both use.
    # `--no-sync` keeps a hook from provisioning an environment behind the
    # author's back; an unprovisioned one fails loudly instead.
    #
    # Working directory, not `--config`, is what decides how ruff resolves
    # `per-file-ignores`: measured, `"tests/**" = ["S101"]` stops matching the
    # moment ruff runs from anywhere but `backend/`, whatever `--config` says,
    # and every `assert` in a staged test is then reported. So the tools run
    # with `backend/` as their working directory -- the mirror's under
    # `--staged`, the checkout's otherwise -- and are named the files relative
    # to it, while `--project` keeps pointing at the real checkout, which is
    # where the environment lives.
    # The two tools do not cover the same files, and `openspec/config.yaml` is
    # where that is settled: `ruff check .` is the whole of `backend/`, while
    # `mypy --strict app` is the application package only. Running `--strict`
    # over `backend/tests/` as well reports errors on code the repository has
    # never type-checked -- measured: 12 of them on files this change never
    # touched -- so the per-file form keeps each tool to its own scope.
    PY_REL=(); PY_APP=()
    for rel in "${PY_FILES[@]}"; do
      case "$rel" in
        backend/*) PY_REL+=("${rel#backend/}") ;;
        *)         PY_REL+=("../$rel") ;;
      esac
      case "$rel" in backend/app/*) PY_APP+=("${rel#backend/}") ;; esac
    done
    if need_tool uv; then
      PY_RUN=(uv run --directory "$CONTENT_ROOT/backend" --project "$REPO/backend" --no-sync)
      run_tool "ruff check" "${PY_RUN[@]}" ruff check -- "${PY_REL[@]}"
      if [ "${#PY_APP[@]}" -gt 0 ]; then
        run_tool "mypy --strict" "${PY_RUN[@]}" mypy --strict -- "${PY_APP[@]}"
      else
        emit_err "NA: 本次沒有 backend/app/ 底下的檔案，而 mypy --strict 的範圍是 app（openspec/config.yaml）"
      fi
    fi
  fi
fi

if [ "${#TS_FILES[@]}" -gt 0 ]; then
  if [ "$FRONTEND" = "0" ]; then
    emit_err "NA: frontend/ 不存在，TypeScript 檢查尚未啟用（${#TS_FILES[@]} 個檔案）"
  else
    # Same shape as the Python route above, for the same reason: `tsc` and
    # `eslint` are not on PATH, they are in `frontend/node_modules/.bin`, so
    # they are reached through the project's own runner -- the spelling
    # `openspec/config.yaml` uses. `pnpm exec` installs nothing; a checkout
    # whose dependencies are not installed fails loudly instead.
    #
    # The two tools differ in scope the way the Python pair does, and here it
    # is not a choice: `eslint` takes files, while `tsc -b` type-checks the
    # project, because a file compiled on its own sees none of the project's
    # configuration. `tsconfig.json` sets `noEmit`, so `-b` writes only its
    # build-info file, under `node_modules`.
    TS_REL=()
    for rel in "${TS_FILES[@]}"; do
      case "$rel" in
        frontend/*) TS_REL+=("${rel#frontend/}") ;;
        *)          TS_REL+=("../$rel") ;;
      esac
    done
    if need_tool pnpm; then
      # Under --staged the content is the index mirror, which carries no
      # `node_modules` -- it is not in the index. Linking the installed one in
      # is what `--project` does for uv on the Python side: the files judged
      # are the staged ones, the toolchain is the checkout's.
      if [ "$CONTENT_ROOT" != "$REPO" ] && [ ! -e "$CONTENT_ROOT/frontend/node_modules" ]; then
        ln -sfn "$REPO/frontend/node_modules" "$CONTENT_ROOT/frontend/node_modules" || \
          undecidable "無法把已安裝的前端工具鏈接進鏡像，本次不判為通過"
      fi
      TS_RUN=(pnpm -C "$CONTENT_ROOT/frontend" exec)
      run_tool "tsc -b" "${TS_RUN[@]}" tsc -b
      run_tool "eslint" "${TS_RUN[@]}" eslint -- "${TS_REL[@]}"
    fi
    # A whole-tree check, like tsc -b: a component file is judged against
    # every design-system spec, not only against the files that changed. It
    # needs node only, so it runs even when pnpm is missing.
    run_tool "node scripts/check-component-reuse.mjs" \
      node "$HERE/check-component-reuse.mjs" "$CONTENT_ROOT"
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
  # Space-separated, each path percent-encoded (hc_path_encode), so a name
  # with a space in it is still one entry when check-evidence reads it back.
  covered=""
  for rel in ${PY_FILES+"${PY_FILES[@]}"} ${TS_FILES+"${TS_FILES[@]}"} \
             ${DOC_FILES+"${DOC_FILES[@]}"}; do
    covered="$covered$(hc_path_encode "$rel") "
  done
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
