#!/usr/bin/env bash
# H2, the command half: refuse forbidden commands before they run (#111, D10).
#
# This is a string analyser. It never executes the command it is judging, and
# the only thing it does run is git, against a path it resolved itself, to ask
# which branch a checkout is on.
#
# Fail-closed by construction (D7): the guards below all exit 2, an unexpected
# abort exits 2 through the trap, and the three undecidable shapes exit 2 as
# well. Nothing on the verdict path swallows a non-zero status.
set -uo pipefail

EXIT_BLOCK=2
# D7 wants any *unexpected* end to become a block. An ERR trap is the wrong
# tool for that without `set -e`: it fires on every non-zero command, so an
# ordinary failing test would refuse a harmless command. A sentinel set
# immediately before each intended exit tells the two apart.
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
  printf 'BLOCK: node is not available, so this command cannot be judged\n' >&2; exit "$EXIT_BLOCK"; }
for lib in "$HERE/lib/hook-payload.mjs" "$HERE/lib/hook-common.sh"; do
  [ -r "$lib" ] || {
    printf 'BLOCK: %s is missing or unreadable, so this command cannot be judged\n' "$lib" >&2
    exit "$EXIT_BLOCK"; }
done
. "$HERE/lib/hook-common.sh"
hc_init
trap on_exit EXIT

payload=$(cat)
if ! printf '%s' "$payload" | node "$HERE/lib/hook-payload.mjs" --event PreToolUse \
     > "$HC_BUFFER_DIR/records" 2>"$HC_BUFFER_DIR/perr"; then
  emit_err "BLOCK: payload 無法解析，本次命令不判為通過（$(cat "$HC_BUFFER_DIR/perr" 2>/dev/null | head -1)）"
  FINISHED=1; hc_flush; exit "$EXIT_BLOCK"
fi

CWD=""; COMMAND=""; HAS_COMMAND=0
hc_read_nul_list RECS < "$HC_BUFFER_DIR/records"
for rec in ${RECS+"${RECS[@]}"}; do
  name="${rec%%$'\x1F'*}"; value="${rec#*$'\x1F'}"
  case "$name" in
    cwd)          CWD="$value" ;;
    tool_command) COMMAND="$value"; HAS_COMMAND=1 ;;
  esac
done

# Every PreToolUse payload the reader accepts carries cwd, so a successful
# reader that handed back no cwd did not do its job. Before this guard that
# case fell through to the line below and was read as "no command field":
# on Windows the reader's entry-point test never matched, node exited 0 with
# no records, and `rm -rf` was allowed. Without cwd, "no command" is not a
# finding this checker can trust.
if [ -z "$CWD" ]; then
  emit_err "BLOCK: payload 讀取器沒有回傳 cwd，無法確認這次呼叫有沒有命令，本次命令不判為通過"
  FINISHED=1; hc_flush; exit "$EXIT_BLOCK"
fi

# No command field means this call is not the command half's business.
[ "$HAS_COMMAND" = "1" ] || { FINISHED=1; hc_flush; exit 0; }

REPO=$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null)
if [ -z "$REPO" ]; then
  emit_err "BLOCK: 無法從 $CWD 定位 git repo，本次命令不判為通過"
  FINISHED=1; hc_flush; exit "$EXIT_BLOCK"
fi

read -r -d '' ANALYSE_JS <<'JS'
// Decides whether one command string is forbidden. Pure analysis: the command
// is never executed. `git symbolic-ref` is the one thing spawned, and only
// against a path resolved here, passed as argv so no shell sees it.
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
// Both inputs arrive as files, not argv. Git Bash rewrites an argument that
// starts with `/` into a Windows path before node sees it, so `/bin/rm -rf x`
// passed as argv reached the analyser as `C:/Program Files/Git/usr/bin/rm
// -rf x`, whose first word is `C:/Program`. A file's content is never touched.
const [repoFile, sourceFile] = process.argv.slice(2);
const repo = readFileSync(repoFile, 'utf8');
const source = readFileSync(sourceFile, 'utf8');

