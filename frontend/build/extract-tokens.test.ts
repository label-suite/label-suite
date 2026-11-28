// @vitest-environment node
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";

import { build } from "vite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_DATA_PALETTE_PATH,
  DEFAULT_TOKENS_PATH,
  extractCustomProperties,
  extractTokens,
  readDesignTokens,
} from "./extract-tokens";

const REAL_TOKENS_PATH = fileURLToPath(
  new URL("../../design/prototype/assets/tokens.css", import.meta.url),
);

const REAL_PALETTE_PATH = fileURLToPath(
  new URL("../../design/prototype/assets/data-palette.css", import.meta.url),
);

const SAMPLE = `
@import url('https://fonts.googleapis.com/css2?family=Inter&display=swap');
/* a comment that mentions :root { --color-fake: #000000; } */
:root { --color-primary: #4F46E5; }
html[data-theme="dark"] { --color-primary: #818CF8; }
body { color: red; }
`;

/** Returns the declarations inside every block whose selector is `selector`. */
function blockBodies(css: string, selector: string): string[] {
  const bodies: string[] = [];
  let index = css.indexOf(`${selector} {`);
  while (index !== -1) {
    const open = css.indexOf("{", index);
    const close = css.indexOf("}", open);
    bodies.push(css.slice(open + 1, close));
    index = css.indexOf(`${selector} {`, close);
  }
  return bodies;
}

describe("extractCustomProperties", () => {
  it("keeps only the custom properties of the :root and dark blocks", () => {
    const result = extractCustomProperties(SAMPLE);

    expect(blockBodies(result, ":root").join("")).toContain("--color-primary: #4F46E5");
    expect(blockBodies(result, 'html[data-theme="dark"]').join("")).toContain(
      "--color-primary: #818CF8",
    );
    expect(result).not.toContain("body");
    expect(result).not.toContain("color: red");
    expect(result).not.toContain("@import");
    expect(result).not.toContain("fonts.googleapis.com");
    // Commented-out text is not a declaration.
    expect(result).not.toContain("--color-fake");
  });

  it("drops non-custom declarations inside a kept block", () => {
    const result = extractCustomProperties(":root { color: red; --space-sm: 8px; }");

    expect(result).toContain("--space-sm: 8px");
    expect(result).not.toContain("color: red");
  });

  it("keeps values that contain parentheses, commas and quotes intact", () => {
    const result = extractCustomProperties(
      ":root { --shadow-card: 0 4px 24px rgba(99, 102, 241, 0.10), 0 1px 4px rgba(0, 0, 0, 0.06); --font-sans: 'Inter', sans-serif; }",
    );

    expect(result).toContain(
      "--shadow-card: 0 4px 24px rgba(99, 102, 241, 0.10), 0 1px 4px rgba(0, 0, 0, 0.06);",
    );
    expect(result).toContain("--font-sans: 'Inter', sans-serif;");
  });

  it("keeps the light and the dark block of the real tokens.css, both defining --color-surface", async () => {
    const result = extractCustomProperties(await readDesignTokens(REAL_TOKENS_PATH));

    const light = blockBodies(result, ":root");
    const dark = blockBodies(result, 'html[data-theme="dark"]');
    expect(light.some((body) => body.includes("--color-surface:"))).toBe(true);
    expect(dark.some((body) => body.includes("--color-surface:"))).toBe(true);
  });

  it("never wraps the result in a cascade layer (design D8 name collision)", async () => {
    const result = extractCustomProperties(await readDesignTokens(REAL_TOKENS_PATH));

    expect(result).not.toContain("@layer");
    expect(result).not.toContain("@import");
    expect(result).not.toMatch(/(^|\n)\s*(body|h1|h2|h3|code)\b/);
  });
});

