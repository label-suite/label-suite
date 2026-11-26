// Regression tests for scripts/lib/hook-payload.mjs (issue #111, task 2.2).
//
// This module is the only place an untrusted hook payload is parsed. Its job is
// to fail loudly on anything it cannot vouch for, because every caller
// downstream is a shell script: a value that slips through unvalidated ends up
// in a command line. The cases below are therefore mostly about refusal.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, realpathSync, symlinkSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  EXIT_BAD_PAYLOAD,
  PATH_FIELDS,
  RECORD_NAMES,
  REQUIRED_FIELDS,
  formatRecords,
  parsePayload,
  patchPaths,
  readPatch,
  resolveTargetPath,
} from "../lib/hook-payload.mjs";

const json = (o) => JSON.stringify(o);

// ── Required fields, per the contract's H1/H2/H3/H6 rows ──────────────

test("every supported event declares its required fields", () => {
  for (const event of ["SessionStart", "PreToolUse", "PostToolUse", "Stop", "SubagentStop"]) {
    assert.ok(Array.isArray(REQUIRED_FIELDS[event]), `${event} has no required-field list`);
    assert.ok(REQUIRED_FIELDS[event].length > 0, `${event} requires nothing`);
  }
});

test("SessionStart requires cwd and hook_event_name", () => {
  assert.deepEqual(REQUIRED_FIELDS.SessionStart.slice().sort(), ["cwd", "hook_event_name"]);
});

test("PreToolUse and PostToolUse require tool_name, tool_input and cwd", () => {
  for (const event of ["PreToolUse", "PostToolUse"]) {
    assert.deepEqual(REQUIRED_FIELDS[event].slice().sort(), ["cwd", "tool_input", "tool_name"]);
  }
});

test("Stop and SubagentStop require stop_hook_active and cwd", () => {
  for (const event of ["Stop", "SubagentStop"]) {
    assert.deepEqual(REQUIRED_FIELDS[event].slice().sort(), ["cwd", "stop_hook_active"]);
  }
});

// ── Refusal: anything we cannot vouch for exits 3 ─────────────────────

test("malformed JSON is refused", () => {
  const r = parsePayload("{not json", "PreToolUse");
  assert.equal(r.ok, false);
  assert.match(r.reason, /JSON/i);
});

test("a JSON scalar is refused — payload must be an object", () => {
  for (const raw of ['"a string"', "42", "null", "[]"]) {
    assert.equal(parsePayload(raw, "PreToolUse").ok, false, `accepted ${raw}`);
  }
});

test("a missing required field is refused and the reason names it", () => {
  const r = parsePayload(json({ tool_name: "Bash", cwd: "/tmp" }), "PreToolUse");
  assert.equal(r.ok, false);
  assert.match(r.reason, /tool_input/);
});

test("an unknown event name is refused rather than guessed at", () => {
  const r = parsePayload(json({ cwd: "/tmp" }), "NotAnEvent");
  assert.equal(r.ok, false);
  assert.match(r.reason, /NotAnEvent/);
});

test("stop_hook_active present but false still satisfies the requirement", () => {
  // false is a meaningful value here: it means this is not a re-entry.
  const r = parsePayload(json({ stop_hook_active: false, cwd: "/tmp" }), "Stop");
  assert.equal(r.ok, true);
});

test("the refusal exit code is 3, distinct from the 0/1/2 verdict vocabulary", () => {
  assert.equal(EXIT_BAD_PAYLOAD, 3);
});

// ── Records: fixed allowlist, values never expanded ───────────────────

test("emitted record names all come from the allowlist", () => {
  const r = parsePayload(
    json({ tool_name: "Edit", tool_input: { file_path: "/tmp/a.txt" }, cwd: "/tmp" }),
    "PreToolUse",
  );
  assert.equal(r.ok, true);
  for (const [name] of r.records) {
    assert.ok(RECORD_NAMES.includes(name), `${name} is not on the allowlist`);
  }
});

test("an attacker-controlled key in tool_input is not emitted", () => {
  const r = parsePayload(
    json({
      tool_name: "Edit",
      tool_input: { file_path: "/tmp/a", "evil;rm -rf /": "x" },
      cwd: "/tmp",
    }),
    "PreToolUse",
  );
  assert.equal(r.ok, true);
  assert.ok(!r.records.some(([n]) => n.includes("evil")));
});

