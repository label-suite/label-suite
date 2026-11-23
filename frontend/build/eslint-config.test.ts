// @vitest-environment node
/**
 * The fast-refresh rule (eslint.config.js) must stay on, yet accept the
 * variant tables the plan requires components/ui to export next to their
 * components (design D9), so `pnpm lint` ends with zero warnings.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath, URL } from "node:url";

import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const FRONTEND_ROOT = fileURLToPath(new URL("..", import.meta.url));
const RULE = "react-refresh/only-export-components";

/** The primitives that export variant tables next to their component. */
const FILES_WITH_VARIANT_EXPORTS = [
  "src/components/ui/alert.tsx",
  "src/components/ui/badge.tsx",
  "src/components/ui/button.tsx",
];

describe("eslint.config.js fast-refresh rule", () => {
  it("is still enabled for components/ui", async () => {
    const eslint = new ESLint({ cwd: FRONTEND_ROOT });

    const config: unknown = await eslint.calculateConfigForFile("src/components/ui/button.tsx");

    expect(config).toMatchObject({ rules: { [RULE]: [1, expect.anything()] } });
  });

  it("accepts the variant tables the plan requires to be exported", async () => {
    const eslint = new ESLint({ cwd: FRONTEND_ROOT });

    const results = await eslint.lintFiles(FILES_WITH_VARIANT_EXPORTS);

    const warnings = results.flatMap(({ filePath, messages }) =>
      messages
        .filter(({ ruleId }) => ruleId === RULE)
        .map(({ line, message }) => `${filePath}:${String(line)} ${message}`),
    );
    expect(warnings).toEqual([]);
  }, 30_000);
});

/**
 * Every file under `src/` has to belong to a layer, because the dependency
 * rules only judge files they can classify (openspec/specs/frontend-code-
 * boundaries: all front-end source SHALL be layered). `src/pages/*` matches
 * the page folder, so a file sitting directly in `src/pages/` matched no
 * element and escaped the layer rules entirely -- the same bad import was
 * reported inside a page folder and silently accepted at the root.
 *
 * The files are real, not `lintText` on a virtual path: the plugin classifies
 * by looking at the path on disk, so a path that does not exist is not
 * classified and the case would pass while measuring nothing.
 */
describe("eslint.config.js layer classification", () => {
  /** A page reaching into a feature's internals, which F1 forbids. */
  const BAD_IMPORT =
    'import { toHealthViewState } from "%s/features/system-health/to-health-view-state";\n' +
    "export const probe = toHealthViewState;\n";

  const lintReal = async (relativePath: string, upwards: string) => {
    const absolute = fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, BAD_IMPORT.replace("%s", upwards), "utf8");
    try {
      const eslint = new ESLint({ cwd: FRONTEND_ROOT });
      const results = await eslint.lintFiles([absolute]);
      // Severity matters, not just the message: the spec requires lint to
      // *fail*. Collecting rule ids alone kept these cases green when the rule
      // was downgraded to `warn`, and `pnpm lint` is plain `eslint .`, so a
      // warning exits 0 and the requirement would have been silently lost.
      return results.flatMap(({ messages }) =>
        messages
          .filter(({ severity }) => severity === 2)
          .map(({ ruleId, message }) => `${ruleId ?? "(fatal)"} ${message}`),
      );
    } finally {
      await rm(absolute, { force: true });
    }
  };

  it("does not let a file directly in src/pages/ escape the layer rules", async () => {
    const errors = await lintReal("src/pages/boundary-probe.tsx", "..");

    expect(errors.filter((e) => e.startsWith("boundaries/"))).not.toEqual([]);
  }, 30_000);

  it("still reports the same import inside a page folder", async () => {
    const errors = await lintReal("src/pages/dev-health/boundary-probe.tsx", "../..");

    // The message, not only the rule id: an element pattern that misclassifies
    // a page still produces a `boundaries/dependencies` error, so matching the
    // id alone would accept a fix that is too broad.
    expect(errors).toEqual([
      expect.stringContaining("pages may only import a feature through its index.ts"),
    ]);
  }, 30_000);
});

/**
 * `pnpm lint` must treat any warning as a failure (spec frontend-code-
 * boundaries, "lint 不容許警告"). `eslint --max-warnings 0` is the CLI's
 * rule: it exits non-zero when the warning count exceeds the limit. The Node
 * API has no such option, so the verdict is derived the same way here, and
 * the package script is checked for the flag itself.
 */
describe("lint zero-warning gate", () => {
  const PROBE = "src/components/boundary-probe.tsx";

  it("runs eslint with --max-warnings 0 in the lint script", async () => {
    const raw = await readFile(new URL("../package.json", import.meta.url), "utf8");
    const parsed: unknown = JSON.parse(raw);
    const scripts =
      typeof parsed === "object" && parsed !== null && "scripts" in parsed ? parsed.scripts : null;
    const lint =
      typeof scripts === "object" && scripts !== null && "lint" in scripts ? scripts.lint : null;

    expect(lint).toBe("eslint . --max-warnings 0");
  });

  it("fails the zero-warning gate when the layer rule is downgraded to warn", async () => {
    const absolute = fileURLToPath(new URL(`../${PROBE}`, import.meta.url));
    await mkdir(dirname(absolute), { recursive: true });
    // components may not import pages (F1 layer table).
    await writeFile(
      absolute,
      'import { DevHealthPage } from "../pages/dev-health";\nexport const probe = DevHealthPage;\n',
      "utf8",
    );
    try {
      const eslint = new ESLint({
        cwd: FRONTEND_ROOT,
        overrideConfig: { rules: { "boundaries/dependencies": "warn" } },
      });
      const results = await eslint.lintFiles([absolute]);

      const errorCount = results.reduce((sum, result) => sum + result.errorCount, 0);
      const warningCount = results.reduce((sum, result) => sum + result.warningCount, 0);
      const warned = results.flatMap(({ messages }) =>
        messages.filter(
          ({ ruleId, severity }) => ruleId === "boundaries/dependencies" && severity === 1,
        ),
      );
      const maxWarnings = 0;

      // Only a warning, so a plain `eslint .` would exit 0; the gate fails it.
      expect(errorCount).toBe(0);
      expect(warned).not.toEqual([]);
      expect(warningCount > maxWarnings).toBe(true);
    } finally {
      await rm(absolute, { force: true });
    }
  }, 30_000);
});
