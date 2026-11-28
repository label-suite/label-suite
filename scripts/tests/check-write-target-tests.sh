#!/usr/bin/env bash
# Tests for scripts/check-write-target.sh (issue #111, task 3.3).
#
# The deny list is quoted from the spec and nothing is added to it here. The
# exceptions are checked *before* the deny list, which is the only reason
# `.env.example` survives a rule that matches `**/.env.*`.
#
# The three-row contrast in the middle is the point of this file. A Claude
# write tool with no path field is an anomaly and blocks; Codex's patch tool
# has no path field by documented design and must NOT block, or every patch on
# that platform is refused; an unknown tool name is still an anomaly.
set -uo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
CHECKER="$ROOT/scripts/check-write-target.sh"

failures=0
fail() { echo "FAIL: $*"; failures=$((failures + 1)); }

TMP=$(mktemp -d "${TMPDIR:-/tmp}/check-wt-tests.XXXXXX")
trap 'rm -rf "$TMP"' EXIT

REPO="$TMP/repo"
mkdir -p "$REPO/config" "$REPO/scripts/tests/fixtures" "$REPO/docs/specs"
git -C "$REPO" init -q
git -C "$REPO" config core.hooksPath /dev/null

# payload <tool> <json-tool-input>
payload() {
  REPO="$REPO" TOOL="$1" INPUT="$2" python3 -c '
import json, os
print(json.dumps({"cwd": os.environ["REPO"], "hook_event_name": "PreToolUse",
                  "tool_name": os.environ["TOOL"],
                  "tool_input": json.loads(os.environ["INPUT"])}))'
}

run() { payload "$1" "$2" >"$TMP/p"; "$CHECKER" <"$TMP/p" >"$TMP/out" 2>"$TMP/err"; echo $?; }

# write <relative-path> -> exit code, for the ordinary Claude Write tool
write() {
  run Write "$(REPO="$REPO" REL="$1" python3 -c \
    'import json, os; print(json.dumps({"file_path": os.environ["REPO"] + "/" + os.environ["REL"]}))')"
}

blocked() { local rc; rc=$(write "$1"); [ "$rc" = "2" ] || fail "$2 — expected exit 2, got $rc: $1"; }
allowed() { local rc; rc=$(write "$1"); [ "$rc" = "0" ] || fail "$2 — expected exit 0, got $rc: $1"; }

# ── The deny list, quoted from the spec ──────────────────────────────

blocked '.env.local'              'the dotted .env form was not refused'
blocked 'config/.env.local'       'a nested dotted .env form was not refused'
blocked '.env'                    'the bare .env was not refused'
blocked 'config/.env'             'a nested bare .env was not refused'
blocked 'certs/server.pem'        'a .pem was not refused'
blocked 'certs/server.key'        'a .key was not refused'
blocked 'keys/my_id_rsa_backup'   'an id_rsa-shaped name was not refused'
blocked 'credentials.json'        'credentials.json was not refused'
blocked 'config/credentials.json' 'a nested credentials.json was not refused'

# ── The exceptions, which are checked first ──────────────────────────

allowed '.env.example'                      'the .env.example exception did not survive the .env rules'
allowed 'config/settings.example'           'a plain *.example was refused'
allowed 'keys/id_rsa.pub'                   'a public key was refused'
allowed 'scripts/tests/fixtures/fake.key'   'a fixture credential was refused'
allowed 'scripts/tests/fixtures/deep/x.pem' 'a nested fixture credential was refused'

# The PRD is deliberately not on the list; H2 stays out of its way.
allowed 'docs/specs/00-prd.mdx' 'H2 interfered with the PRD'

# ── The refusal has to say which path, and what it does not cover ────

# The checker reports the resolved path, because symlinks decide where a write
# actually lands. On macOS $TMPDIR sits under a symlinked /var, so comparing
# against the unresolved path would fail for a reason that is not a defect.
# `pwd -P` rather than a helper process: it resolves symlinks in the shell, and
# it cannot come back empty the way a captured command's output can.
REAL_REPO=$(cd "$REPO" && pwd -P); SEP=/
# On Git Bash the checker names the path the way Windows does, `C:\...\repo\x`,
# because that is the form node resolves to and the one a Windows user can act
# on (#830). cygpath exists only there.
if command -v cygpath >/dev/null 2>&1; then REAL_REPO=$(cygpath -w "$REAL_REPO"); SEP='\'; fi
write '.env.local' >/dev/null
# The message names what it refused, and the failure says what it said instead:
# a one-runner-of-two failure here is a platform difference, and guessing at it
# from the assertion's name alone costs another round trip.
grep -qF "$REAL_REPO$SEP.env.local" "$TMP/err" \
  || fail "the refusal did not name the path it refused; REPO=$REPO REAL_REPO=$REAL_REPO err=$(tr '\n' '|' < "$TMP/err" | cut -c1-300)"
