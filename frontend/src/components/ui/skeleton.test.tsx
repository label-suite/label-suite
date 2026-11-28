import { render } from "@testing-library/react";
import { compile } from "tailwindcss";
import tailwindCss from "tailwindcss/index.css?raw";
import { describe, expect, it } from "vitest";

import { Skeleton, skeletonAnimationValues } from "./skeleton";

/**
 * The Tailwind entry and the mapping layer, read as text. A glob keeps them
 * out of the import graph, as in tokens-usage.test.ts: components may not
 * import styles (F1).
 */
const styleSources = import.meta.glob<string>(
  ["../../styles/index.css", "../../styles/theme.css"],
  { query: "?raw", import: "default", eager: true },
);
const indexCss = styleSources["../../styles/index.css"] ?? "";
const themeCss = styleSources["../../styles/theme.css"] ?? "";

function bar(container: HTMLElement): Element | null {
  return container.querySelector('[data-slot="skeleton"]');
}

/** Compiles the Tailwind entry and returns the CSS the build emits for `candidates`. */
async function buildCss(candidates: string[]): Promise<string> {
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

describe("Skeleton", () => {
  it("declares exactly the pulse and shimmer animations", () => {
    expect(skeletonAnimationValues).toEqual(["pulse", "shimmer"]);
  });

  it("pulses when no animation is given", () => {
    const { container } = render(<Skeleton />);

    expect(bar(container)).toHaveAttribute("data-animation", "pulse");
    expect(bar(container)).toHaveClass("animate-pulse");
  });

  it.each(skeletonAnimationValues)("is hidden from assistive technology (%s)", (animation) => {
    const { container } = render(<Skeleton animation={animation} />);

    expect(bar(container)).not.toBeNull();
    expect(bar(container)).toHaveAttribute("aria-hidden", "true");
    expect(bar(container)).toHaveAttribute("data-animation", animation);
  });

  it("uses the border colour of the canonical Skeleton for pulse", () => {
    const { container } = render(<Skeleton />);

    expect(bar(container)).toHaveClass("bg-border");
  });

  it("sweeps a highlight across the bar for shimmer, without pulsing", () => {
    const { container } = render(<Skeleton animation="shimmer" />);

    expect(bar(container)).toHaveClass("animate-shimmer");
    expect(bar(container)).not.toHaveClass("animate-pulse");
  });
});

describe("the shimmer animation in index.css", () => {
  it("reads both stylesheets", () => {
    expect(indexCss.length).toBeGreaterThan(0);
    expect(themeCss.length).toBeGreaterThan(0);
  });

  it("is a 1.5s gradient of the mapped border and muted colours", async () => {
    const css = await buildCss(["animate-shimmer"]);

    expect(css).toContain(".animate-shimmer");
    expect(css).toMatch(/@keyframes skeleton-shimmer/);
    expect(css).toMatch(
      /linear-gradient\(\s*90deg,\s*var\(--border\) 25%,\s*var\(--muted\) 50%,\s*var\(--border\) 75%\s*\)/,
    );
    expect(css).toMatch(/animation:\s*skeleton-shimmer 1\.5s/);
    const utility = /@utility animate-shimmer\s*\{[^}]*\}/.exec(indexCss)?.[0] ?? "";
    expect(utility).not.toBe("");
    expect(utility).not.toMatch(/--color-/);
  });

  it("stops under reduced motion, leaving the gradient visible", () => {
    const media = indexCss.indexOf("@media (prefers-reduced-motion: reduce)");

    expect(media).toBeGreaterThan(-1);
    const block = indexCss.slice(media);
    expect(block).toMatch(/\.animate-shimmer[^{]*\{\s*animation:\s*none;?\s*\}/);
    expect(block).not.toMatch(/\.animate-shimmer[^{]*\{[^}]*background/);
  });
});
