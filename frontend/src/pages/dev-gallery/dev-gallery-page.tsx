/**
 * /dev/gallery, a developer-only page (ui-design.md §元件樹 /dev/gallery): every
 * declared variant, size and state of the src/components/ui/ primitives, once
 * each. It fetches nothing; the samples are fixed text.
 */
import { useEffect, useId } from "react";
import { Trans, useTranslation } from "react-i18next";

import { Alert, AlertDescription, alertVariantValues } from "@/components/ui/alert";
import { Badge, badgeVariantValues } from "@/components/ui/badge";
import { Button, buttonSizeValues, buttonVariantValues } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

import { GalleryNav } from "./gallery-nav";
import { GallerySection } from "./gallery-section";
import { ThemeToggle } from "./theme-toggle";
import { TokenMappingSection } from "./token-mapping-section";
import {
  buttonStateValues,
  cardPartValues,
  catalogEntries,
  galleryItem,
  inputStateValues,
  variantCatalog,
  type InputState,
} from "./variant-catalog";

const NAMESPACE = "devGallery";

/** Props of {@link InputSample}. */
interface InputSampleProps {
  /** Which Input state this sample shows. */
  state: InputState;
  /** The translated visible name, used as the field's label. */
  label: string;
}

/** One labelled Input sample; the invalid one points at its error message. */
function InputSample({ state, label }: InputSampleProps) {
  const { t } = useTranslation(NAMESPACE);
  const inputId = useId();
  const errorId = useId();

  return (
    <div
      data-gallery-item={galleryItem("input", "state", state)}
      className="flex flex-col gap-(--space-sm)"
    >
      <label
        htmlFor={inputId}
        className={
          state === "disabled"
            ? "text-(length:--text-caption) font-medium text-muted-foreground"
            : "text-(length:--text-caption) font-medium"
        }
      >
        {label}
      </label>
      {state === "default" ? <Input id={inputId} placeholder={t("input.placeholder")} /> : null}
      {state === "invalid" ? (
        <>
          <Input id={inputId} defaultValue="abc" aria-invalid="true" aria-describedby={errorId} />
          <span id={errorId} className="text-(length:--text-label) text-error">
            {t("input.error")}
          </span>
        </>
      ) : null}
      {state === "disabled" ? (
        <Input id={inputId} defaultValue={t("input.disabledValue")} disabled />
      ) : null}
    </div>
  );
}