const findings = [];
const block = (rule, detail) => findings.push(['BLOCK', rule, detail]);
const undecidable = (detail) => findings.push(['UNDECIDABLE', '', detail]);

// ── Strip heredoc bodies ─────────────────────────────────────────────
// `git commit -F - <<EOF … EOF` carries prose, and prose is not execution.
function stripHeredocs(text) {
  const lines = text.split('\n');
  const kept = [];
  for (let i = 0; i < lines.length; i += 1) {
    kept.push(lines[i]);
    const m = /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/.exec(lines[i]);
    if (!m) continue;
    const delim = m[2];
    i += 1;
    while (i < lines.length && lines[i].trim() !== delim) i += 1;
  }
  return kept.join('\n');
}

// ── Split into segments at unquoted separators ───────────────────────
// A separator inside quotes is text, which is what lets a commit message
// mention `rm -rf` without being taken for an execution.
function split(text) {
  const segments = [];
  let buf = '', quote = null, depth = 0, startsWithSubst = false, atStart = true;
  let unbalanced = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quote === "'") { if (c === "'") quote = null; buf += c; continue; }
    if (c === '\\' && quote !== "'") { buf += c + (text[i + 1] ?? ''); i += 1; atStart = false; continue; }
    if (quote === '"') {
      if (c === '"') quote = null;
      else if (c === '$' && text[i + 1] === '(') { depth += 1; buf += c; i += 1; buf += '('; continue; }
      else if (c === ')' && depth > 0) depth -= 1;
      buf += c; continue;
    }
    if (c === "'" || c === '"') { quote = c; buf += c; atStart = false; continue; }
    if (c === '$' && text[i + 1] === '(') {
      if (atStart && depth === 0) startsWithSubst = true;
      depth += 1; buf += '$('; i += 1; atStart = false; continue;
    }
    if (c === '`') { if (atStart && depth === 0) startsWithSubst = true; buf += c; atStart = false; continue; }
    if (c === ')' && depth > 0) { depth -= 1; buf += c; continue; }
    if (depth === 0 && (c === ';' || c === '\n' || c === '|' || c === '&' || c === '(' || c === ')')) {
      segments.push({ text: buf, startsWithSubst });
      buf = ''; startsWithSubst = false; atStart = true;
      if ((c === '|' || c === '&') && text[i + 1] === c) i += 1;
      continue;
    }
    if (!/\s/.test(c)) atStart = false;
    buf += c;
  }
  if (quote !== null) unbalanced = true;
  segments.push({ text: buf, startsWithSubst });
  return { segments, unbalanced };
}

// ── argv for one segment, remembering which words were literal ───────
function tokenise(text) {
  const tokens = [];
  let cur = null, quote = null, literal = true;
  const push = () => { if (cur !== null) { tokens.push({ value: cur, literal }); cur = null; literal = true; } };
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quote === "'") { if (c === "'") quote = null; else cur += c; continue; }
    if (quote === '"' && c === '\\') {
      // Inside double quotes a backslash escapes only $ ` " \ and newline, as
      // in bash; anywhere else it is a literal, which is what keeps a quoted
      // Windows path such as "C:\...\rm.exe" intact.
      const next = text[i + 1] ?? '';
      if ('$`"\\\n'.includes(next) && next !== '') { cur += next; i += 1; } else cur += c;
      continue;
    }
    if (c === '\\') { cur = (cur ?? '') + (text[i + 1] ?? ''); i += 1; continue; }
    if (quote === '"') {
      if (c === '"') { quote = null; continue; }
      if (c === '$' || c === '`') literal = false;
      cur += c; continue;
    }
    if (c === "'" || c === '"') { quote = c; cur = cur ?? ''; continue; }
    if (/\s/.test(c)) { push(); continue; }
    if (c === '#' && cur === null) break;          // a comment, not a word
    if (c === '$' || c === '`') literal = false;
    cur = (cur ?? '') + c;
  }
  push();
  return tokens;
}

