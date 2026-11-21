// Parses and validates the JSON payload an agent hook delivers on stdin, and
// hands the few fields the shell checkers need back as framed records.
// Issue #111, design decision D4.
//
// Every caller downstream is a shell script, so this module's contract is
// deliberately narrow: it emits only names from a fixed allowlist, it never
// expands a value, and it refuses anything it cannot vouch for rather than
// passing it on. Refusal is exit code 3, which is outside the 0/1/2 verdict
// vocabulary the checkers share (D2), so a caller can tell "the payload was
// unusable" apart from "the check said no".
import { readSync, realpathSync } from "node:fs";
import path from "node:path";

/** Exit code for a payload that cannot be parsed or is missing a field. */
export const EXIT_BAD_PAYLOAD = 3;

/** Field names each event must carry, per the hook contract's H1/H2/H3/H6 rows. */
export const REQUIRED_FIELDS = {
  SessionStart: ["cwd", "hook_event_name"],
  PreToolUse: ["tool_name", "tool_input", "cwd"],
  PostToolUse: ["tool_name", "tool_input", "cwd"],
  Stop: ["stop_hook_active", "cwd"],
  SubagentStop: ["stop_hook_active", "cwd"],
};

// Where each write tool keeps its target path. Codex's apply_patch is absent on
// purpose: the official documentation records only tool_input.command for it,
// with no separate path field (completion-report.md §1.4), so a missing path
// there is the documented normal case rather than an anomaly. D11 turns that
// distinction into two different verdicts, which it can only do if this table
// stays silent about apply_patch.
export const PATH_FIELDS = {
  Edit: "file_path",
  Write: "file_path",
  NotebookEdit: "notebook_path",
};

/** The only names this module will ever emit. */
export const RECORD_NAMES = [
  "event",
  "cwd",
  "tool_name",
  "tool_path",
  "tool_command",
  "stop_hook_active",
];

const RECORD_SEP = "\0";
const FIELD_SEP = "\x1F";

/**
 * Resolves `target` as far as the filesystem allows and reports whether it
 * lands outside `workspaceRoot`.
 *
 * Symlinks are followed, because the boundary question is about where a write
 * actually lands, not where it was addressed. A path that does not exist yet is
 * still answerable: its nearest existing ancestor is resolved and the remainder
 * appended, so a write to a new file in a new directory is bounded correctly.
 */
export function resolveTargetPath(target, workspaceRoot) {
  const absolute = path.resolve(workspaceRoot, target);
  let resolved = absolute;
  let remainder = "";
  // Walk up until something exists, then resolve that and re-append the rest.
  for (let probe = absolute; ;) {
    try {
      resolved = path.join(realpathSync(probe), remainder);
      break;
    } catch {
      const parent = path.dirname(probe);
      if (parent === probe) {
        resolved = absolute;
        break;
      }
      remainder = path.join(path.basename(probe), remainder);
      probe = parent;
    }
  }
  let root = workspaceRoot;
  try {
    root = realpathSync(workspaceRoot);
  } catch {
    /* keep the literal root */
  }
  // The separator matters: /tmp/ws-evil shares a prefix with /tmp/ws but is not
  // inside it.
  const outsideWorkspace = resolved !== root && !resolved.startsWith(root + path.sep);
  return { resolved, outsideWorkspace };
}

/**
 * Validates `raw` against the event's required fields and extracts the
 * allowlisted records. Returns `{ ok: false, reason }` rather than throwing, so
 * the caller decides what a refusal costs.
 */
export function parsePayload(raw, eventName) {
  const required = REQUIRED_FIELDS[eventName];
  if (!required) return { ok: false, reason: `unknown event name: ${eventName}` };

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    return { ok: false, reason: `payload is not valid JSON: ${error.message}` };
  }
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, reason: "payload is not a JSON object" };
  }

  // Presence, not truthiness: stop_hook_active false means "not a re-entry",
  // which is the case the guard exists for.
  const missing = required.filter((field) => !Object.hasOwn(payload, field));
  if (missing.length > 0) {
    return { ok: false, reason: `payload is missing required field(s): ${missing.join(", ")}` };
  }

  const records = [["event", eventName]];
  records.push(["cwd", String(payload.cwd)]);

  if (Object.hasOwn(payload, "tool_name")) {
    const toolName = String(payload.tool_name);
    records.push(["tool_name", toolName]);
    const input = payload.tool_input;
    if (input !== null && typeof input === "object" && !Array.isArray(input)) {
      const pathField = PATH_FIELDS[toolName];
      if (pathField && typeof input[pathField] === "string") {
        records.push(["tool_path", input[pathField]]);
      }
      if (typeof input.command === "string") {
        records.push(["tool_command", input.command]);
      }
    }
  }
  if (Object.hasOwn(payload, "stop_hook_active")) {
    records.push(["stop_hook_active", payload.stop_hook_active ? "true" : "false"]);
  }

  return { ok: true, records };
}

/**
 * Frames records as `name<0x1F>value<NUL>`, which bash reads with
 * `read -r -d ''`. A value may contain anything a path or command can contain,
 * including newlines and quotes — but not the two framing bytes, and a value
 * carrying one is refused rather than silently cut short.
 */
export function formatRecords(records) {
  let out = "";
  for (const [name, value] of records) {
    if (!RECORD_NAMES.includes(name)) throw new Error(`record name not on the allowlist: ${name}`);
    const text = String(value);
    if (text.includes("\0")) throw new Error(`value for ${name} contains a NUL (0x00) byte`);
    if (text.includes(FIELD_SEP)) throw new Error(`value for ${name} contains the 0x1F separator`);
    out += `${name}${FIELD_SEP}${text}${RECORD_SEP}`;
  }
  return out;
}

// ── Command-line entry point ──────────────────────────────────────────
//
// Usage: node scripts/lib/hook-payload.mjs --event <EventName> < payload.json
//
// The event name is the only thing that comes from argv, and it is matched
// against a fixed table rather than used. Everything untrusted arrives on
// stdin, so no part of a payload is ever word-split by a shell on its way in
// (D2's core invariant). On success the framed records go to stdout and the
// exit code is 0; on refusal stdout stays empty, the reason goes to stderr and
// the exit code is 3.
function readStdin() {
  const chunks = [];
  const fd = 0;
  const buffer = Buffer.alloc(65536);
  for (;;) {
    let bytes;
    try {
      bytes = readSync(fd, buffer, 0, buffer.length, null);
    } catch (error) {
      if (error.code === "EAGAIN") continue;
      if (error.code === "EOF") break;
      throw error;
    }
    if (bytes === 0) break;
    chunks.push(Buffer.from(buffer.subarray(0, bytes)));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function main(argv) {
  if (argv.length !== 2 || argv[0] !== "--event") {
    process.stderr.write("BLOCK: usage: hook-payload.mjs --event <EventName> (payload on stdin)\n");
    return EXIT_BAD_PAYLOAD;
  }
  const result = parsePayload(readStdin(), argv[1]);
  if (!result.ok) {
    process.stderr.write(`BLOCK: ${result.reason}\n`);
    return EXIT_BAD_PAYLOAD;
  }
  try {
    process.stdout.write(formatRecords(result.records));
  } catch (error) {
    process.stderr.write(`BLOCK: ${error.message}\n`);
    return EXIT_BAD_PAYLOAD;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = main(process.argv.slice(2));
}
