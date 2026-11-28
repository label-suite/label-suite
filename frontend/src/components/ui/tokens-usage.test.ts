import { describe, expect, it } from "vitest";

/**
 * Raw source of every component file in this folder, keyed by path. Read as
 * text so the check covers class strings, not only what renders in jsdom.
 */
const sources = import.meta.glob<string>("./*.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** A tokens.css variable name; components must use semantic variables (Q9). */
const TOKEN_NAME = /--color-[a-z0-9-]+/;

/** A data-palette.css variable; data colours belong to feature components, not primitives. */
const DATA_TOKEN = /--data-[a-z0-9-]+/;

/** Colour literals (F6). */
const COLOUR_VALUE = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/i;

/** Tailwind's own palette (text-white, bg-slate-50, ring-red-500, ...), not our tokens. */
const PALETTE_CLASS =
  /\b(?:bg|text|border|ring|outline|fill|stroke|shadow|from|via|to|divide|placeholder|decoration|accent|caret)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b/;

/**
 * The primitives of system-design.md §目錄結構, plus label and separator
 * (login-auth-guard 6.3), dialog (sidebar-nav D9) and metric (dashboard-shell D7).
 */
const PRIMITIVES = [
  "./alert.tsx",
  "./badge.tsx",
  "./button.tsx",
  "./card.tsx",
  "./dialog.tsx",
  "./empty.tsx",
  "./input.tsx",
  "./label.tsx",
  "./metric.tsx",
  "./separator.tsx",
  "./skeleton.tsx",
];

describe("components/ui uses only semantic variables", () => {
  const primitives = Object.keys(sources)
    .filter((path) => !path.endsWith(".test.tsx"))
    .sort();

  it("holds exactly the eleven primitives", () => {
    expect(primitives).toEqual(PRIMITIVES);
  });

  it("recognises each forbidden form, so a clean result means something", () => {
    expect("text-(--color-primary)").toMatch(TOKEN_NAME);
    expect("bg-[#4F46E5]").toMatch(COLOUR_VALUE);
    expect("bg-[rgb(0,0,0)]").toMatch(COLOUR_VALUE);
    expect("bg-[var(--data-role-violet-bg)]").toMatch(DATA_TOKEN);
    expect("text-white").toMatch(PALETTE_CLASS);
    expect("hover:bg-slate-50").toMatch(PALETTE_CLASS);
    expect("text-success bg-error-bg border-border").not.toMatch(PALETTE_CLASS);
  });

  it.each(Object.entries(sources))("%s names no tokens.css variable", (_path, source) => {
    expect(source).not.toMatch(TOKEN_NAME);
  });

  it.each(Object.entries(sources))("%s names no data-palette.css variable", (_path, source) => {
    expect(source).not.toMatch(DATA_TOKEN);
  });

  it.each(Object.entries(sources))("%s writes no colour value", (_path, source) => {
    expect(source).not.toMatch(COLOUR_VALUE);
  });

  it.each(Object.entries(sources))("%s uses no Tailwind palette class", (_path, source) => {
    expect(source).not.toMatch(PALETTE_CLASS);
  });
});

/** The shadcn mapping layer, read as text (a glob keeps it out of the import graph). */
const themeSources = import.meta.glob<string>("../../styles/theme.css", {
  query: "?raw",
  import: "default",
  eager: true,
});

describe("the shadcn mapping layer", () => {
  it("neither declares nor references a data-palette.css variable", () => {
    const themes = Object.values(themeSources);

    expect(themes).toHaveLength(1);
    for (const theme of themes) {
      expect(theme.length).toBeGreaterThan(0);
      expect(theme).not.toMatch(DATA_TOKEN);
    }
  });
});
