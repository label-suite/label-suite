#!/usr/bin/env node
// check-component-reuse.mjs — catch a design-system component rebuilt inside a feature or a page.
//
//   node scripts/check-component-reuse.mjs [root]    exit 0 clean, 1 violation, 2 cannot judge
//
// Reads every design/system/components/<name>.md and its 「程式實作」 field
// (backticked file paths, or 「尚未實作」; a backticked word without a slash,
// such as a prop name, is a note), then checks:
//
//   1. Every spec has exactly one 「程式實作」 field, every path it names exists,
//      and the inventory's 「程式實作」 column says the same as the spec.
//   2. A shared component's implementation does not live in frontend/src/features/
//      or frontend/src/pages/.
//   3. A component file under features/ or pages/ whose name matches a shared
//      component imports one of the matched components' implementations under
//      frontend/src/components/. A name matches when it equals, or ends in the
//      same last word as, the spec name (`*-toggle`, `*-banner`) or the file name
//      of the spec's implementation under components/ (`*-alert` for alert.tsx).
//      Wrapping the shared component is reuse; the name without the import is a
//      second copy.
//
// Shared is defined in docs/development/rules/frontend-agent-rules.mdx F5 and
// implemented here: the product screens that use a component, read from the
// 「元件 → 畫面」 table of design/system/screen-inventory.md, belong to more than
// one frontend feature, and its spec is not marked 單頁專屬 or 原型鷹架 anywhere
// in its text. Each screen ID maps to a feature through SCREEN_FEATURE; a screen
// ID it does not cover, or a spec missing from the table, fails instead of being
// guessed.
//
// Existing violations sit in MOVE, one row per file, each naming the issue that
// moves it and the component the file hits; a row whose file no longer violates
// fails, so it is deleted once the move lands. NOT_SAME holds files whose name
// only looks like a component's.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SPEC_DIR = "design/system/components";
const SRC = "frontend/src";
const SHARED_HOME = `${SRC}/components/`;
const SCANNED = [`${SRC}/features/`, `${SRC}/pages/`];
const NOT_YET = "尚未實作";
const NOT_SHARED_MARKS = ["單頁專屬", "原型鷹架"];
const INVENTORY = "design/system/screen-inventory.md";
const ISSUE = /^#\d+$/;

// Screen ID (as written in the inventory) → the frontend feature that owns it.
// The convention: a product screen belongs to the feature of its prototype
// module, the first path segment, so every account/* screen is one feature
// (today features/auth). Three IDs are named in full: the signed-in app shell
// is a product screen of its own; the prototype's component showcase and its
// index are not product screens, so they map to null and count for nothing.
export const SCREEN_FEATURE = {
  modules: ["account", "admin", "annotation", "dashboard", "dataset", "task-management"],
  screens: {
    "shared/app-shell": "app-shell",
    "components-showcase": null,
    index: null,
  },
};

// Existing violations. `movedBy` is the issue (`#N`) that moves the file into
// frontend/src/components/; `component` is the spec the file hits. Delete a row
// in the same pull request that moves its file.
export const MOVE = [];

// Files whose name matches a spec only by accident: `reason` says why it is a
// different component. Prefer renaming the file over adding a row here.
export const NOT_SAME = [];

const toPosix = (p) => p.split(sep).join("/");
const lastWord = (name) => name.split("-").at(-1);
const stripExt = (p) => p.replace(/\.(tsx|ts)$/, "").replace(/\/index$/, "");
const nameMatches = (base, name) => base === name || lastWord(base) === lastWord(name);

/**
 * Map a screen ID to its feature.
 *
 * @param {string} screen a screen ID from the inventory, e.g. `account/login`
 * @returns {string|null} the feature, or null for a screen that is not a product screen
 * @throws {Error} when SCREEN_FEATURE does not cover the screen
 */
export function featureOf(screen, map = SCREEN_FEATURE) {
  if (Object.hasOwn(map.screens, screen)) return map.screens[screen];
  const module = screen.split("/")[0];
  if (screen.includes("/") && map.modules.includes(module)) return module;
  throw new Error(
    `${INVENTORY} 的畫面 \`${screen}\` 對不到任何 feature；在 scripts/check-component-reuse.mjs 的 SCREEN_FEATURE 補上它`,
  );
}

/**
 * Read the inventory's 「元件 → 畫面」 table.
 *
 * @param {string} text the inventory text
 * @returns {{features: Map<string, Set<string>>, impl: Map<string, string>, errors: string[]}}
 *   keyed by spec name; `impl` is the 「程式實作」 cell as written
 */