const branchOf = (dir) => {
  try {
    return execFileSync('git', ['-C', dir, 'symbolic-ref', '--short', 'HEAD'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return null; }
};
const upstreamOf = (dir) => {
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return null; }
};
const isMain = (name) => name === 'main' || name === 'refs/heads/main';

// ── The rule table (D10) ─────────────────────────────────────────────
function judge(tokens, depthGuard) {
  while (tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0].value)) tokens.shift();
  if (!tokens.length) return;
  const argv = tokens.map((t) => t.value);
  // The command's own name, whatever path or spelling reached it: Windows
  // accepts `\` as a separator, an `.exe` suffix and any letter case, so
  // `C:\...\RM.EXE` is rm there. Folding case blocks more on POSIX, never less.
  const name = argv[0].split(/[\\/]/).pop().replace(/\.exe$/i, '').toLowerCase();

  if (['eval', 'sh', 'bash', 'zsh'].includes(name)) {
    const idx = name === 'eval' ? 1 : argv.indexOf('-c') + 1;
    const arg = name === 'eval' ? tokens[1] : tokens[idx];
    if (name !== 'eval' && argv.indexOf('-c') === -1) { /* an interactive shell, nothing to judge */ }
    else if (!arg) undecidable(`${name} 沒有可分析的字面參數`);
    else if (!arg.literal) undecidable(`${name} 的參數不是字面字串，無法靜態分析`);
    else if (depthGuard > 0) analyse(arg.value, depthGuard - 1);
    return;
  }

  if (name === 'rm') {
    let recursive = false, force = false;
    for (const a of argv.slice(1)) {
      if (a === '--recursive') recursive = true;
      else if (a === '--force') force = true;
      else if (/^-[A-Za-z]+$/.test(a)) {
        if (/[rR]/.test(a)) recursive = true;
        if (/f/.test(a)) force = true;
      }
    }
    if (recursive && force) block('AGENTS.md 硬性規則 10', 'rm 的遞迴加強制刪除');
    return;
  }

  if (name !== 'git') {
    if ((name === 'pip' || name === 'pip3') && argv[1] === 'install') {
      block('AGENTS.md 硬性規則 3', '本 repo 用 `uv add`，不用 pip install');
    }
    if (name === 'npm' && ['install', 'i', 'add'].includes(argv[1])) {
      block('AGENTS.md 硬性規則 3', '本 repo 用 `pnpm add`，不用 npm install');
    }
    return;
  }

  // git: resolve the target checkout from the global options first.
  let dir = repo, i = 1;
  for (; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '-C') { dir = argv[i + 1] ?? dir; i += 1; continue; }
    if (a.startsWith('--git-dir=')) { dir = a.slice(10).replace(/\/\.git$/, ''); continue; }
    if (a === '--git-dir') { dir = (argv[i + 1] ?? dir).replace(/\/\.git$/, ''); i += 1; continue; }
    if (a.startsWith('--work-tree=')) { dir = a.slice(12); continue; }
    if (a === '--work-tree') { dir = argv[i + 1] ?? dir; i += 1; continue; }
    if (a.startsWith('-')) continue;
    break;
  }
  const sub = argv[i];
  const rest = argv.slice(i + 1);

  if (sub === 'reset' && rest.includes('--hard')) {
    block('AGENTS.md 硬性規則 10', 'git reset --hard');
  }
  if (sub === 'branch') {
    if (rest.includes('-D')) block('AGENTS.md 硬性規則 10', 'git branch -D');
    else if ((rest.includes('-d') || rest.includes('--delete')) && rest.includes('--force')) {
      block('AGENTS.md 硬性規則 10（D10 的等價寫法）', 'git branch -d --force');
    }
  }
  if (sub === 'push') {
    const forced = rest.some((a) => a === '--force' || a === '-f'
      || a === '--force-with-lease' || a.startsWith('--force-with-lease='));
    if (forced) block('AGENTS.md 硬性規則 10', 'git push 的強制推送');
    const operands = rest.filter((a) => !a.startsWith('-'));
    const refspecs = operands.slice(1);
    for (const spec of refspecs) {
      if (spec.startsWith('+')) block('AGENTS.md 硬性規則 10（D10：+ refspec 等同強制更新）', spec);
      const dst = spec.includes(':') ? spec.split(':').pop() : spec;
      if (isMain(dst)) block('AGENTS.md 硬性規則 2', `推送目標是 ${dst}`);
    }
    if (refspecs.length === 0) {
      const up = upstreamOf(dir);
      if (up && isMain(up.split('/').pop())) block('AGENTS.md 硬性規則 2', `上游分支是 ${up}`);
    }
  }
  if (sub === 'commit') {
    const branch = branchOf(dir);
    if (branch === null) undecidable(`無法判定 ${dir} 目前在哪一個分支`);
    else if (isMain(branch)) block('AGENTS.md 硬性規則 2', `${dir} 目前在 ${branch}`);
  }
}

