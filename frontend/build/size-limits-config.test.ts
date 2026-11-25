// @vitest-environment node
/**
 * Standing probes for the size and complexity limits in eslint.config.js
 * (frontend-agent-rules F12; #561, clarification Q2-Q4, Q7, Q8, Q10).
 *
 * They prove on every run that each limit still fails a sample one unit over
 * it, that the agreed numbers and the error level have not been loosened, that
 * test files are exempt from the two length limits only, and that every named
 * exemption is still needed. Verdicts always match `ruleId` plus
 * `severity === 2`: `pnpm lint` must *fail*, and a warning alone would not
 * fail it here.
 *
 * Probe files are real files on disk, not `lintText` on a virtual path: the
 * type-aware rules (`projectService`) cannot parse a path that does not exist.
 * They use their own names (`size-probe*`), so they never collide with the
 * `boundary-probe.tsx` that eslint-config.test.ts writes in parallel.
 */
import { readdir, rm, writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath, URL } from "node:url";

import { ESLint, type Linter } from "eslint";
import { describe, expect, it } from "vitest";

const FRONTEND_ROOT = fileURLToPath(new URL("..", import.meta.url));
const TIMEOUT = 30_000;

const PROBE = "src/components/size-probe.tsx";
const TEST_PROBE = "src/components/size-probe.test.tsx";

/** The agreed limits, written out on purpose: changing a number must change this test too. */
const EXPECTED = {
  "max-lines": { max: 300, skipBlankLines: true, skipComments: true },
  "max-lines-per-function": { max: 80, skipBlankLines: true, skipComments: true, IIFEs: false },
  complexity: { max: 15 },
} as const;

type SizeRule = keyof typeof EXPECTED;
const SIZE_RULES: readonly SizeRule[] = ["max-lines", "max-lines-per-function", "complexity"];

/** The only named exemption allowed today: file -> rule -> raised maximum (#561, Q8). */
const ALLOWED_EXEMPTIONS: Readonly<Record<string, Partial<Record<SizeRule, number>>>> = {
  "src/pages/dev-gallery/dev-gallery-page.tsx": { "max-lines-per-function": 180 },
};

/** The effective entry a rule is expected to have, as ESLint reports it. */
function expectedEntry(file: string, rule: SizeRule): unknown[] {
  const raised = ALLOWED_EXEMPTIONS[file]?.[rule];
  const options = raised === undefined ? EXPECTED[rule] : { ...EXPECTED[rule], max: raised };
  return [2, options];
}

/** Reads one rule's effective entry out of a `calculateConfigForFile` result. */
function ruleEntry(config: unknown, rule: string): unknown {
  if (typeof config !== "object" || config === null || !("rules" in config)) return undefined;
  const rules: unknown = config.rules;
  if (typeof rules !== "object" || rules === null) return undefined;
  return Object.entries(rules).find(([name]) => name === rule)?.[1];
}

/** True when the entry is absent or switched off. */
function isOff(entry: unknown): boolean {
  return entry === undefined || (Array.isArray(entry) && entry[0] === 0);
}

async function effectiveEntry(eslint: ESLint, file: string, rule: string): Promise<unknown> {
  const config: unknown = await eslint.calculateConfigForFile(file);
  return ruleEntry(config, rule);
}

// ---- Probe content: type-correct TypeScript, generated from the limits ----

function fillerLines(count: number, from = 0): string[] {
  return Array.from(
    { length: count },
    (_, i) => `export const filler${String(from + i)} = ${String(i)};`,
  );
}

/** A function of exactly `lines` lines, braces included. */
function longFunction(lines: number): string[] {
  const additions = Array.from({ length: lines - 4 }, (_, i) => `  total += ${String(i)};`);
  return [
    "export function longProbe(): number {",
    "  let total = 0;",
    ...additions,
    "  return total;",
    "}",
  ];
}

/** A function with `branches` independent `if` statements (complexity branches + 1). */
function complexFunction(branches: number): string[] {
  const ifs = Array.from(
    { length: branches },
    (_, i) => `  if (value === ${String(i)}) { return ${String(i)}; }`,
  );
  return ["export function complexProbe(value: number): number {", ...ifs, "  return -1;", "}"];
}