export function parseInventory(text, map = SCREEN_FEATURE) {
  const features = new Map();
  const impl = new Map();
  const errors = [];
  const start = text.indexOf("| 元件 |");
  if (start < 0) return { features, impl, errors: [`${INVENTORY} 找不到「元件 → 畫面」表`] };
  for (const line of text.slice(start).split("\n").slice(2)) {
    if (!line.startsWith("|")) break;
    const name = /\(components\/([a-z0-9-]+)\.md\)/.exec(line)?.[1];
    if (!name) continue;
    const cells = line.split("|");
    const used = new Set();
    for (const cell of cells.slice(2, -3)) {
      for (const m of cell.matchAll(/`([^`]+)`/g)) {
        try {
          const feature = featureOf(m[1], map);
          if (feature) used.add(feature);
        } catch (error) {
          errors.push(error.message);
        }
      }
    }
    features.set(name, used);
    impl.set(name, cells.at(-2).trim());
  }
  return { features, impl, errors };
}

/**
 * Parse one component spec.
 *
 * @param {string} name the file name without `.md`
 * @param {string} text the spec text
 * @returns {{name: string, marked: boolean, field: string, paths: string[], errors: string[]}}
 *   `marked` is true for a spec marked 單頁專屬 or 原型鷹架; `field` is the raw value
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
  const marked = NOT_SHARED_MARKS.some((mark) => text.includes(mark));
  return { name, marked, field: fields[0] ?? "", paths, errors };
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

/**
 * Judge the tree.
 *
 * @param {string} root repository root
 * @param {{move?: object[], notSame?: object[]}} [lists]
 * @returns {{errors: string[], violations: Map<string, {whys: string[], specs: Set<string>}>, stale: string[]}}
 */
export function checkTree(root, { move = MOVE, notSame = NOT_SAME } = {}) {
  const errors = [];
  const specs = readdirSync(join(root, SPEC_DIR))
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => parseSpec(f.slice(0, -3), readFileSync(join(root, SPEC_DIR, f), "utf8")));
  if (!existsSync(join(root, INVENTORY)))
    throw new Error(`${INVENTORY} 不存在，無法判定哪些元件共用`);
  const inventory = parseInventory(readFileSync(join(root, INVENTORY), "utf8"));
  errors.push(...new Set(inventory.errors));

  // Rule 1: the field is there, its paths exist, and the inventory agrees.
  for (const spec of specs) {
    errors.push(...spec.errors);
    for (const p of spec.paths) {
      if (!existsSync(join(root, p)))
        errors.push(`${SPEC_DIR}/${spec.name}.md：「程式實作」的 \`${p}\` 不存在`);
    }
    if (!inventory.features.has(spec.name)) {
      errors.push(`${INVENTORY} 的「元件 → 畫面」表沒有 ${spec.name}`);
    } else if (inventory.impl.get(spec.name) !== spec.field) {
      errors.push(
        `${INVENTORY} 的 ${spec.name}「程式實作」是「${inventory.impl.get(spec.name)}」，規格寫的是「${spec.field}」；重新生成清冊`,
      );
    }
    spec.features = [...(inventory.features.get(spec.name) ?? [])].sort();
    spec.shared = !spec.marked && spec.features.length > 1;
  }

  const violations = new Map();
  const add = (file, why, names) => {
    const v = violations.get(file) ?? { whys: [], specs: new Set() };
    v.whys.push(why);
    for (const n of names) v.specs.add(n);
    violations.set(file, v);
  };
  const shared = specs.filter((s) => s.shared);
  const homesOf = (s) => s.paths.filter((p) => p.startsWith(SHARED_HOME));

  // Rule 2: a shared component's implementation lives under components/.
  for (const spec of shared) {
    for (const p of spec.paths) {
      if (SCANNED.some((dir) => p.startsWith(dir))) {
        add(
          p,
          `是共用元件 ${spec.name}（用在 ${spec.features.join("、")}）的程式實作，應放 ${SHARED_HOME}`,
          [spec.name],
        );
      }
    }
  }

  // Rule 3: a file named like a shared component wraps its shared implementation.
  for (const file of listComponentFiles(root)) {
    const base = posix.basename(file, ".tsx");
    const matched = shared.filter(
      (s) =>
        nameMatches(base, s.name) ||
        homesOf(s).some((p) => nameMatches(base, posix.basename(stripExt(p)))),
    );
    if (matched.length === 0) continue;
    const imports = [...importedModules(file, readFileSync(join(root, file), "utf8"))].map(
      stripExt,
    );
    if (matched.flatMap(homesOf).some((h) => imports.includes(stripExt(h)))) continue;
    if (matched.some((s) => s.paths.includes(file))) continue; // already reported by rule 2
    const names = matched.map((s) => s.name);
    add(
      file,
      `檔名近似設計系統元件 ${names.join("、")}，卻沒有沿用它在 ${SHARED_HOME} 的實作`,
      names,
    );
  }

  // Allowlists: validate the rows, suppress listed files, report stale rows.
  const stale = [];
  for (const row of move) {
    if (!ISSUE.test(row.movedBy ?? ""))
      errors.push(`允許清單的 ${row.file}：movedBy 要寫成 #N，現在是「${row.movedBy}」`);
  }
  for (const row of [...move, ...notSame]) {
    const v = violations.get(row.file);
    if (!v) {
      stale.push(row.file);
      continue;
    }
    if (!v.specs.has(row.component)) {
      errors.push(
        `允許清單的 ${row.file} 寫的元件是 ${row.component}，但它觸發的是 ${[...v.specs].join("、")}`,
      );
    }
    violations.delete(row.file);
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
  for (const [file, { whys }] of violations) {
    stderr.write(
      `FAIL: ${file} ${whys.join("；")}。用在一個以上 feature 的設計系統元件只能放 ${SHARED_HOME}（frontend-agent-rules F5）\n`,
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
