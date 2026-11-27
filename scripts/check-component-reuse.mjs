#!/usr/bin/env node
// check-component-reuse.mjs — catch a design-system component rebuilt inside a feature or a page.
//
//   node scripts/check-component-reuse.mjs [root]    exit 0 clean, 1 violation, 2 cannot judge
//
// Reads every design/system/components/<name>.md and its 「程式實作」 field
// (backticked file paths, or 「尚未實作」; a backticked word without a slash,
// such as a prop name, is a note), then checks three things:
//
//   1. Every spec has exactly one 「程式實作」 field, and every path it names exists.
//   2. A shared component's implementation does not live in frontend/src/features/
//      or frontend/src/pages/. Shared means the spec is not marked 單頁專屬 or 原型鷹架.
//   3. A component file under features/ or pages/ whose name matches a shared spec
//      -- the same name, or the same last word (`*-toggle`, `*-banner`) -- imports
//      one of the matched specs' implementations under frontend/src/components/.
//      Wrapping the shared component is reuse; a file with the name and without
//      the import is a second copy.
//
// Existing violations sit in MOVE, one row per file, each naming the issue that
// moves it; a row whose file no longer violates fails, so it is deleted once the
// move lands. NOT_SAME holds files whose name only looks like a component's.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SPEC_DIR = "design/system/components";
const SRC = "frontend/src";
const SHARED_HOME = `${SRC}/components/`;
const SCANNED = [`${SRC}/features/`, `${SRC}/pages/`];
const NOT_YET = "尚未實作";
const NOT_SHARED_MARKS = ["單頁專屬", "原型鷹架"];

// Existing violations. `movedBy` is the issue that moves the file into
// frontend/src/components/, or 「待開單」 when no issue owns the move yet.
// Delete a row in the same pull request that moves its file.
export const MOVE = [
  {
    file: "frontend/src/features/auth/language-toggle.tsx",
    component: "lang-toggle",
    movedBy: "#720",
  },
  {
    file: "frontend/src/pages/dev-gallery/theme-toggle.tsx",
    component: "app-shell",
    movedBy: "#720",
  },
  {
    file: "frontend/src/features/auth/password-input.tsx",
    component: "password-eye-toggle",
    movedBy: "#723",
  },
  { file: "frontend/src/features/auth/auth-card.tsx", component: "auth-card", movedBy: "待開單" },
  {
    file: "frontend/src/features/auth/auth-layout.tsx",
    component: "auth-navbar",
    movedBy: "待開單",
  },
];

// Files whose name matches a spec only by accident: `reason` says why it is a
// different component. Prefer renaming the file over adding a row here.
export const NOT_SAME = [
  {
    file: "frontend/src/features/system-health/health-status-panel.tsx",
    component: "state-panel",
    reason: "/dev/health 的結果卡；State Panel 是送出後取代表單的狀態區塊",
  },
];

const toPosix = (p) => p.split(sep).join("/");
const lastWord = (name) => name.split("-").at(-1);

/**
 * Parse one component spec.
 *
 * @param {string} name the file name without `.md`
 * @param {string} text the spec text
 * @returns {{name: string, shared: boolean, paths: string[], errors: string[]}}
 */
export function parseSpec(name, text) {
  const errors = [];
  const fields = [...text.matchAll(/^>?\s*程式實作：(.*)$/gm)].map((m) => m[1].trim());
  let paths = [];
  if (fields.length !== 1) {
    errors.push(`${SPEC_DIR}/${name}.md：「程式實作」欄應恰好一個，找到 ${fields.length} 個`);
  } else {
    paths = [...fields[0].matchAll(/`([^`]+\/[^`]+)`/g)].map((m) => m[1]);
    if (paths.length === 0 && !fields[0].includes(NOT_YET)) {
      errors.push(
        `${SPEC_DIR}/${name}.md：「程式實作」要寫檔案路徑或「${NOT_YET}」，現在是「${fields[0]}」`,
      );
    }
    for (const p of paths) {
      if (!p.startsWith(`${SRC}/`))
        errors.push(`${SPEC_DIR}/${name}.md：「程式實作」的 \`${p}\` 不在 ${SRC}/ 底下`);
    }
  }
  const header = text.split("\n").slice(0, 6).join("\n");
  const shared = !NOT_SHARED_MARKS.some((mark) => header.includes(mark));
  return { name, shared, paths, errors };
}

/** List repo-relative component files under the scanned trees (tests excluded). */
function listComponentFiles(root) {
  const out = [];
  const walk = (abs) => {
    for (const entry of readdirSync(abs)) {
      const p = join(abs, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(".tsx") && !/\.test\.tsx$/.test(p)) out.push(toPosix(relative(root, p)));
    }
  };
  for (const dir of SCANNED) if (existsSync(join(root, dir))) walk(join(root, dir));
  return out.sort();
}

