import { compile } from "tailwindcss";
import tailwindCss from "tailwindcss/index.css?raw";
import { describe, expect, it } from "vitest";

import tokensCss from "../../../design/prototype/assets/tokens.css?raw";

import indexCss from "./index.css?raw";
import themeCss from "./theme.css?raw";

const DARK = 'html[data-theme="dark"]';
const THEME_INLINE = "@theme inline";

/** Colour literals that must never appear in the mapping layer (F6). */
const COLOUR_VALUE =
  /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(/i;

/** A value that only points at another custom property. */
const VAR_REFERENCE = /^var\(--[a-z0-9-]+\)$/;

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Declarations of every top-level block whose prelude equals `prelude`, merged in order. */
function declarationsOf(css: string, prelude: string): Map<string, string> {
  const source = stripComments(css);
  const declarations = new Map<string, string>();
  const blockPattern = /([^{}]+)\{([^{}]*)\}/g;
  for (const match of source.matchAll(blockPattern)) {
    const [, head = "", body = ""] = match;
    if (head.replace(/\s+/g, " ").trim() !== prelude) continue;
    for (const declaration of body.split(";")) {
      const colon = declaration.indexOf(":");
      if (colon === -1) continue;
      declarations.set(declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim());
    }
  }
  return declarations;
}

function hasBlock(css: string, prelude: string): boolean {
  return stripComments(css)
    .split("{")
    .some((head) => head.split(/[;}]/).at(-1)?.replace(/\s+/g, " ").trim() === prelude);
}

/** Every custom property name declared anywhere in tokens.css. */
function tokenNames(css: string): Set<string> {
  return new Set(
    Array.from(stripComments(css).matchAll(/(--[a-z0-9-]+)\s*:/gi), (m) => m[1] ?? ""),
  );
}

/**
 * The light mapping, row by row from ui-design.md §shadcn/ui 變數的對照 and
 * §shadcn 沒有對應語意的 token.
 */
const EXPECTED_LIGHT_MAPPING: Record<string, string> = {
  // Approved in the artifact's Token mapping section.
  "--background": "var(--color-surface)",
  "--primary": "var(--color-primary-strong)",
  "--destructive": "var(--color-error)",
  "--input": "var(--color-border-control)",
  // Proposed rows of the shadcn table.
  "--foreground": "var(--color-ink)",
  "--card": "var(--color-white)",
  "--card-foreground": "var(--color-ink)",
  "--primary-foreground": "var(--color-on-cta)",
  "--secondary": "var(--color-border-muted)",
  "--secondary-foreground": "var(--color-ink)",
  "--muted": "var(--color-border-muted)",
  "--muted-foreground": "var(--color-ink-muted)",
  "--accent": "var(--color-primary-soft-bg)",
  "--accent-foreground": "var(--color-primary-strong)",
  "--destructive-foreground": "var(--color-on-cta)",
  "--border": "var(--color-border)",
  "--ring": "var(--color-primary)",
  // Semantics shadcn has no variable for.
  "--cta": "var(--color-cta)",
  "--cta-foreground": "var(--color-on-cta)",
  "--cta-hover": "var(--color-cta-hover)",
  "--primary-border": "var(--color-primary-border)",
  "--success": "var(--color-success)",
  "--success-bg": "var(--color-success-bg)",
  "--success-border": "var(--color-success-border)",
  "--warning": "var(--color-warning)",
  "--warning-bg": "var(--color-warning-bg)",
  "--warning-border": "var(--color-warning-border)",
  "--error": "var(--color-error)",
  "--error-bg": "var(--color-error-bg)",
  "--error-border": "var(--color-error-border)",
  "--info": "var(--color-info)",
  "--info-bg": "var(--color-info-bg)",
  "--info-border": "var(--color-info-border)",
  "--control-disabled": "var(--color-slate-50)",
  "--surface-subtle": "var(--color-slate-50)",
  "--icon-accent": "var(--color-primary)",
  "--card-shadow": "var(--shadow-card)",
  // The sidebar's current-location background (sidebar-nav ui-design §元件與 design token, D14).
  "--nav-active": "var(--nav-active-bg)",
};

/**
 * `@theme inline` keys that share a name with a tokens.css variable (design D8
 * name collision). Unlayered tokens win over Tailwind's `@layer theme`, and
 * `inline` keeps utilities off these names, so the collisions are harmless
 * today. A new collision must be looked at by a person before it joins this list.
 */
const KNOWN_COLLISIONS = [
  "--color-accent",
  "--color-border",
  "--color-cta",
  "--color-cta-hover",
  "--color-error",
  "--color-error-bg",
  "--color-error-border",
  "--color-info",
  "--color-info-bg",
  "--color-info-border",
  "--color-primary",
  "--color-primary-border",
  "--color-secondary",
  "--color-success",
  "--color-success-bg",
  "--color-success-border",
  "--color-warning",
  "--color-warning-bg",
  "--color-warning-border",
];

