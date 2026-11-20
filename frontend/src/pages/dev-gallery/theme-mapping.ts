/**
 * Reads the approved Token mappings out of the mapping layer (clarification
 * Q16): src/styles/theme.css is the only source, imported as raw text so the
 * gallery always shows what the file says. This is the one named exception to
 * "pages do not import styles" (eslint.config.js, design D3).
 */
import themeCss from "@/styles/theme.css?raw";

/** The four mappings the approved artifact shows, in its order. */
export const approvedVariables = ["--primary", "--destructive", "--background", "--input"] as const;

export type ApprovedVariable = (typeof approvedVariables)[number];

/** One semantic variable and the tokens.css variable it maps to. */
export interface TokenMapping {
  /** The shadcn/ui variable, e.g. `--primary`. */
  variable: ApprovedVariable;
  /** The tokens.css variable it points at, e.g. `--color-primary-strong`. */
  token: string;
}

/**
 * Returns the approved mappings from the light (`:root`) block of `css`.
 * Throws, naming the variable, when one is missing or is not a plain
 * `var(--token)` reference: the gallery must not show a mapping the file
 * does not have.
 */
export function parseApprovedMappings(css: string): TokenMapping[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const lightBlock = /:root\s*\{([^}]*)\}/.exec(withoutComments)?.[1];
  if (lightBlock === undefined) {
    throw new Error("theme.css has no :root block to read the Token mappings from");
  }
  return approvedVariables.map((variable) => {
    const declaration = new RegExp(`(?:^|[;\\s])${variable}\\s*:\\s*var\\((--[a-z0-9-]+)\\)\\s*;`);
    const token = declaration.exec(lightBlock)?.[1];
    if (token === undefined) {
      throw new Error(`theme.css :root does not map ${variable} to a tokens.css variable`);
    }
    return { variable, token };
  });
}

/** The mappings of the current theme.css, read once when the gallery loads. */
export const tokenMappings: TokenMapping[] = parseApprovedMappings(themeCss);