test("each write tool reads its own documented path field", () => {
  assert.equal(PATH_FIELDS.Edit, "file_path");
  assert.equal(PATH_FIELDS.Write, "file_path");
  assert.equal(PATH_FIELDS.NotebookEdit, "notebook_path");
  // apply_patch deliberately has none: the official docs record only
  // tool_input.command for it (completion-report.md §1.4).
  assert.equal(PATH_FIELDS.apply_patch, undefined);
});

test("an apply_patch PostToolUse payload names the tool and carries no path", () => {
  // check-changed.sh keys its git-based candidate list on tool_name, so the
  // name has to come through even though there is no path to go with it.
  const r = parsePayload(
    json({
      tool_name: "apply_patch",
      tool_input: { command: "*** Begin Patch\n*** Add File: docs/a.md\n+x\n*** End Patch\n" },
      tool_response: "Success. Updated the following files:\nA docs/a.md\n",
      cwd: "/tmp",
    }),
    "PostToolUse",
  );
  assert.equal(r.ok, true);
  assert.ok(r.records.some(([n, v]) => n === "tool_name" && v === "apply_patch"));
  // Never tool_path: H2 must keep seeing "no path field" and its documented NA.
  assert.ok(!r.records.some(([n]) => n === "tool_path"));
  assert.deepEqual(
    r.records.filter(([n]) => n === "patch_path").map(([, v]) => v),
    ["docs/a.md"],
  );
});

test("patchPaths keeps added, updated and moved-to files and drops deletions", () => {
  const patch = [
    "*** Begin Patch",
    "*** Add File: docs/新 檔.md",
    "+x",
    "*** Update File: a.py",
    "@@",
    "-1",
    "+2",
    "*** Delete File: gone.py",
    "*** Update File: old/name.ts",
    "*** Move to: new/name.ts",
    "*** Update File: a.py",
    "*** End Patch",
  ].join("\r\n");
  assert.deepEqual(patchPaths(patch), ["docs/新 檔.md", "a.py", "new/name.ts"]);
});

test("patchPaths returns nothing for malformed or missing patch text", () => {
  assert.deepEqual(patchPaths("not a patch *** Update File:"), []);
  assert.deepEqual(patchPaths("*** Move to: orphan.py"), []);
  assert.deepEqual(patchPaths(undefined), []);
  assert.deepEqual(patchPaths("*** Add File: bad\x1fname"), []);
});

test("readPatch tells a delete-only patch apart from unrecognised text", () => {
  assert.deepEqual(readPatch("*** Begin Patch\n*** Delete File: a.md\n*** End Patch"), {
    paths: [],
    sawHeader: true,
  });
  assert.deepEqual(readPatch("not a patch"), { paths: [], sawHeader: false });
  const r = parsePayload(
    json({
      tool_name: "apply_patch",
      tool_input: { command: "*** Delete File: a.md" },
      cwd: "/tmp",
    }),
    "PostToolUse",
  );
  assert.ok(r.records.some(([n, v]) => n === "patch_headers" && v === "yes"));
  assert.ok(!r.records.some(([n]) => n === "patch_path"));
});

test("patch_path records are emitted for apply_patch only", () => {
  const r = parsePayload(
    json({ tool_name: "Bash", tool_input: { command: "*** Add File: x.md" }, cwd: "/tmp" }),
    "PostToolUse",
  );
  assert.ok(!r.records.some(([n]) => n === "patch_path"));
});

test("values are carried through verbatim, including shell metacharacters", () => {
  const nasty = "/tmp/a b;$(id)`whoami`'\"\\.txt";
  const r = parsePayload(
    json({ tool_name: "Write", tool_input: { file_path: nasty }, cwd: "/tmp" }),
    "PreToolUse",
  );
  assert.equal(r.ok, true);
  const rec = r.records.find(([n]) => n === "tool_path");
  assert.equal(rec[1], nasty);
});

// ── Framing: NUL between records, 0x1F between name and value ─────────

test("records are framed so a value can contain anything but NUL and 0x1F", () => {
  const out = formatRecords([
    ["event", "PreToolUse"],
    ["cwd", "/tmp/a b"],
  ]);
  assert.equal(out, "event\x1FPreToolUse\0cwd\x1F/tmp/a b\0");
});

test("a value containing the framing bytes is refused, not silently truncated", () => {
  assert.throws(() => formatRecords([["cwd", "a\0b"]]), /NUL|0x00/i);
  assert.throws(() => formatRecords([["cwd", "a\x1Fb"]]), /0x1F|separator/i);
});

test("a newline in a value survives framing — lines are not the delimiter", () => {
  const out = formatRecords([["cwd", "a\nb"]]);
  assert.equal(out, "cwd\x1Fa\nb\0");
});

