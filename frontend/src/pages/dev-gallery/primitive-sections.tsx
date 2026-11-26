/**
 * The gallery sections of the two primitives added by login-auth-guard (task
 * 6.3): Label and Separator. Kept apart from dev-gallery-page.tsx so that
 * page stays under its size ceiling (eslint.config.js NAMED_EXEMPTIONS).
 */
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator, separatorOrientationValues } from "@/components/ui/separator";

import { GallerySection } from "./gallery-section";
import { catalogEntries, galleryItem, variantCatalog } from "./variant-catalog";

const NAMESPACE = "devGallery";

/** The Label section: one label tied to an Input, named by the label's text. */
export function LabelSection() {
  const { t } = useTranslation(NAMESPACE);
  const inputId = useId();

  return (
    <GallerySection id="label" title={t("sections.label")} meta={t("label.meta")}>
      {catalogEntries(variantCatalog.label.sample).map(([sample, demo]) => (
        <div
          key={sample}
          data-gallery-item={galleryItem("label", "sample", sample)}
          className="flex max-w-sm flex-col gap-(--space-sm)"
        >
          <Label htmlFor={inputId}>{t(demo.labelKey ?? sample)}</Label>
          <Input id={inputId} type="email" placeholder={t("label.placeholder")} />
        </div>
      ))}
    </GallerySection>
  );
}

/** The Separator section: each orientation once, named by its value. */
export function SeparatorSection() {
  const { t } = useTranslation(NAMESPACE);

  return (
    <GallerySection
      id="separator"
      title={t("sections.separator")}
      meta={separatorOrientationValues.join(" · ")}
      className="flex-row flex-wrap items-stretch gap-(--space-xl)"
    >
      {catalogEntries(variantCatalog.separator.orientation).map(([orientation]) => (
        <div
          key={orientation}
          data-gallery-item={galleryItem("separator", "orientation", orientation)}
          className={
            orientation === "horizontal"
              ? "flex min-w-40 flex-1 flex-col gap-(--space-sm)"
              : "flex h-16 items-center gap-(--space-md)"
          }
        >
          <span className="text-(length:--text-caption) text-muted-foreground">{orientation}</span>
          <Separator orientation={orientation} />
        </div>
      ))}
    </GallerySection>
  );
}