function analyse(text, depthGuard) {
  const { segments, unbalanced } = split(stripHeredocs(text));
  if (unbalanced) { undecidable('引號不成對，無法切詞'); return; }
  for (const seg of segments) {
    if (!seg.text.trim()) continue;
    if (seg.startsWithSubst) { undecidable('命令位置本身是命令替換'); continue; }
    judge(tokenise(seg.text), depthGuard);
  }
}

analyse(source, 2);
// 0x1F between fields, not a tab. A tab is IFS whitespace, so bash collapses a
// run of them into one delimiter and an empty field vanishes: an UNDECIDABLE
// finding carries no rule, so its reason shifted into `rule` and `detail` read
// empty, and the line came out as `無法判斷（），依規定不判為通過`.
for (const [kind, rule, detail] of findings) process.stdout.write(`${kind}\x1f${rule}\x1f${detail}\n`);
// The last line says the analysis ran to the end. Its absence is how the shell
// tells an analyser that died, or never started, from one that found nothing.
process.stdout.write('END\x1f\x1f\n');
JS

# The script, the repository and the command each go through a file; see the
# comment at the top of ANALYSE_JS for why argv is not safe on Windows.
printf '%s' "$ANALYSE_JS" > "$HC_BUFFER_DIR/analyse.cjs"
printf '%s' "$REPO"       > "$HC_BUFFER_DIR/repo"
printf '%s' "$COMMAND"    > "$HC_BUFFER_DIR/command"

# Fail closed: the verdict is "allow" only when node exited 0 AND printed the
# END line. Reading node's output through `< <(...)` discarded its exit status,
# so an analyser that could not run produced no findings and was allowed.
if ! node "$HC_BUFFER_DIR/analyse.cjs" "$HC_BUFFER_DIR/repo" "$HC_BUFFER_DIR/command" \
     > "$HC_BUFFER_DIR/findings" 2>"$HC_BUFFER_DIR/aerr" \
   || [ "$(tail -n 1 "$HC_BUFFER_DIR/findings")" != $'END\x1f\x1f' ]; then
  emit_err "BLOCK: 命令分析沒有完整執行，本次命令不判為通過（$(head -1 "$HC_BUFFER_DIR/aerr" 2>/dev/null)）"
  FINISHED=1; hc_flush; exit "$EXIT_BLOCK"
fi

verdict=0
while IFS=$'\x1f' read -r kind rule detail; do
  [ -n "$kind" ] || continue
  [ "$kind" = "END" ] && continue
  verdict=1
  case "$kind" in
    BLOCK)       emit_err "BLOCK: 觸犯 $rule — $detail" ;;
    UNDECIDABLE) emit_err "BLOCK: 無法判斷（${detail}），依規定不判為通過" ;;
    *)           emit_err "BLOCK: 命令分析回傳了無法辨識的結果，本次命令不判為通過" ;;
  esac
done < "$HC_BUFFER_DIR/findings"

if [ "$verdict" = "1" ]; then
  emit_err "  說明：這是字串比對，涵蓋不了變數展開、編碼過的命令與動態組出來的命令。真正的邊界在平台權限層與遠端的 branch protection，本檢查只擋明顯的寫法。"
  FINISHED=1; hc_flush
  exit "$EXIT_BLOCK"
fi
FINISHED=1; hc_flush
exit 0