grep -q 'apply_patch' "$TMP/err" || fail "the refusal did not state the patch-tool gap"
grep -q '讀取' "$TMP/err"        || fail "the refusal did not state the missing read interception"
grep -q '權限層' "$TMP/err"      || fail "the refusal did not name the layer that carries those gaps"
grep -q '命令' "$TMP/err"        || fail "the refusal did not say a shell write goes to the command group"
[ -s "$TMP/out" ] && fail "the write-target checker wrote to stdout"

# ── D11's three-row contrast ─────────────────────────────────────────

rc=$(run Write '{}')
[ "$rc" = "2" ] || fail "D11 row 1: Claude Write without file_path did not block (got $rc)"
rc=$(run Edit '{}')
[ "$rc" = "2" ] || fail "D11 row 1: Claude Edit without file_path did not block (got $rc)"
rc=$(run NotebookEdit '{}')
[ "$rc" = "2" ] || fail "D11 row 1: NotebookEdit without notebook_path did not block (got $rc)"

# Codex's patch tool carries only a command field. Blocking on the missing
# path would refuse every patch on that platform, so it reports the gap.
rc=$(run apply_patch '{"command":"*** Begin Patch\n*** Update File: .env\n"}')
[ "$rc" = "0" ] || fail "D11 row 2: apply_patch was blocked for having no path field (got $rc)"
grep -q 'apply_patch' "$TMP/err" || fail "D11 row 2: the gap was not named"
grep -q '權限層' "$TMP/err"       || fail "D11 row 2: the carrying layer was not named"
grep -q '尚未設定' "$TMP/err"     || fail "D11 row 2: it implied the permission layer is configured"
grep -q 'NA:' "$TMP/err"          || fail "D11 row 2: the gap was not marked NA"

# …and it must not try to read the path out of that command field.
rc=$(run apply_patch '{"command":"*** Update File: /etc/passwd"}')
[ "$rc" = "0" ] || fail "D11 row 2: the checker parsed the undocumented command payload (got $rc)"

rc=$(run SomeFutureTool '{}')
[ "$rc" = "2" ] || fail "D11 row 3: an unknown tool without a path did not block (got $rc)"

# ── Outside the workspace is undecidable, and undecidable blocks ─────

rc=$(run Write "$(python3 -c 'import json; print(json.dumps({"file_path": "/tmp/outside-the-workspace.txt"}))')")
[ "$rc" = "2" ] || fail "a write outside the workspace did not block (got $rc)"

# ── D7 guards ────────────────────────────────────────────────────────

# bash is invoked by absolute path rather than found through the stripped
# PATH: on Git Bash `ln -s` copies bash.exe away from the msys-2.0.dll it
# needs, so the copy exits 127 before the checker runs (#830). The symlink
# stays for POSIX, where the checker may still look bash up by name.
BASH_BIN=$(command -v bash)
mkdir -p "$TMP/onlybash" && ln -sf "$(command -v bash)" "$TMP/onlybash/bash"
rc=$(payload Write '{"file_path":"x"}' | env PATH="$TMP/onlybash" "$BASH_BIN" "$CHECKER" >/dev/null 2>&1; echo $?)
[ "$rc" = "2" ] || fail "D7: a missing node did not block (got $rc)"

rc=$(printf 'not json' | "$CHECKER" >/dev/null 2>&1; echo $?)
[ "$rc" = "2" ] || fail "D7: an unparseable payload did not block (got $rc)"

rc=$(printf '{"hook_event_name":"PreToolUse"}' | "$CHECKER" >/dev/null 2>&1; echo $?)
[ "$rc" = "2" ] || fail "D7: a payload missing required fields did not block (got $rc)"

notrepo="$TMP/not-a-repo"; mkdir -p "$notrepo"
rc=$(REPO="$notrepo" python3 -c '
import json, os
print(json.dumps({"cwd": os.environ["REPO"], "hook_event_name": "PreToolUse",
                  "tool_name": "Write", "tool_input": {"file_path": os.environ["REPO"]+"/a.txt"}}))' \
  | "$CHECKER" >/dev/null 2>&1; echo $?)
[ "$rc" = "2" ] || fail "D7: failing to locate the repository did not block (got $rc)"

if [ "$failures" -eq 0 ]; then
  echo "check-write-target-tests: OK"
else
  echo "check-write-target-tests: $failures failure(s)"
  exit 1
fi