/** Resolve the import specifiers of a file to repo-relative paths (extension-less). */
export function importedModules(file, text) {
  const out = new Set();
  for (const m of text.matchAll(/\b(?:from|import)\s*["']([^"']+)["']/g)) {
    const spec = m[1];
    if (spec.startsWith("@/")) out.add(`${SRC}/${spec.slice(2)}`);
    else if (spec.startsWith(".")) out.add(posix.normalize(posix.join(posix.dirname(file), spec)));
  }
  return out;
}

const stripExt = (p) => p.replace(/\.(tsx|ts)$/, "").replace(/\/index$/, "");

/**
 * Judge the tree.
 *
 * @param {string} root repository root
 * @param {{move?: object[], notSame?: object[]}} [lists]
 * @returns {{errors: string[], violations: Map<string, string[]>, stale: string[]}}
 */
export function checkTree(root, { move = MOVE, notSame = NOT_SAME } = {}) {
  const errors = [];
  const specs = readdirSync(join(root, SPEC_DIR))
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => parseSpec(f.slice(0, -3), readFileSync(join(root, SPEC_DIR, f), "utf8")));
  const specNames = new Set(specs.map((s) => s.name));

  // Rule 1: the field is there and its paths exist.
  for (const spec of specs) {
    errors.push(...spec.errors);
    for (const p of spec.paths) {
      if (!existsSync(join(root, p)))
        errors.push(`${SPEC_DIR}/${spec.name}.md：「程式實作」的 \`${p}\` 不存在`);
    }
  }
  for (const row of [...move, ...notSame]) {
    if (!specNames.has(row.component))
      errors.push(`允許清單的 ${row.file} 指向不存在的元件規格 ${row.component}`);
  }

  const violations = new Map();
  const add = (file, why) => violations.set(file, [...(violations.get(file) ?? []), why]);
  const shared = specs.filter((s) => s.shared);

  // Rule 2: a shared component's implementation lives under components/.
  for (const spec of shared) {
    for (const p of spec.paths) {
      if (SCANNED.some((dir) => p.startsWith(dir))) {
        add(p, `是共用元件 ${spec.name} 的程式實作，應放 ${SHARED_HOME}`);
      }
    }
  }

  // Rule 3: a file named like a shared component wraps its shared implementation.
  for (const file of listComponentFiles(root)) {
    const base = posix.basename(file, ".tsx");
    const matched = shared.filter((s) => s.name === base || lastWord(s.name) === lastWord(base));
    if (matched.length === 0) continue;
    const imports = [...importedModules(file, readFileSync(join(root, file), "utf8"))].map(
      stripExt,
    );
    const homes = matched
      .flatMap((s) => s.paths.filter((p) => p.startsWith(SHARED_HOME)))
      .map(stripExt);
    if (homes.some((h) => imports.includes(h))) continue;
    if (matched.some((s) => s.paths.includes(file))) continue; // already reported by rule 2
    const names = matched.map((s) => s.name).join("、");
    add(file, `檔名近似設計系統元件 ${names}，卻沒有沿用它在 ${SHARED_HOME} 的實作`);
  }

  // Allowlists: suppress listed files; a listed file that no longer violates is stale.
  const stale = [];
  for (const row of [...move, ...notSame]) {
    if (violations.has(row.file)) violations.delete(row.file);
    else stale.push(row.file);
  }
  return { errors, violations, stale };
}

/** Run the CLI; return the exit code. */
export function main(argv, { stdout = process.stdout, stderr = process.stderr } = {}) {
  const root = resolve(argv[0] ?? join(dirname(fileURLToPath(import.meta.url)), ".."));
  if (!existsSync(join(root, SPEC_DIR))) {
    stdout.write(`NA: ${SPEC_DIR} 不存在，沒有元件規格可比對\n`);
    return 0;
  }
  let result;
  try {
    result = checkTree(root);
  } catch (error) {
    stderr.write(`check-component-reuse: 無法判定：${error.message}\n`);
    return 2;
  }
  const { errors, violations, stale } = result;
  for (const e of errors) stderr.write(`FAIL: ${e}\n`);
  for (const [file, whys] of violations) {
    stderr.write(
      `FAIL: ${file} ${whys.join("；")}。設計系統標成共用的元件只能放 ${SHARED_HOME}（frontend-agent-rules F5）\n`,
    );
  }
  for (const file of stale) {
    stderr.write(
      `FAIL: ${file} 已不再違規，刪掉 scripts/check-component-reuse.mjs 允許清單裡的這一列\n`,
    );
  }
  if (errors.length || violations.size || stale.length) return 1;
  stdout.write(`PASS: 元件重用檢查通過（允許清單 ${MOVE.length + NOT_SAME.length} 列）\n`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