// ── Path resolution and the workspace boundary ────────────────────────

test("resolveTargetPath resolves symlinks and relative segments", () => {
  const root = mkdtempSync(path.join(tmpdir(), "hp-"));
  try {
    mkdirSync(path.join(root, "real"));
    writeFileSync(path.join(root, "real", "f.txt"), "x");
    symlinkSync(path.join(root, "real"), path.join(root, "link"));
    const r = resolveTargetPath(path.join(root, "link", "..", "link", "f.txt"), root);
    // realpathSync on the expectation too: on macOS /var is itself a symlink to
    // /private/var, and resolving that is the function working, not failing.
    assert.equal(r.resolved, path.join(realpathSync(root), "real", "f.txt"));
    assert.equal(r.outsideWorkspace, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a symlink pointing out of the workspace is flagged as outside", () => {
  const root = mkdtempSync(path.join(tmpdir(), "hp-"));
  const outside = mkdtempSync(path.join(tmpdir(), "hp-out-"));
  try {
    writeFileSync(path.join(outside, "secret"), "x");
    symlinkSync(path.join(outside, "secret"), path.join(root, "escape"));
    const r = resolveTargetPath(path.join(root, "escape"), root);
    assert.equal(r.outsideWorkspace, true, "symlink escape was not flagged");
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("a non-existent path still resolves and is still bounded", () => {
  const root = mkdtempSync(path.join(tmpdir(), "hp-"));
  try {
    const inside = resolveTargetPath(path.join(root, "nope", "x.txt"), root);
    assert.equal(inside.outsideWorkspace, false);
    const out = resolveTargetPath("/etc/passwd", root);
    assert.equal(out.outsideWorkspace, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a path that merely shares a prefix with the workspace is outside it", () => {
  // /tmp/ws-evil must not count as inside /tmp/ws.
  const r = resolveTargetPath("/tmp/ws-evil/f", "/tmp/ws");
  assert.equal(r.outsideWorkspace, true);
});

// ── The command-line entry point, as the shell actually calls it ──────

const CLI = new URL("../lib/hook-payload.mjs", import.meta.url).pathname;

function runCli(args, stdin) {
  return spawnSync(process.execPath, [CLI, ...args], { input: stdin, encoding: "utf8" });
}

test("the CLI frames a valid payload on stdout and exits 0", () => {
  const r = runCli(
    ["--event", "PreToolUse"],
    json({ tool_name: "Write", tool_input: { file_path: "/tmp/a.txt" }, cwd: "/tmp" }),
  );
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes(`tool_path\x1F/tmp/a.txt\0`));
  assert.ok(r.stdout.endsWith("\0"));
});

test("the CLI exits 3 on malformed JSON and explains on stderr", () => {
  const r = runCli(["--event", "PreToolUse"], "{nope");
  assert.equal(r.status, EXIT_BAD_PAYLOAD);
  assert.match(r.stderr, /JSON/i);
  assert.equal(r.stdout, "", "a refused payload must emit no records");
});

test("the CLI exits 3 on a missing required field", () => {
  const r = runCli(["--event", "Stop"], json({ cwd: "/tmp" }));
  assert.equal(r.status, EXIT_BAD_PAYLOAD);
  assert.match(r.stderr, /stop_hook_active/);
});

test("the CLI refuses to take the payload from argv", () => {
  // The invariant: untrusted text reaches this process only through stdin, so
  // it never passes through a shell's word splitting on the way in. Handing the
  // payload as an argument must not work, even when it is valid JSON.
  const payload = json({ tool_name: "Bash", tool_input: { command: "id" }, cwd: "/tmp" });
  const r = runCli(["--event", "PreToolUse", payload], "");
  assert.notEqual(r.status, 0, "a payload supplied as an argument was accepted");
});

test("the CLI requires --event and names nothing else", () => {
  const r = runCli([], json({ cwd: "/tmp", hook_event_name: "SessionStart" }));
  assert.equal(r.status, EXIT_BAD_PAYLOAD);
  assert.match(r.stderr, /--event/);
});

test("a command carrying shell metacharacters survives stdin intact", () => {
  const command = 'rm -rf "$HOME"; echo `id` && :';
  const r = runCli(
    ["--event", "PreToolUse"],
    json({ tool_name: "Bash", tool_input: { command }, cwd: "/tmp" }),
  );
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes(`tool_command\x1F${command}\0`), r.stdout);
});
