// Regression tests for scripts/check-component-reuse.mjs. Run: node --test scripts/tests/*.test.mjs
//
// A design-system component rebuilt inside a feature or a page is what this
// checker catches (#747); each case builds a small tree in a temp directory.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  checkTree,
  featureOf,
  importedModules,
  parseInventory,
  parseSpec,
} from "../check-component-reuse.mjs";

const SCRIPT = fileURLToPath(new URL("../check-component-reuse.mjs", import.meta.url));

const spec = (impl, mark = "") =>
  `# X\n\n> 正典章節：無 ${mark}｜批次 \`b1\`\n>\n> 程式實作：${impl}\n\n## 結構\n`;

/** The inventory's 「元件 → 畫面」 table: rows are name → [screens, 程式實作]. */
const inventory = (rows) =>
  [
    "# Screen Inventory",
    "",
    "## 元件 → 畫面",
    "",
    "| 元件 | b1 用到它的畫面 | b2 用到它的畫面 | b3 用到它的畫面 | b4 用到它的畫面 | 數 | 程式實作 |",
    "| :--- | :--- | :--- | :--- | :--- | ---: | :--- |",
    ...Object.entries(rows).map(
      ([name, [screens, impl]]) =>
        `| [${name}](components/${name}.md) | ${screens.map((x) => `\`${x}\``).join(" · ")} | **（b2 無）** | **（b3 無）** | **（b4 無）** | ${screens.length} | ${impl} |`,
    ),
    "",
  ].join("\n");

const SCREENS = {
  button: ["account/login", "admin/user-management"],
  "alert-banner": ["account/login", "admin/role-settings"],
  "lang-toggle": ["account/login", "components-showcase"],
  "auth-card": ["account/login", "account/register"],
  card: ["dashboard/dashboard", "task-management/task-new"],
  modal: ["admin/role-settings", "task-management/task-new"],
  "step-indicator": ["task-management/task-new", "dataset/x"],
};

const SPECS = {
  button: spec("`frontend/src/components/ui/button.tsx`"),
  "alert-banner": spec("`frontend/src/components/ui/alert.tsx`"),
  "lang-toggle": spec("尚未實作"),
  "step-indicator": spec("尚未實作", "｜**單頁專屬**"),
};

/**
 * Build a tree. `specs` overrides SPECS (name → spec text); the inventory is
 * generated from the specs, its 程式實作 column copied from each header,
 * unless `files` supplies one.
 */
function tree({ specs = {}, files = {}, screens = SCREENS } = {}) {
  const all = { ...SPECS, ...specs };
  const rows = Object.fromEntries(
    Object.entries(all).map(([name, text]) => [name, [screens[name], parseSpec(name, text).field]]),
  );
  const content = {
    "design/system/screen-inventory.md": inventory(rows),
    "frontend/src/components/ui/button.tsx": "export function Button() {}\n",
    "frontend/src/components/ui/alert.tsx": "export function Alert() {}\n",
    ...Object.fromEntries(
      Object.entries(all).map(([name, text]) => [`design/system/components/${name}.md`, text]),
    ),
    ...files,
  };
  const root = mkdtempSync(join(tmpdir(), "component-reuse-"));
  for (const [rel, text] of Object.entries(content)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  return root;
}

const none = { move: [], notSame: [] };
const judge = (opts, lists = none) => {
  const root = tree(opts);
  try {
    return checkTree(root, lists);
  } finally {
    rmSync(root, { recursive: true });
  }
};

test("parseSpec reads paths, 尚未實作 and the not-shared mark anywhere in the text", () => {
  const a = parseSpec("button", spec("`frontend/src/components/ui/button.tsx`（`loading`）"));
  assert.deepEqual(a.paths, ["frontend/src/components/ui/button.tsx"]);
  assert.equal(a.marked, false);
  assert.deepEqual(a.errors, []);
  const b = parseSpec(
    "x",
    `${spec("尚未實作")}\n\n${"段落\n".repeat(10)}這是原型鷹架，不是產品元件。\n`,
  );
  assert.deepEqual(b.paths, []);
  assert.equal(b.marked, true);
});

test("parseSpec rejects a spec without the field or with an empty one", () => {
  assert.match(parseSpec("x", "# X\n\n> 正典章節：無\n").errors[0], /恰好一個/);
  assert.match(parseSpec("x", spec("看情況")).errors[0], /尚未實作/);
});

test("featureOf maps module screens by their first segment; showcase and index count for nothing", () => {
  assert.equal(featureOf("account/profile"), "account");
  assert.equal(featureOf("task-management/task-new"), "task-management");
  assert.equal(featureOf("shared/app-shell"), "app-shell");
  assert.equal(featureOf("components-showcase"), null);
  assert.equal(featureOf("index"), null);
  assert.throws(() => featureOf("reports/weekly"), /SCREEN_FEATURE/);
  assert.throws(() => featureOf("account"), /SCREEN_FEATURE/);
});

test("parseInventory collects features and 程式實作, and reports unmapped screens", () => {
  const r = parseInventory(
    inventory({
      button: [["account/login", "account/register", "components-showcase"], "尚未實作"],
      x: [["reports/weekly"], "尚未實作"],
    }),
  );
  assert.deepEqual([...r.features.get("button")], ["account"]);
  assert.equal(r.impl.get("button"), "尚未實作");
  assert.match(r.errors.join("\n"), /reports\/weekly/);
});

test("importedModules resolves the @/ alias and relative imports", () => {
  const mods = importedModules(
    "frontend/src/features/auth/a.tsx",
    'import { Button } from "@/components/ui/button";\nimport { b } from "./b";\nimport x from "react";\n',
  );
  assert.deepEqual([...mods].sort(), [
    "frontend/src/components/ui/button",
    "frontend/src/features/auth/b",
  ]);
});

test("a component used by one feature may live in that feature", () => {
  const r = judge({
    specs: { "auth-card": spec("`frontend/src/features/auth/auth-card.tsx`") },
    files: { "frontend/src/features/auth/auth-card.tsx": "export const x = 1;\n" },
  });
  assert.deepEqual(r.errors, []);
  assert.equal(r.violations.size, 0);
});

test("the showcase does not make a component shared", () => {
  const r = judge({
    specs: { "lang-toggle": spec("`frontend/src/features/auth/language-toggle.tsx`") },
    files: { "frontend/src/features/auth/language-toggle.tsx": "export const x = 1;\n" },
  });
  assert.deepEqual(r.errors, []);
  assert.equal(r.violations.size, 0);
});

test("a component used by more than one feature may not live in a feature", () => {
  const r = judge({
    specs: { card: spec("`frontend/src/features/dashboard/card.tsx`") },
    files: { "frontend/src/features/dashboard/card.tsx": "export const x = 1;\n" },
  });
  const v = r.violations.get("frontend/src/features/dashboard/card.tsx");
  assert.match(v.whys[0], /card（用在 dashboard、task-management）/);
});

test("a spec marked 單頁專屬 is not shared even when used by two features", () => {
  const r = judge({
    specs: {
      "step-indicator": spec("`frontend/src/features/task/step-indicator.tsx`", "｜**單頁專屬**"),
    },
    files: { "frontend/src/features/task/step-indicator.tsx": "export const x = 1;\n" },
  });
  assert.equal(r.violations.size, 0);
});

test("a feature file that wraps the shared component passes", () => {
  const r = judge({
    files: {
      "frontend/src/features/auth/logout-button.tsx":
        'import { Button } from "@/components/ui/button";\n',
    },
  });
  assert.deepEqual(r.errors, []);
  assert.equal(r.violations.size, 0);
});

test("a near-named feature file without the shared import fails", () => {
  const r = judge({
    files: { "frontend/src/features/auth/session-banner.tsx": "export const x = 1;\n" },
  });
  assert.match(
    r.violations.get("frontend/src/features/auth/session-banner.tsx").whys[0],
    /alert-banner/,
  );
});

test("a file named like a shared component's implementation file fails without the import", () => {
  const r = judge({
    specs: { modal: spec("`frontend/src/components/ui/dialog.tsx`") },
    files: {
      "frontend/src/components/ui/dialog.tsx": "export function Dialog() {}\n",
      "frontend/src/features/x/form-alert.tsx": "export const x = 1;\n",
      "frontend/src/features/x/confirm-dialog.tsx": "export const x = 1;\n",
      "frontend/src/features/x/delete-dialog.tsx":
        'import { Dialog } from "@/components/ui/dialog";\n',
    },
  });
  assert.match(r.violations.get("frontend/src/features/x/form-alert.tsx").whys[0], /alert-banner/);
  assert.match(r.violations.get("frontend/src/features/x/confirm-dialog.tsx").whys[0], /modal/);
  assert.equal(r.violations.has("frontend/src/features/x/delete-dialog.tsx"), false);
});

test("a 程式實作 path that does not exist fails", () => {
  const r = judge({ specs: { card: spec("`frontend/src/components/ui/card.tsx`") } });
  assert.match(r.errors.join("\n"), /card\.tsx` 不存在/);
});