export function DevGalleryPage() {
  const { t } = useTranslation(NAMESPACE);
  const catalog = variantCatalog;
  const pageName = t("pageName");
  const documentTitle = t("documentTitle", { ns: "common", page: pageName });

  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground md:flex-row">
      <GalleryNav />
      <main className="min-w-0 flex-1 p-(--space-lg) md:p-(--space-2xl)">
        <div className="mx-auto flex max-w-7xl flex-col gap-(--space-xl)">
          <header className="flex flex-col gap-(--space-sm)">
            <div className="flex flex-wrap items-center justify-between gap-(--space-md)">
              <h1 className="text-(length:--text-h1) font-bold">{pageName}</h1>
              <ThemeToggle />
            </div>
            <p className="text-(length:--text-body) text-muted-foreground">
              <Trans
                t={t}
                i18nKey="description"
                components={{
                  code: <code className="font-mono text-(length:--text-caption)" />,
                }}
              />
            </p>
          </header>

          <GallerySection
            id="button"
            title={t("sections.button")}
            meta={t("button.count", {
              variants: buttonVariantValues.length,
              sizes: buttonSizeValues.length,
              states: buttonStateValues.length,
            })}
          >
            <div className="flex flex-wrap items-center gap-(--space-md)">
              {catalogEntries(catalog.button.variant).map(([variant]) => (
                <Button
                  key={variant}
                  type="button"
                  variant={variant}
                  data-gallery-item={galleryItem("button", "variant", variant)}
                >
                  {variant}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-(--space-md)">
              {catalogEntries(catalog.button.size).map(([size]) => (
                <Button
                  key={size}
                  type="button"
                  size={size}
                  data-gallery-item={galleryItem("button", "size", size)}
                >
                  {size}
                </Button>
              ))}
              <span aria-hidden="true" className="h-8 w-px bg-border" />
              {catalogEntries(catalog.button.state).map(([state]) => (
                <Button
                  key={state}
                  type="button"
                  disabled={state === "disabled"}
                  loading={state === "loading"}
                  data-gallery-item={galleryItem("button", "state", state)}
                >
                  {state}
                </Button>
              ))}
            </div>
          </GallerySection>

          <GallerySection
            id="input"
            title={t("sections.input")}
            meta={t("count.states", { n: inputStateValues.length })}
            className="grid grid-cols-1 gap-(--space-lg) md:grid-cols-3"
          >
            {catalogEntries(catalog.input.state).map(([state, demo]) => (
              <InputSample key={state} state={state} label={t(demo.labelKey ?? state)} />
            ))}
          </GallerySection>

          <div className="grid grid-cols-1 gap-(--space-lg) lg:grid-cols-2">
            <GallerySection
              id="badge"
              title={t("sections.badge")}
              meta={t("count.variants", { n: badgeVariantValues.length })}
              className="flex-row flex-wrap gap-(--space-sm)"
            >
              {catalogEntries(catalog.badge.variant).map(([variant]) => (
                <Badge
                  key={variant}
                  variant={variant}
                  data-gallery-item={galleryItem("badge", "variant", variant)}
                >
                  {variant}
                </Badge>
              ))}
            </GallerySection>

            <GallerySection
              id="alert"
              title={t("sections.alert")}
              meta={t("count.variants", { n: alertVariantValues.length })}
              className="gap-(--space-sm)"
            >
              {catalogEntries(catalog.alert.variant).map(([variant, demo]) => (
                // Static samples, not messages: role="note" keeps them out of the
                // live region, so a screen reader does not announce all four on load.
                <Alert
                  key={variant}
                  variant={variant}
                  role="note"
                  data-gallery-item={galleryItem("alert", "variant", variant)}
                >
                  <AlertDescription>
                    {t("alert.sample", {
                      variant,
                      message: t(demo.sampleKey ?? variant),
                    })}
                  </AlertDescription>
                </Alert>
              ))}
            </GallerySection>
          </div>

          <div className="grid grid-cols-1 gap-(--space-lg) lg:grid-cols-2">
            <GallerySection id="card" title={t("sections.card")} meta={cardPartValues.join(" · ")}>
              <Card className="gap-0 py-0">
                <CardHeader
                  data-gallery-item={galleryItem("card", "part", "header")}
                  className="border-b border-muted py-(--space-md)"
                >
                  <CardTitle>{t("card.title")}</CardTitle>
                  <CardDescription>{t("card.description")}</CardDescription>
                </CardHeader>
                <CardContent
                  data-gallery-item={galleryItem("card", "part", "content")}
                  className="py-(--space-md) text-(length:--text-caption)"
                >
                  {t("card.content")}
                </CardContent>
                <CardFooter
                  data-gallery-item={galleryItem("card", "part", "footer")}
                  className="justify-end gap-(--space-sm) border-t border-muted py-(--space-sm)"
                >
                  <Button type="button" variant="ghost" size="sm">
                    {t("card.cancel")}
                  </Button>
                  <Button type="button" size="sm">
                    {t("card.confirm")}
                  </Button>
                </CardFooter>
              </Card>
            </GallerySection>

            <GallerySection id="states" title={t("sections.states")} meta={t("states.meta")}>
              <div
                data-gallery-item={galleryItem("skeleton", "sample", "lines")}
                className="flex flex-col gap-(--space-sm)"
              >
                <Skeleton className="h-3.5 w-4/5" />
                <Skeleton className="h-3.5 w-[55%]" />
              </div>
              <Empty
                data-gallery-item={galleryItem("empty", "sample", "panel")}
                title={t("states.emptyTitle")}
                description={t("states.emptyDescription")}
              />
            </GallerySection>
          </div>

          <TokenMappingSection />
        </div>
      </main>
    </div>
  );
}
