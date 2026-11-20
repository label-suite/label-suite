#!/usr/bin/env bash
# Tests for scripts/lib/hook-common.sh (issue #111, task 2.3).
#
# This library is the single exit every checker's diagnostics pass through, so
# the masking and the size limit are applied in exactly one place and no caller
# can forget them. The cases below are therefore about what comes *out*.
set -uo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
LIB="$ROOT/scripts/lib/hook-common.sh"

failures=0
fail() { echo "FAIL: $*"; failures=$((failures + 1)); }

# Runs a snippet in a fresh shell with the library sourced, and prints
# stdout and stderr to two files the caller names.
run() { # run <outfile> <errfile> <snippet>
  bash -c "set -uo pipefail; source '$LIB'; $3" >"$1" 2>"$2"
}

TMP=$(mktemp -d "${TMPDIR:-/tmp}/hc-tests.XXXXXX")
trap 'rm -rf "$TMP"' EXIT
O="$TMP/out"; E="$TMP/err"

# ── The two exits go to the two streams ──────────────────────────────

run "$O" "$E" 'hc_init; emit_out "PASS: fine"; emit_err "FAIL: broken"; hc_flush'
grep -q '^PASS: fine$'   "$O" || fail "emit_out did not reach stdout"
grep -q '^FAIL: broken$' "$E" || fail "emit_err did not reach stderr"
grep -q 'broken' "$O" && fail "stderr content leaked into stdout"

run "$O" "$E" 'hc_init; emit_out "a"; emit_out "b"; hc_flush'
[ "$(wc -l < "$O" | tr -d ' ')" = "2" ] || fail "emit_out did not preserve one line per call"

# ── Masking: the three patterns, applied at the single exit ──────────

mask_case() { # mask_case <input> <must-not-appear> <must-appear>
  run "$O" "$E" "hc_init; emit_err \"\$1\"; hc_flush" _ _ 2>/dev/null
  bash -c "set -uo pipefail; source '$LIB'; hc_init; emit_err '$1'; hc_flush" >"$O" 2>"$E"
  if grep -qF "$2" "$E"; then fail "secret survived masking: $1 (saw '$2')"; fi
  if [ -n "${3-}" ] && ! grep -qF "$3" "$E"; then fail "masking ate the context: $1 (lost '$3')"; fi
}

mask_case 'token=abc123supersecret' 'abc123supersecret' 'token'
mask_case 'API_KEY: hunter2hunter2'  'hunter2hunter2'    'API_KEY'
mask_case 'Authorization: Bearer zzzzzzzzzzzz' 'zzzzzzzzzzzz' 'Authorization'
mask_case 'password = correcthorse' 'correcthorse' 'password'
mask_case 'ghp_0123456789abcdefghijklmnopqrstuvwxyz' '0123456789abcdefghij' ''
mask_case 'use sk-abcdefghijklmnopqrstuvwxyz now' 'sk-abcdefghijklmnop' 'use'
mask_case 'xoxb-111111111111-222222222222-aaaaaaaa' 'xoxb-111111111111-222222222222' ''
mask_case 'deadbeefdeadbeefdeadbeefdeadbeef' 'deadbeefdeadbeefdeadbeefdeadbeef' ''

# A short hex string is not a secret and must survive: masking everything is
# the same as masking nothing, because then nobody reads the diagnostics.
bash -c "set -uo pipefail; source '$LIB'; hc_init; emit_err 'sha abc1234 ok'; hc_flush" >"$O" 2>"$E"
grep -qF 'abc1234' "$E" || fail "a short hex string was masked; diagnostics become useless"

# Neither is a file path, and the checkers' whole job is to name one. The
# base64 rule used to span `/`, so any absolute path long enough became `***`
# and the message that said which file was rejected stopped saying it.
for path in \
  '/Users/someone/project/label-suite-oss/scripts/check-command.sh' \
  '/home/runner/work/label-suite/label-suite/scripts/check-env.sh' \
  '/var/folders/79/0g96bw6d4bz_s2x1yqfh7kqr0000gn/T/tmp.AbCdEf/.env.local'
do
  bash -c "set -uo pipefail; source '$LIB'; hc_init; emit_err 'BLOCK: 受保護路徑：$path'; hc_flush" >"$O" 2>"$E"
  grep -qF "$path" "$E" || fail "a file path was masked and the message no longer names it: $path"
done

# The rule still has to catch an actual run of base64, which has no separators.
mask_case 'blob QUJDREVGR0hJSktMTU5PUFFSU1RVVld= end' 'QUJDREVGR0hJSktMTU5PUFFSU1RVVld' 'blob'

# ── hc_mask: the same filter, for text that is not a diagnostic ──────
#
# The evidence records (D14) must be masked exactly like diagnostics, but they
# go to a file rather than to stderr. Reusing the filter is the point: a second
# copy would drift from the first.

printf 'ran with token=abc123supersecret\n' > "$TMP/rec.in"
bash -c "set -uo pipefail; source '$LIB'; hc_init; hc_mask < '$TMP/rec.in' > '$TMP/rec.out'" 2>"$E"
grep -qF 'abc123supersecret' "$TMP/rec.out" && fail "hc_mask let a secret through"
grep -qF 'token' "$TMP/rec.out" || fail "hc_mask ate the context around the secret"