describe("data palette extraction", () => {
  it("defaults to the prototype's data-palette.css", () => {
    expect(DEFAULT_DATA_PALETTE_PATH).toBe(REAL_PALETTE_PATH);
  });

  it("defines the three role colours in both the :root and the dark block", async () => {
    const result = extractCustomProperties(await readDesignTokens(REAL_PALETTE_PATH));

    const light = blockBodies(result, ":root").join("");
    const dark = blockBodies(result, 'html[data-theme="dark"]').join("");
    for (const name of [
      "--data-role-emerald-bg",
      "--data-role-violet-bg",
      "--data-role-indigo-bg",
    ]) {
      expect(light).toContain(`${name}:`);
      expect(dark).toContain(`${name}:`);
    }
  });
});

describe("readDesignTokens", () => {
  it("throws an error naming design/prototype/assets/tokens.css when the file is missing", async () => {
    const missing = "/no/such/place/design/prototype/assets/tokens.css";

    await expect(readDesignTokens(missing)).rejects.toThrow(missing);
    await expect(readDesignTokens("/nowhere.css")).rejects.toThrow(
      "design/prototype/assets/tokens.css",
    );
  });

  it("defaults to the prototype's tokens.css", () => {
    expect(DEFAULT_TOKENS_PATH).toBe(REAL_TOKENS_PATH);
  });
});

describe("extractTokens plugin", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "extract-tokens-"));
    await writeFile(join(root, "index.js"), 'import "virtual:design-tokens.css";\n');
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function buildWith(tokensPath: string, dataPalettePath?: string): Promise<string> {
    // Default to an existing palette so tokens-only tests do not depend on it.
    let palettePath = dataPalettePath;
    if (palettePath === undefined) {
      palettePath = join(root, "data-palette.css");
      await writeFile(palettePath, ":root { --data-sample: #000000; }\n");
    }
    const output = await build({
      root,
      configFile: false,
      logLevel: "silent",
      plugins: [extractTokens({ tokensPath, dataPalettePath: palettePath })],
      build: {
        write: false,
        lib: { entry: join(root, "index.js"), formats: ["es"], fileName: "index" },
      },
    });
    const outputs = Array.isArray(output) ? output : [output];
    return outputs
      .flatMap((result) => ("output" in result ? result.output : []))
      .map((chunk) =>
        chunk.type === "asset" && typeof chunk.source === "string" ? chunk.source : "",
      )
      .join("\n");
  }

  it("serves the extracted tokens as virtual:design-tokens.css", async () => {
    const tokensPath = join(root, "tokens.css");
    await writeFile(tokensPath, SAMPLE);

    const css = await buildWith(tokensPath);

    expect(css).toMatch(/--color-primary:\s*#4f46e5/i);
    expect(css).toMatch(/--color-primary:\s*#818cf8/i);
    expect(css).not.toContain("color:red");
    expect(css).not.toContain("fonts.googleapis.com");
  });

  it("fails the build with the missing path when tokens.css does not exist", async () => {
    const missing = join(root, "design/prototype/assets/tokens.css");

    await expect(buildWith(missing)).rejects.toThrow("design/prototype/assets/tokens.css");
  });

  it("serves the real tokens and data palette with every --data- declaration after the tokens.css ones", async () => {
    const css = await buildWith(REAL_TOKENS_PATH, REAL_PALETTE_PATH);

    for (const name of ["emerald", "violet", "indigo"]) {
      expect(css.match(new RegExp(`--data-role-${name}-bg:`, "g"))?.length).toBe(2);
    }
    const firstData = css.indexOf("--data-");
    expect(firstData).toBeGreaterThan(-1);
    expect(firstData).toBeGreaterThan(css.indexOf("--color-surface"));
    // Only references to tokens.css values (var(--color-...)) may follow it.
    expect(css.slice(firstData).match(/--color-[a-z0-9-]+\s*:/g)).toBeNull();
  });

  it("fails the build naming data-palette.css when that file does not exist", async () => {
    const tokensPath = join(root, "tokens.css");
    await writeFile(tokensPath, SAMPLE);
    const missing = join(root, "design/prototype/assets/data-palette.css");

    await expect(buildWith(tokensPath, missing)).rejects.toThrow(
      "design/prototype/assets/data-palette.css",
    );
  });
});