describe("theme.css, the semantic mapping layer", () => {
  const light = declarationsOf(themeCss, ":root");
  const dark = declarationsOf(themeCss, DARK);
  const inline = declarationsOf(themeCss, THEME_INLINE);

  it("maps the four approved shadcn variables to their token names", () => {
    expect(light.get("--primary")).toBe("var(--color-primary-strong)");
    expect(light.get("--destructive")).toBe("var(--color-error)");
    expect(light.get("--background")).toBe("var(--color-surface)");
    expect(light.get("--input")).toBe("var(--color-border-control)");
  });

  it("maps every semantic variable listed in ui-design.md, and nothing else", () => {
    expect(Object.fromEntries(light)).toEqual(EXPECTED_LIGHT_MAPPING);
  });

  it("points every mapped variable at a variable that tokens.css declares", () => {
    const names = tokenNames(tokensCss);
    const unknown = Array.from(light.values())
      .map((value) => value.slice("var(".length, -1))
      .filter((name) => !names.has(name));

    expect(unknown).toEqual([]);
  });

  it("contains no colour value anywhere, the dark block included", () => {
    expect(themeCss).not.toMatch(COLOUR_VALUE);
    expect(hasBlock(themeCss, DARK)).toBe(true);
    for (const value of [...light.values(), ...dark.values(), ...inline.values()]) {
      expect(value).toMatch(VAR_REFERENCE);
    }
  });

  it("hands Tailwind only semantic variables through @theme inline", () => {
    expect(inline.size).toBeGreaterThan(0);
    for (const value of inline.values()) {
      const target = value.slice("var(".length, -1);
      expect(target.startsWith("--color-"), `${value} bypasses the mapping layer`).toBe(false);
      expect(light.has(target), `${value} is not a mapped semantic variable`).toBe(true);
    }
  });

  it("has exactly the known @theme inline keys that collide with tokens.css names", () => {
    const names = tokenNames(tokensCss);
    const colliding = Array.from(inline.keys()).filter(
      (key) => key.startsWith("--color-") && names.has(key),
    );

    const unexpected = colliding.filter((key) => !KNOWN_COLLISIONS.includes(key)).sort();
    const missing = KNOWN_COLLISIONS.filter((key) => !colliding.includes(key)).sort();
    expect({ unexpected, missing }).toEqual({ unexpected: [], missing: [] });
  });
});

/**
 * Compiles index.css with Tailwind and returns the CSS generated for
 * `candidates`, so a test sees what the build would emit for those classes.
 */
async function buildUtilities(candidates: string[]): Promise<string> {
  const stylesheets: Record<string, string> = {
    tailwindcss: tailwindCss,
    "./theme.css": themeCss,
  };
  const compiler = await compile(indexCss, {
    base: "/",
    loadStylesheet: (id, base) => {
      const content = stylesheets[id];
      if (content === undefined) {
        return Promise.reject(new Error(`index.css imports an unexpected stylesheet: ${id}`));
      }
      return Promise.resolve({ path: id, base, content });
    },
  });
  return compiler.build(candidates);
}

describe("index.css, the Tailwind entry", () => {
  it("generates no utility from Tailwind's default palette (F6)", async () => {
    const palette = ["bg-white", "text-black", "bg-slate-50", "hover:bg-slate-50", "ring-red-500"];

    const css = await buildUtilities(palette);

    for (const candidate of palette) {
      expect(css, `${candidate} was generated`).not.toContain(`.${candidate.replace(":", "\\:")}`);
    }
    expect(css).not.toMatch(/--color-(?:white|black|slate-50|red-500)\s*:/);
  });

  it("still generates the semantic utilities of the mapping layer", async () => {
    const css = await buildUtilities([
      "bg-nav-active",
      "bg-primary",
      "text-muted-foreground",
      "border-input",
      "bg-surface-subtle",
      "text-icon-accent",
    ]);

    expect(css).toContain(".bg-primary");
    expect(css).toContain("var(--primary)");
    expect(css).toContain(".text-muted-foreground");
    expect(css).toContain(".border-input");
    expect(css).toContain(".bg-surface-subtle");
    expect(css).toContain("var(--surface-subtle)");
    expect(css).toContain(".text-icon-accent");
    expect(css).toContain("var(--icon-accent)");
    expect(css).toContain(".bg-nav-active");
    expect(css).toContain("var(--nav-active)");
  });

  it("imports Tailwind and the mapping layer", () => {
    expect(indexCss).toMatch(/@import\s+["']tailwindcss["'];/);
    expect(indexCss).toMatch(/@import\s+["']\.\/theme\.css["'];/);
  });

  it("drives the dark variant from the data-theme attribute", () => {
    expect(indexCss).toContain(
      '@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));',
    );
  });

  it("stops the spinning animation when reduced motion is preferred", () => {
    const source = stripComments(indexCss);
    const media = source.indexOf("@media (prefers-reduced-motion: reduce)");

    expect(media).toBeGreaterThan(-1);
    expect(source.slice(media)).toMatch(/\.animate-spin\s*\{\s*animation:\s*none;?\s*\}/);
  });

  it("contains no colour value and no :root block", () => {
    expect(indexCss).not.toMatch(COLOUR_VALUE);
    expect(hasBlock(indexCss, ":root")).toBe(false);
    expect(indexCss).not.toMatch(/@import[^;]*tokens\.css/);
  });
});
