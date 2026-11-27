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

import { checkTree, importedModules, parseSpec } from "../check-component-reuse.mjs";

const SCRIPT = fileURLToPath(new URL("../check-component-reuse.mjs", import.meta.url));

const spec = (impl, mark = "") =>
  `# X\n\n> 正典章節：無 ${mark}｜批次 \`b1\`\n>\n> 程式實作：${impl}\n\n## 結構\n`;

/** Build a tree from {relativePath: content}; return its root. */
function tree(files) {
  const root = mkdtempSync(join(tmpdir(), "component-reuse-"));
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), content);
  }
  return root;
}

const BASE = {
  "design/system/components/button.md": spec("`frontend/src/components/ui/button.tsx`"),
  "design/system/components/alert-banner.md": spec("`frontend/src/components/ui/alert.tsx`"),
  "design/system/components/lang-toggle.md": spec("尚未實作"),
  "design/system/components/step-indicator.md": spec("尚未實作", "｜**單頁專屬**"),
  "frontend/src/components/ui/button.tsx": "export function Button() {}\n",
  "frontend/src/components/ui/alert.tsx": "export function Alert() {}\n",
};
const none = { move: [], notSame: [] };

test("parseSpec reads paths, 尚未實作 and the shared mark", () => {
  const a = parseSpec("button", spec("`frontend/src/components/ui/button.tsx`（`loading`）"));
  assert.deepEqual(a.paths, ["frontend/src/components/ui/button.tsx"]);
  assert.equal(a.shared, true);
  assert.deepEqual(a.errors, []);
  const b = parseSpec("step-indicator", spec("尚未實作", "｜**單頁專屬**"));
  assert.deepEqual(b.paths, []);
  assert.equal(b.shared, false);
});

test("parseSpec rejects a spec without the field or with an empty one", () => {
  assert.match(parseSpec("x", "# X\n\n> 正典章節：無\n").errors[0], /恰好一個/);
  assert.match(parseSpec("x", spec("看情況")).errors[0], /尚未實作/);
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

test("a feature file that wraps the shared component passes", () => {
  const root = tree({
    ...BASE,
    "frontend/src/features/auth/logout-button.tsx":
      'import { Button } from "@/components/ui/button";\n',
  });
  const r = checkTree(root, none);
  assert.deepEqual(r.errors, []);
  assert.equal(r.violations.size, 0);
  rmSync(root, { recursive: true });
});

test("a near-named feature file without the shared import fails", () => {
  const root = tree({
    ...BASE,
    "frontend/src/features/auth/session-banner.tsx": "export const x = 1;\n",
  });
  const r = checkTree(root, none);
  assert.match(
    r.violations.get("frontend/src/features/auth/session-banner.tsx")[0],
    /alert-banner/,
  );
  rmSync(root, { recursive: true });
});

test("a page file named like a component with no shared implementation fails", () => {
  const root = tree({ ...BASE, "frontend/src/pages/x/theme-toggle.tsx": "export const x = 1;\n" });
  assert.ok(checkTree(root, none).violations.has("frontend/src/pages/x/theme-toggle.tsx"));
  rmSync(root, { recursive: true });
});

test("a shared component implemented under features/ fails; a single-page one does not", () => {
  const root = tree({
    ...BASE,
    "design/system/components/lang-toggle.md": spec(
      "`frontend/src/features/auth/language-toggle.tsx`",
    ),
    "design/system/components/step-indicator.md": spec(
      "`frontend/src/features/task/step-indicator.tsx`",
      "｜**單頁專屬**",
    ),
    "frontend/src/features/auth/language-toggle.tsx": "export const x = 1;\n",
    "frontend/src/features/task/step-indicator.tsx": "export const x = 1;\n",
  });
  const r = checkTree(root, none);
  assert.match(
    r.violations.get("frontend/src/features/auth/language-toggle.tsx")[0],
    /lang-toggle/,
  );
  assert.equal(r.violations.has("frontend/src/features/task/step-indicator.tsx"), false);
  rmSync(root, { recursive: true });
});

test("a 程式實作 path that does not exist fails", () => {
  const root = tree({
    ...BASE,
    "design/system/components/card.md": spec("`frontend/src/components/ui/card.tsx`"),
  });
  assert.match(checkTree(root, none).errors.join("\n"), /card\.tsx` 不存在/);
  rmSync(root, { recursive: true });
});

test("test files are not scanned", () => {
  const root = tree({ ...BASE, "frontend/src/features/auth/session-banner.test.tsx": "x\n" });
  assert.equal(checkTree(root, none).violations.size, 0);
  rmSync(root, { recursive: true });
});

test("an allowlisted file is suppressed, and a row that no longer violates is stale", () => {
  const root = tree({ ...BASE, "frontend/src/pages/x/theme-toggle.tsx": "export const x = 1;\n" });
  const move = [
    { file: "frontend/src/pages/x/theme-toggle.tsx", component: "lang-toggle", movedBy: "#720" },
    { file: "frontend/src/pages/x/gone.tsx", component: "lang-toggle", movedBy: "#720" },
  ];
  const r = checkTree(root, { move, notSame: [] });
  assert.equal(r.violations.size, 0);
  assert.deepEqual(r.stale, ["frontend/src/pages/x/gone.tsx"]);
  rmSync(root, { recursive: true });
});

test("an allowlist row naming an unknown spec fails", () => {
  const root = tree(BASE);
  const move = [{ file: "frontend/src/pages/x/a.tsx", component: "no-such", movedBy: "#1" }];
  assert.match(checkTree(root, { move, notSame: [] }).errors.join("\n"), /no-such/);
  rmSync(root, { recursive: true });
});

test("the CLI passes on the repository as it stands", () => {
  const r = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^PASS:/);
});

test("the CLI reports NA when the root has no component specs", () => {
  const root = tree({ "README.md": "x\n" });
  const r = spawnSync(process.execPath, [SCRIPT, root], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^NA:/);
  rmSync(root, { recursive: true });
});
