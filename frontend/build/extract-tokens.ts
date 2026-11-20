/**
 * Vite plugin that serves only the custom properties of the prototype's
 * design tokens (design D8, clarification Q15).
 *
 * `design/prototype/assets/tokens.css` is the single source of colour, type,
 * radius and shadow values, but importing it whole would bring in a Google
 * Fonts request and global element rules (serif headings). This plugin reads
 * it at dev and build time, keeps only the `--*` declarations of the `:root`
 * and `html[data-theme="dark"]` rules, and serves them as the virtual module
 * `virtual:design-tokens.css`. Nothing is written to disk.
 *
 * The result is plain, unlayered CSS on purpose: Tailwind's theme variables
 * live in `@layer theme`, and unlayered declarations always win over layered
 * ones, so tokens.css keeps its values even where Tailwind uses the same
 * `--color-*` names (design D8 name collision).
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";

import type { Plugin } from "vite";

/** Repository-relative location of the token file, used in error messages. */
const TOKENS_SOURCE = "design/prototype/assets/tokens.css";

/** Absolute path of the prototype's tokens.css, resolved from this file. */
export const DEFAULT_TOKENS_PATH = fileURLToPath(
  new URL(`../../${TOKENS_SOURCE}`, import.meta.url),
);

const VIRTUAL_ID = "virtual:design-tokens.css";
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`;

/** Selectors whose custom properties are kept, compared after whitespace normalisation. */
const KEPT_SELECTORS = new Set([":root", 'html[data-theme="dark"]']);

/** Options for {@link extractTokens}. */
export interface ExtractTokensOptions {
  /** Absolute path of the token file; defaults to the prototype's tokens.css. */
  tokensPath?: string;
}

/** Normalises a selector so `html[data-theme='dark']` and extra spaces still match. */
function normaliseSelector(selector: string): string {
  return selector.replace(/\s+/g, " ").replace(/'/g, '"').trim();
}

/** Splits a rule body into declarations on `;` outside parentheses and quotes. */
function splitDeclarations(body: string): string[] {
  const declarations: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let index = 0; index < body.length; index += 1) {
    const char = body.charAt(index);
    if (quote !== null) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth = Math.max(0, depth - 1);
    } else if (char === ";" && depth === 0) {
      declarations.push(body.slice(start, index));
      start = index + 1;
    }
  }
  declarations.push(body.slice(start));
  return declarations.map((declaration) => declaration.trim()).filter((d) => d.length > 0);
}

/**
 * Returns a stylesheet holding only the custom properties of the `:root` and
 * `html[data-theme="dark"]` rules of `css`, one block per source rule and in
 * source order. Comments, at-rules (including `@import`) and every other rule
 * are dropped.
 */
export function extractCustomProperties(css: string): string {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks: string[] = [];
  let depth = 0;
  let preludeStart = 0;
  let bodyStart = 0;
  let selector = "";
  for (let index = 0; index < source.length; index += 1) {
    const char = source.charAt(index);
    if (char === ";" && depth === 0) {
      // A statement at-rule such as `@import url(...);`.
      preludeStart = index + 1;
    } else if (char === "{") {
      if (depth === 0) {
        selector = normaliseSelector(source.slice(preludeStart, index));
        bodyStart = index + 1;
      }
      depth += 1;
    } else if (char === "}") {
      depth = Math.max(0, depth - 1);
      if (depth === 0) {
        if (KEPT_SELECTORS.has(selector)) {
          const properties = splitDeclarations(source.slice(bodyStart, index)).filter(
            (declaration) => declaration.startsWith("--"),
          );
          if (properties.length > 0) {
            const lines = properties.map((declaration) => `  ${declaration};`).join("\n");
            blocks.push(`${selector} {\n${lines}\n}`);
          }
        }
        preludeStart = index + 1;
      }
    }
  }
  return `${blocks.join("\n\n")}\n`;
}

/**
 * Reads the token file. A missing file throws an error naming both the path
 * that was tried and the expected repository location, so the build fails
 * loudly instead of shipping an unstyled app.
 */
export async function readDesignTokens(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (error: unknown) {
    throw new Error(
      `Design tokens not found at ${path}. The frontend reads its colours, type and spacing from ${TOKENS_SOURCE}; make sure that file is present (a Docker build context must include design/prototype/assets/).`,
      { cause: error },
    );
  }
}

/** Vite plugin serving `virtual:design-tokens.css` (see the module comment). */
export function extractTokens(options: ExtractTokensOptions = {}): Plugin {
  const tokensPath = options.tokensPath ?? DEFAULT_TOKENS_PATH;
  return {
    name: "label-suite:extract-tokens",
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_VIRTUAL_ID : null;
    },
    async load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return null;
      // Reload in dev when the prototype's tokens change.
      this.addWatchFile(tokensPath);
      return extractCustomProperties(await readDesignTokens(tokensPath));
    },
  };
}