/** A file of `max-lines + 1` code lines holding a too-long and a too-complex function. */
function overLimitSource(): string {
  const functions = [
    ...longFunction(EXPECTED["max-lines-per-function"].max + 1),
    ...complexFunction(EXPECTED.complexity.max + 1),
  ];
  const filler = fillerLines(EXPECTED["max-lines"].max + 1 - functions.length);
  return [...functions, ...filler].join("\n") + "\n";
}

/**
 * Exactly `max-lines` code lines, one function exactly at `max-lines-per-function`,
 * plus 40 blank and 40 comment lines.
 */
function atLimitWithBlanksAndComments(): string {
  const longest = longFunction(EXPECTED["max-lines-per-function"].max);
  const code = [...longest, ...fillerLines(EXPECTED["max-lines"].max - longest.length)];
  const padding = Array.from({ length: 40 }, (_, i) => ["", `// comment ${String(i)}`]).flat();
  return [...padding, ...code].join("\n") + "\n";
}

/** Writes a probe, lints it, and always removes it; returns the error-level rule ids. */
async function lintProbe(relativePath: string, source: string): Promise<string[]> {
  const absolute = fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
  await writeFile(absolute, source, "utf8");
  try {
    const results = await new ESLint({ cwd: FRONTEND_ROOT }).lintFiles([absolute]);
    return results.flatMap(({ messages }) =>
      messages.filter(({ severity }) => severity === 2).map(({ ruleId }) => ruleId ?? "(fatal)"),
    );
  } finally {
    await rm(absolute, { force: true });
  }
}

describe("size and complexity limits: agreed values", () => {
  it(
    "(a) applies the three limits at error level with the agreed options",
    async () => {
      const eslint = new ESLint({ cwd: FRONTEND_ROOT });
      const config: unknown = await eslint.calculateConfigForFile(PROBE);

      for (const rule of SIZE_RULES) {
        expect(ruleEntry(config, rule), rule).toEqual([2, EXPECTED[rule]]);
      }
    },
    TIMEOUT,
  );

  it(
    "(e) leaves config files alone and ignores generated files",
    async () => {
      const eslint = new ESLint({ cwd: FRONTEND_ROOT });

      expect(isOff(await effectiveEntry(eslint, "eslint.config.js", "max-lines"))).toBe(true);
      expect(isOff(await effectiveEntry(eslint, "orval.config.ts", "max-lines"))).toBe(true);
      expect(
        await eslint.calculateConfigForFile("src/api/generated/label-suite.ts"),
      ).toBeUndefined();
    },
    TIMEOUT,
  );
});

describe("size and complexity limits: probe files", () => {
  it(
    "(b) fails a file, a function and a complexity one unit over the limits",
    async () => {
      const errors = await lintProbe(PROBE, overLimitSource());

      for (const rule of SIZE_RULES) {
        expect(
          errors.filter((id) => id === rule),
          rule,
        ).toHaveLength(1);
      }
    },
    TIMEOUT,
  );

  it(
    "(c) passes a file and a function exactly at the limits, blank lines and comments not counted",
    async () => {
      const errors = await lintProbe(PROBE, atLimitWithBlanksAndComments());

      expect(errors).not.toContain("max-lines");
      expect(errors).not.toContain("max-lines-per-function");
    },
    TIMEOUT,
  );

  it(
    "(d) exempts test files from the two length limits but not from complexity",
    async () => {
      const errors = await lintProbe(TEST_PROBE, overLimitSource());

      expect(errors).not.toContain("max-lines");
      expect(errors).not.toContain("max-lines-per-function");
      expect(errors).toContain("complexity");
    },
    TIMEOUT,
  );

  it(
    "removes every probe file it wrote",
    async () => {
      const entries = await readdir(new URL("../src/components/", import.meta.url));

      expect(entries.filter((name) => name.startsWith("size-probe"))).toEqual([]);
    },
    TIMEOUT,
  );
});

// ---- Walk over every linted source file (design D3) ----

interface Exemption {
  /** Path relative to frontend/. */
  file: string;
  /** The limit the file is exempted from. */
  rule: SizeRule;
}

