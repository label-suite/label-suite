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
import { fileURLToPath } from "node:url";

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
//
// Staying silent here does not leave H3 blind. H2 must not read paths out of
// the patch text: the format is undocumented, and the 2026-11-17 ruling chose
// to state the gap rather than build a protection on it. H3 only reports, and
// its spec limits it to the files this edit touched, so for apply_patch this
// module offers the paths named in the patch's own file headers as separate
// patch_path records, plus a patch_headers marker (see readPatch below). They never become tool_path, so
// check-write-target.sh still sees no path and keeps its documented NA. When
// the headers are absent or unreadable, check-changed.sh falls back to what
// git reports as changed in the checkout.
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
  "patch_path",
  "patch_headers",
  "stop_hook_active",
];

/**
 * Lists the files an apply_patch envelope leaves behind: every `*** Add File:`
 * and `*** Update File:` header, with an `*** Move to:` line replacing the
 * path of the update it follows. `*** Delete File:` paths are left out, since
 * a deleted file is nothing to check. Paths are returned exactly as written
 * (relative ones are relative to the session's cwd); the caller normalises
 * them and confines them to the workspace. A path carrying a control
 * character cannot be framed safely and is dropped rather than truncated.
 *
 * `sawHeader` says whether any Add, Update or Delete header was found at
 * all, so a delete-only patch (headers, but nothing left to check) can be
 * told apart from text this reader does not recognise.
 *
 * This reads a format the official documentation does not describe, so it
 * is only ever used to narrow a report, never to grant or refuse anything.
 */
export function readPatch(command) {
  if (typeof command !== "string") return { paths: [], sawHeader: false };
  const paths = [];
  let sawHeader = false;
  let lastUpdate = -1;
  for (const rawLine of command.split("\n")) {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    const header = /^\*\*\* (Add|Update|Delete) File: (.+)$/.exec(line);
    if (header) {
      sawHeader = true;
      lastUpdate = -1;
      if (header[1] === "Delete") continue;
      paths.push(header[2].trim());
      if (header[1] === "Update") lastUpdate = paths.length - 1;
      continue;
    }
    const move = /^\*\*\* Move to: (.+)$/.exec(line);
    if (move && lastUpdate >= 0) {
      paths[lastUpdate] = move[1].trim();
      lastUpdate = -1;
    }
  }
  return {
    // eslint-disable-next-line no-control-regex
    paths: [...new Set(paths)].filter((p) => p !== "" && !/[\x00-\x1F]/.test(p)),
    sawHeader,
  };
}

/** The surviving paths alone; see readPatch. */
export function patchPaths(command) {
  return readPatch(command).paths;
}

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
 *
 * `realpathSync.native`, not the JavaScript `realpathSync`: on Windows only the
 * native one expands 8.3 short names, and the temporary directory arrives as
 * `C:\Users\RUNNER~1\...` while git reports the same checkout as
 * `C:/Users/runneradmin/...`, so every write looked like it left the workspace.
 */
export function resolveTargetPath(target, workspaceRoot) {
  const absolute = path.resolve(workspaceRoot, target);
  let resolved = absolute;
  let remainder = "";
  // Walk up until something exists, then resolve that and re-append the rest.
  for (let probe = absolute; ;) {
    try {
      resolved = path.join(realpathSync.native(probe), remainder);
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
    root = realpathSync.native(workspaceRoot);
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
        if (toolName === "apply_patch") {
          const patch = readPatch(input.command);
          if (patch.sawHeader) records.push(["patch_headers", "yes"]);
          for (const p of patch.paths) records.push(["patch_path", p]);
        }
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

// Whether node was started on this file, as opposed to it being imported.
//
// The comparison is between two filesystem paths, both put through realpath.
// It used to test import.meta.url against "file://" + process.argv[1], a URL
// against a path, which held only while the path needed no
// percent-encoding and was already POSIX-shaped. On Windows argv[1] is
// `D:\a\...` and the URL is `file:///D:/a/...`; on any platform a checkout
// path with a space is encoded in one and not the other. In both cases the
// test came out false, main() never ran, node exited 0 with no records, and
// check-command.sh read "no command field" and allowed `rm -rf`.
export function isEntryPoint(argv1, moduleUrl) {
  if (!argv1) return false;
  try {
    return realpathSync(argv1) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}

if (isEntryPoint(process.argv[1], import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
