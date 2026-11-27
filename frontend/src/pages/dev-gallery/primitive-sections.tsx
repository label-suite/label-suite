/**
 * The gallery sections of the primitives added after the first gallery: Label
 * and Separator (login-auth-guard task 6.3) and Dialog (sidebar-nav task 1.5).
 * Kept apart from dev-gallery-page.tsx so that page stays under its size
 * ceiling (eslint.config.js NAMED_EXEMPTIONS).
 */
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

/** The Dialog section (sidebar-nav D9): one button that opens a sample dialog. */
export function DialogSection() {
  const { t } = useTranslation(NAMESPACE);

  return (
    <GallerySection id="dialog" title={t("sections.dialog")} meta={t("dialog.meta")}>
      {catalogEntries(variantCatalog.dialog.sample).map(([sample]) => (
        <div key={sample} data-gallery-item={galleryItem("dialog", "sample", sample)}>
          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="outline">
                {t("dialog.open")}
              </Button>
            </DialogTrigger>
            <DialogContent closeLabel={t("dialog.close")}>
              <DialogHeader>
                <DialogTitle>{t("dialog.title")}</DialogTitle>
                <DialogDescription>{t("dialog.description")}</DialogDescription>
              </DialogHeader>
              <p className="text-(length:--text-caption)">{t("dialog.body")}</p>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button">{t("dialog.confirm")}</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ))}
    </GallerySection>
  );
}
