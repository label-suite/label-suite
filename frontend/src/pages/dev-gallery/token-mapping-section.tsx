import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

import { GallerySection } from "./gallery-section";
import { tokenMappings, type ApprovedVariable } from "./theme-mapping";

/**
 * Each swatch is coloured by the mapped semantic variable itself, so the
 * swatch checks the mapping (ui-design.md §用途 → token). The background
 * swatch gets a border because it sits on a card of a similar colour.
 */
const swatchClasses = {
  "--primary": "bg-primary",
  "--destructive": "bg-destructive",
  "--background": "border border-border bg-background",
  "--input": "bg-input",
} satisfies Record<ApprovedVariable, string>;

/** The Token mapping section: four `variable ← token` rows from theme.css (Q16). */
export function TokenMappingSection() {
  const { t } = useTranslation("devGallery");

  return (
    <GallerySection id="tokens" title={t("sections.tokens")} meta={t("tokens.meta")}>
      <ul className="grid grid-cols-1 gap-(--space-md) sm:grid-cols-2 lg:grid-cols-4">
        {tokenMappings.map(({ variable, token }) => (
          <li key={variable} className="flex items-center gap-(--space-sm)">
            <span
              aria-hidden="true"
              className={cn("size-8 flex-none rounded-md", swatchClasses[variable])}
            />
            <code className="font-mono text-(length:--text-label) wrap-anywhere">
              {variable} ← {token}
            </code>
          </li>
        ))}
      </ul>
    </GallerySection>
  );
}