test("the inventory's 程式實作 column must match the spec header", () => {
  const root = tree();
  writeFileSync(
    join(root, "design/system/components/lang-toggle.md"),
    spec("`frontend/src/components/ui/button.tsx`"),
  );
  const errors = checkTree(root, none).errors.join("\n");
  rmSync(root, { recursive: true });
  assert.match(errors, /lang-toggle「程式實作」是「尚未實作」/);
});

test("a spec missing from the inventory, or an unmapped screen, fails", () => {
  const unmapped = judge({ screens: { ...SCREENS, button: ["reports/weekly"] } });
  assert.match(unmapped.errors.join("\n"), /reports\/weekly/);
  const root = tree();
  writeFileSync(join(root, "design/system/components/tooltip.md"), spec("尚未實作"));
  const errors = checkTree(root, none).errors.join("\n");
  rmSync(root, { recursive: true });
  assert.match(errors, /沒有 tooltip/);
});

test("test files are not scanned", () => {
  const r = judge({ files: { "frontend/src/features/auth/session-banner.test.tsx": "x\n" } });
  assert.equal(r.violations.size, 0);
});

test("an allowlisted file is suppressed, and a row that no longer violates is stale", () => {
  const move = [
    {
      file: "frontend/src/features/x/session-banner.tsx",
      component: "alert-banner",
      movedBy: "#1",
    },
    { file: "frontend/src/features/x/gone.tsx", component: "alert-banner", movedBy: "#1" },
  ];
  const r = judge(
    { files: { "frontend/src/features/x/session-banner.tsx": "export const x = 1;\n" } },
    { move, notSame: [] },
  );
  assert.deepEqual(r.errors, []);
  assert.equal(r.violations.size, 0);
  assert.deepEqual(r.stale, ["frontend/src/features/x/gone.tsx"]);
});

test("an allowlist row must name an issue and a component the file actually hits", () => {
  const files = { "frontend/src/features/x/session-banner.tsx": "export const x = 1;\n" };
  const file = "frontend/src/features/x/session-banner.tsx";
  const badIssue = judge(
    { files },
    { move: [{ file, component: "alert-banner", movedBy: "待開單" }], notSame: [] },
  );
  assert.match(badIssue.errors.join("\n"), /movedBy 要寫成 #N/);
  const wrongSpec = judge(
    { files },
    { move: [], notSame: [{ file, component: "card", reason: "r" }] },
  );
  assert.match(wrongSpec.errors.join("\n"), /寫的元件是 card，但它觸發的是 alert-banner/);
});

test("the CLI passes on the repository as it stands", () => {
  const r = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^PASS:/);
});

test("the CLI reports NA when the root has no component specs", () => {
  const root = mkdtempSync(join(tmpdir(), "component-reuse-"));
  const r = spawnSync(process.execPath, [SCRIPT, root], { encoding: "utf8" });
  rmSync(root, { recursive: true });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^NA:/);
});
