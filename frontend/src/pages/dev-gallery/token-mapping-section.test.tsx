/**
 * The gallery's Token mapping section (design D3, D8, clarification Q16): the
 * four approved mappings, read from src/styles/theme.css at build time.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import themeCss from "@/styles/theme.css?raw";

import "./index";
import { parseApprovedMappings } from "./theme-mapping";
import { TokenMappingSection } from "./token-mapping-section";

const EXPECTED = [
  "--primary ← --color-primary-strong",
  "--destructive ← --color-error",
  "--background ← --color-surface",
  "--input ← --color-border-control",
];

/** The declarations of the light (`:root`) block, read independently of the parser. */
function lightDeclarations(css: string): Map<string, string> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const body = /:root\s*\{([^}]*)\}/.exec(withoutComments)?.[1] ?? "";
  return new Map(
    body
      .split(";")
      .map((declaration) => declaration.split(":").map((part) => part.trim()))
      .filter((parts): parts is [string, string] => parts.length === 2 && parts[0] !== ""),
  );
}

function shownMappings(): string[] {
  const section = screen.getByRole("region", { name: "Token 對照" });
  return within(section)
    .getAllByRole("listitem")
    .map((item) => item.textContent);
}

describe("TokenMappingSection", () => {
  it("shows the four approved mappings in order", () => {
    render(<TokenMappingSection />);

    const section = screen.getByRole("region", { name: "Token 對照" });
    expect(section).toHaveAttribute("id", "tokens");
    expect(within(section).getByText("shadcn/ui 變數 ← prototype tokens.css")).toBeVisible();
    expect(shownMappings()).toEqual(EXPECTED);
  });

  it("matches the light block of the mapping layer", () => {
    render(<TokenMappingSection />);

    const declarations = lightDeclarations(themeCss);
    for (const shown of shownMappings()) {
      const [variable = "", token = ""] = shown.split(" ← ");
      expect(declarations.get(variable)).toBe(`var(${token})`);
    }
  });

  it("fails loudly, naming the variable, when the mapping layer lacks one", () => {
    const withoutInput = themeCss.replace(/--input:[^;]*;/, "");

    expect(() => parseApprovedMappings(withoutInput)).toThrow(/--input/);
  });
});