interface WalkResult {
  /** `file rule entry` for every effective setting that differs from the agreement. */
  violations: string[];
  /** Files whose settings differ in an allowed way. */
  exemptions: Exemption[];
}

const isTestFile = (file: string): boolean =>
  file.endsWith(".test.ts") || file.endsWith(".test.tsx") || file.startsWith("src/test/");

/** Files matching SOURCE_FILES (src/**\/*.{ts,tsx}, build/**\/*.ts); readdir only, no stat. */
async function sourceFiles(): Promise<string[]> {
  const list = async (dir: string, pattern: RegExp): Promise<string[]> => {
    const entries = await readdir(new URL(`../${dir}/`, import.meta.url), { recursive: true });
    return entries.filter((entry) => pattern.test(entry)).map((entry) => `${dir}/${entry}`);
  };
  return [...(await list("src", /\.tsx?$/)), ...(await list("build", /\.ts$/))];
}

async function checkTestFile(eslint: ESLint, file: string, out: WalkResult): Promise<void> {
  const entry = await effectiveEntry(eslint, file, "complexity");
  if (!isDeepStrictEqual(entry, [2, EXPECTED.complexity])) {
    out.violations.push(`${file} complexity ${JSON.stringify(entry)}`);
  }
}

async function checkSourceFile(eslint: ESLint, file: string, out: WalkResult): Promise<void> {
  const config: unknown = await eslint.calculateConfigForFile(file);
  for (const rule of SIZE_RULES) {
    const entry = ruleEntry(config, rule);
    if (isDeepStrictEqual(entry, [2, EXPECTED[rule]])) continue;
    if (isDeepStrictEqual(entry, expectedEntry(file, rule))) out.exemptions.push({ file, rule });
    else out.violations.push(`${file} ${rule} ${JSON.stringify(entry)}`);
  }
}

let walk: Promise<WalkResult> | undefined;

/** Walks once and shares the result between (f) and (g). */
function walkSources(): Promise<WalkResult> {
  walk ??= (async () => {
    const eslint = new ESLint({ cwd: FRONTEND_ROOT });
    const out: WalkResult = { violations: [], exemptions: [] };
    for (const file of await sourceFiles()) {
      // Ignored files (src/api/generated/) have no config and belong to neither group.
      if ((await eslint.calculateConfigForFile(file)) === undefined) continue;
      if (isTestFile(file)) await checkTestFile(eslint, file, out);
      else await checkSourceFile(eslint, file, out);
    }
    return out;
  })();
  return walk;
}

describe("size and complexity limits: exemptions", () => {
  it(
    "(f) keeps test-file complexity on and allows no exemption beyond the named one",
    async () => {
      const { violations } = await walkSources();

      expect(violations).toEqual([]);
    },
    TIMEOUT,
  );

  it(
    "finds exactly the allowed exemptions, so a moved, deleted or orphaned entry fails",
    async () => {
      const { exemptions } = await walkSources();
      const allowed = Object.entries(ALLOWED_EXEMPTIONS).flatMap(([file, rules]) =>
        Object.keys(rules).map((rule) => `${file} ${rule}`),
      );

      expect(exemptions.map(({ file, rule }) => `${file} ${rule}`).sort()).toEqual(allowed.sort());
    },
    TIMEOUT,
  );

  it(
    "(g) fails when a named exemption is no longer needed",
    async () => {
      const { exemptions } = await walkSources();
      const expired: string[] = [];

      for (const { file, rule } of exemptions) {
        const restored: Linter.RulesRecord = { [rule]: ["error", EXPECTED[rule]] };
        const eslint = new ESLint({ cwd: FRONTEND_ROOT, overrideConfig: { rules: restored } });
        const results = await eslint.lintFiles([file]);
        const stillOver = results.some(({ messages }) =>
          messages.some(({ ruleId, severity }) => ruleId === rule && severity === 2),
        );
        if (!stillOver)
          expired.push(`exemption expired: ${file} ${rule}; remove it from NAMED_EXEMPTIONS`);
      }

      expect(expired).toEqual([]);
    },
    TIMEOUT,
  );
});
