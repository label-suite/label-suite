#!/usr/bin/env bash
# Shared output plumbing for the hook checkers (issue #111, design D6 and D8).
#
# Sourced, not executed. Every diagnostic a checker produces goes through
# emit_out or emit_err and is held in a buffer until hc_flush runs, so masking
# and the size limit are applied in exactly one place. A caller cannot forget
# them, and a checker that aborts halfway emits nothing half-masked.
#
# Masking and truncation are done by node rather than sed and head: node is
# already required here (D4), the truncation has to understand UTF-8, and
# betting on which flavour of the BSD or GNU toolchain is installed is the
# mistake the contract's own survey warns about.

HC_MAX_BYTES=65536

# Creates the buffer directory and arranges for it to go away, including when
# the shell exits early. Only this directory is removed; anything the caller
# made is its own business.
hc_init() {
  HC_BUFFER_DIR=$(mktemp -d "${TMPDIR:-/tmp}/hook-common.XXXXXX")
  export HC_BUFFER_DIR HC_MAX_BYTES
  : > "$HC_BUFFER_DIR/out"
  : > "$HC_BUFFER_DIR/err"
  trap 'hc_cleanup' EXIT
}

hc_cleanup() {
  [ -n "${HC_BUFFER_DIR:-}" ] && [ -d "$HC_BUFFER_DIR" ] && rm -rf "$HC_BUFFER_DIR"
  return 0
}

# emit_out <text> — one diagnostic line destined for stdout (H1 only).
emit_out() { printf '%s\n' "$1" >> "$HC_BUFFER_DIR/out"; }

# emit_err <text> — one diagnostic line destined for stderr (everything else).
emit_err() { printf '%s\n' "$1" >> "$HC_BUFFER_DIR/err"; }

# The filter: mask, then cut to the budget, then append the marker.
read -r -d '' HC_FILTER_JS <<'JS'
const fs = require('node:fs');
const max = Number(process.env.HC_MAX_BYTES);
const raw = fs.readFileSync(0);
let text = raw.toString('utf8');

// 1. key = value, where the key names a credential. The value runs to the end
//    of the line: a diagnostic that says "token=" and then prints the token
//    four words later is no safer for having masked one word.
text = text.replace(
  /\b(token|secret|password|passwd|api[-_]?key|authorization|bearer)(\s*[=:]\s*|\s+)(.*)$/gim,
  (_m, key, sep) => `${key}${sep}***`,
);
// 2. Well-known credential prefixes, which carry no key name of their own.
text = text.replace(/\b(?:ghp_|github_pat_|sk-|xox[baprs]-)\S+/g, '***');
// 3. A long unbroken run of base64 or hex. Twenty is the shortest length at
//    which this stops matching ordinary words, short hashes and identifiers.
//    The run deliberately stops at `/`: when it spanned separators, every
//    absolute path long enough became `***`, and a checker whose whole job is
//    to say which file it rejected stopped saying it. The cost is a base64
//    blob whose every slash-separated run is under twenty characters, which is
//    narrow next to naming no paths at all (maintainer's ruling, 2026-11-18).
text = text.replace(/\b[A-Za-z0-9+]{20,}={0,2}\b/g, '***');

let out = Buffer.from(text, 'utf8');
if (out.length > max) {
  const original = out.length;
  let end = max;
  // Walk back off a partial character. A continuation byte is 10xxxxxx; the
  // lead byte before it says how many bytes the character needs. If the cut
  // landed inside that character, drop the whole character — the alternative
  // is output that no longer decodes, which is what `head -c` alone produces.
  let start = end - 1;
  while (start >= 0 && (out[start] & 0xc0) === 0x80) start--;
  if (start >= 0) {
    const lead = out[start];
    const needed = lead < 0x80 ? 1 : lead < 0xe0 ? 2 : lead < 0xf0 ? 3 : 4;
    if (start + needed > end) end = start;
  }
  out = out.subarray(0, end);
  const dropped = original - out.length;
  // The marker sits outside the budget on purpose: counting it in could let
  // the notice that output was cut be the thing that gets cut.
  const marker = Buffer.from(
    `\nTRUNCATED: output exceeded ${max} bytes (${dropped} bytes dropped)\n`, 'utf8');
  out = Buffer.concat([out, marker]);
}
fs.writeSync(1, out);
JS

# Applies masking and the size limit, then writes each buffer to its stream.
# Called once, after the verdict is settled, so the exit code never depends on
# whether anything was trimmed.
hc_flush() {
  if [ -s "$HC_BUFFER_DIR/out" ]; then
    node -e "$HC_FILTER_JS" < "$HC_BUFFER_DIR/out"
  fi
  if [ -s "$HC_BUFFER_DIR/err" ]; then
    node -e "$HC_FILTER_JS" < "$HC_BUFFER_DIR/err" >&2
  fi
  : > "$HC_BUFFER_DIR/out"
  : > "$HC_BUFFER_DIR/err"
}

# hc_mask — filters stdin to stdout through the same masking and truncation
# the diagnostics go through. The evidence records (D14) are written to a file
# rather than to a stream, and they must be masked identically; a second copy
# of these patterns would drift from the first.
hc_mask() { node -e "$HC_FILTER_JS"; }

# hc_read_nul_list <array-name> — fills the named array from NUL-separated
# records on stdin, so a path may contain spaces, quotes or newlines.
hc_read_nul_list() {
  local __name="$1" __entry
  eval "$__name=()"
  while IFS= read -r -d '' __entry; do
    eval "$__name+=(\"\$__entry\")"
  done
}
