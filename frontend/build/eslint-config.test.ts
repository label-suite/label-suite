// @vitest-environment node
/**
 * The fast-refresh rule (eslint.config.js) must stay on, yet accept the
 * variant tables the plan requires components/ui to export next to their
 * components (design D9), so `pnpm lint` ends with zero warnings.
 */
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