printf '/Users/someone/project/label-suite-oss/scripts/x.sh\n' > "$TMP/rec.in"
bash -c "set -uo pipefail; source '$LIB'; hc_init; hc_mask < '$TMP/rec.in' > '$TMP/rec.out'" 2>"$E"
grep -qF '/Users/someone/project/label-suite-oss/scripts/x.sh' "$TMP/rec.out" \
  || fail "hc_mask mangled a file path"

# ── The size limit ───────────────────────────────────────────────────

[ "$(bash -c "source '$LIB'; printf %s \"\$HC_MAX_BYTES\"")" = "65536" ] \
  || fail "HC_MAX_BYTES is not 65536"

# A long unbroken token is *correctly* collapsed by the masking rules, so the
# size limit must be exercised with text that looks like real diagnostics.
#
# The fixture reaches the inner shell through a file, not the environment. At
# roughly 220 KB it is larger than Linux's 128 KiB ceiling on a single
# environment string, so passing it as `BIG=...` made `bash -c` fail before the
# library ran at all -- the Linux runner reported 83 bytes and no marker, which
# measured the operating system and not the limit under test. macOS allows far
# more, which is why this passed locally and on one runner only.
BIGF="$TMP/big.txt"
for i in $(seq 1 6000); do printf 'line %s: something went wrong here\n' "$i"; done > "$BIGF"
[ "$(wc -c < "$BIGF" | tr -d ' ')" -gt 65536 ] \
  || fail "the size-limit fixture is not bigger than the budget, so it proves nothing"
BIGF="$BIGF" bash -c 'set -uo pipefail; source "$1"; hc_init; emit_err "$(cat "$BIGF")"; hc_flush' \
  _ "$LIB" >"$O" 2>"$E"
bytes=$(wc -c < "$E" | tr -d ' ')
[ "$bytes" -gt 65536 ] || fail "truncated output is smaller than the budget ($bytes)"
grep -q '^TRUNCATED: output exceeded 65536 bytes ([0-9]* bytes dropped)$' "$E" \
  || fail "no TRUNCATED marker in the expected shape"
# The marker is outside the budget, so the payload itself is exactly the budget.
payload=$(grep -v '^TRUNCATED:' "$E" | wc -c | tr -d ' ')
[ "$payload" -le 65537 ] || fail "payload is $payload bytes, budget is 65536 (+1 newline)"

# Multibyte: the cut lands mid-character. 65536 = 3 * 21845 + 1, so a naive
# byte cut leaves one orphan byte and the whole stream stops being decodable.
bash -c "set -uo pipefail; source '$LIB'; hc_init; emit_err \"\$(printf '中%.0s' \$(seq 1 23000))\"; hc_flush" >"$O" 2>"$E"
# node, not iconv: iconv on macOS reports "Inappropriate ioctl for device"
# when its output goes to /dev/null, which has nothing to do with encoding.
if ! node -e '
  const b = require("node:fs").readFileSync(process.argv[1]);
  const d = new TextDecoder("utf-8", { fatal: true });
  try { d.decode(b); } catch (e) { console.error(e.message); process.exit(1); }
' "$E"; then
  fail "truncated multibyte output is not valid UTF-8"
fi
grep -q '^TRUNCATED:' "$E" || fail "multibyte case produced no TRUNCATED marker"
# N must account for the discarded partial character, so the arithmetic closes.
dropped=$(sed -n 's/^TRUNCATED: output exceeded 65536 bytes (\([0-9]*\) bytes dropped)$/\1/p' "$E")
# The byte offset of the marker, not `grep -v | wc -c`: grep terminates the
# last line for you, which inflates the count by one and makes the sum miss.
kept=$(node -e '
  const b = require("node:fs").readFileSync(process.argv[1]);
  process.stdout.write(String(b.indexOf("\nTRUNCATED:")));
' "$E")
orig=$((23000 * 3 + 1))   # the emitted text plus its trailing newline
[ -n "$dropped" ] || fail "could not read the dropped count"
[ $((kept + dropped)) -eq "$orig" ] \
  || fail "arithmetic does not close: kept=$kept dropped=$dropped original=$orig"

# Output under the limit is untouched — no marker, nothing trimmed.
bash -c "set -uo pipefail; source '$LIB'; hc_init; emit_err 'short'; hc_flush" >"$O" 2>"$E"
grep -q 'TRUNCATED' "$E" && fail "a short output was marked as truncated"
[ "$(cat "$E")" = "short" ] || fail "a short output was altered: [$(cat "$E")]"

# Platform parity. Every assertion above is about the shape of the output --
# a marker is present, a count adds up -- and shape is exactly what survives a
# platform difference. This one pins the bytes. The fixture is built by node so
# it is identical everywhere, it exercises all three masking rules, a path that
# must survive them, and a cut that lands inside a three-byte character, and
# the digest is taken by node rather than shasum or sha256sum, which are the
# very BSD/GNU split this check exists to catch. The macOS and Linux runs
# compare against the same constant, so a divergence is a failure on one of
# them rather than something a reader has to notice.
#
# If this fails and the filter was changed on purpose, re-pin the digest in the
# same commit as the change. If it fails and the filter was not touched, the
# platform is the difference, and that is the bug.
node -e '
  const parts = [
    "token = abc123supersecret trailing words\n",
    "ghp_0123456789abcdefghijABCDEFGHIJ\n",
    "blob QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVowMTIzNDU2Nzg5\n",
    "/Users/someone/project/label-suite-oss/scripts/x.sh\n",
    "Authorization: Bearer zzz\n",
  ];
  require("node:fs").writeFileSync(process.argv[1], Buffer.concat([
    Buffer.from(parts.join(""), "utf8"),
    Buffer.from("\u4e2d".repeat(23000), "utf8"),
    Buffer.from("\n", "utf8"),
  ]));
' "$TMP/parity.in"
bash -c "set -uo pipefail; source '$LIB'; hc_init; hc_mask < '$TMP/parity.in' > '$TMP/parity.out'" 2>"$E"
PARITY_EXPECTED=d4fdae39433c293c7dbc8e80ee2defa90eebb4b60c33c576b56f9fd4df8ebb9e
parity_actual=$(node -e '
  const c = require("node:crypto"), f = require("node:fs");
  process.stdout.write(c.createHash("sha256").update(f.readFileSync(process.argv[1])).digest("hex"));
' "$TMP/parity.out")
[ "$parity_actual" = "$PARITY_EXPECTED" ] \
  || fail "filtered bytes differ from the pinned digest on $(uname -s): $parity_actual"

# Truncation must not change the verdict.
bash -c "set -uo pipefail; source '$LIB'; hc_init; emit_err \"\$(printf 'a%.0s' \$(seq 1 70000))\"; hc_flush; exit 2" >"$O" 2>"$E"
[ "$?" -eq 2 ] || fail "truncation changed the exit code"

# ── Digests ──────────────────────────────────────────────────────────

# The whole point of this helper is that failure is never mistaken for a
# value. An empty digest compares equal to the empty digest stored in a stale
# record, which is how H6 came to accept evidence for a file that had since
# been edited when `shasum` was not installed.
d=$(bash -c "set -uo pipefail; source '$LIB'; hc_sha256 '$ROOT/AGENTS.md'") \
  || fail "hc_sha256 failed on a readable file"
[ "${#d}" -eq 64 ] || fail "hc_sha256 returned ${#d} characters, expected 64"

# Same bytes, same digest, whichever way they arrive.
d2=$(bash -c "set -uo pipefail; source '$LIB'; hc_sha256 < '$ROOT/AGENTS.md'")
[ "$d" = "$d2" ] || fail "hc_sha256 disagrees between a file argument and stdin"

# A known vector, so the test cannot pass by agreeing with itself.
e=$(printf '' | bash -c "set -uo pipefail; source '$LIB'; hc_sha256")
[ "$e" = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" ] \
  || fail "hc_sha256 of empty input is not the known SHA-256 of the empty string: $e"

out=$(bash -c "set -uo pipefail; source '$LIB'; hc_sha256 '$TMP/does-not-exist'" 2>/dev/null)
rc=$?
[ "$rc" -ne 0 ] || fail "hc_sha256 reported success on a file it could not read"
[ -z "$out" ] || fail "hc_sha256 printed [$out] when it could not digest"

# ── NUL-separated file lists ─────────────────────────────────────────

# Redirection, not a pipe: a pipe would put the function in a subshell and the
# array would not survive it. The library is meant to be fed `< file`.
printf 'a b.txt\0c\nd.txt\0' > "$TMP/list"
run "$O" "$E" 'hc_init; hc_read_nul_list files < '"$TMP"'/list; printf "%s\n" "${#files[@]}" "${files[0]}" "${files[1]}"; hc_flush'
{ read -r n; read -r f0; read -r f1; } < "$O"
[ "$n" = "2" ]         || fail "hc_read_nul_list read $n entries, expected 2"
[ "$f0" = "a b.txt" ]  || fail "a path with a space was split: [$f0]"
[ "$f1" = "c" ]        || fail "a path with a newline was mangled: [$f1]"

# ── Cleanup removes only what it made ────────────────────────────────

keep=$(mktemp -d "${TMPDIR:-/tmp}/hc-bystander.XXXXXX")
buf=$(bash -c "set -uo pipefail; source '$LIB'; hc_init; printf %s \"\$HC_BUFFER_DIR\"")
[ -n "$buf" ]   || fail "hc_init did not export HC_BUFFER_DIR"
[ ! -d "$buf" ] || fail "the buffer directory outlived the shell that made it: $buf"
[ -d "$keep" ]  || fail "cleanup removed a directory it did not create"
rm -rf "$keep"

if [ "$failures" -gt 0 ]; then
  echo "$failures hook-common test(s) failed."
  exit 1
fi
echo "All hook-common tests passed."
