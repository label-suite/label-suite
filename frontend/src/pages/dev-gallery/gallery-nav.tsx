import { useTranslation } from "react-i18next";

import { gallerySections } from "./variant-catalog";
import { useLocationHash } from "./use-location-hash";

/**
 * The gallery's table of contents (ui-design.md §元件樹 /dev/gallery, Q19
 * UI-6): the eyebrow and one in-page link per section. The link of the URL's
 * anchor carries aria-current; with no anchor, none does. Fixed on the left
 * from 768px, above the content below that (brand.md mobile breakpoint).
 */
export function GalleryNav() {
  const { t } = useTranslation("devGallery");
  const hash = useLocationHash();

  return (
    <nav
      aria-label={t("nav.label")}
      className="flex flex-col gap-(--space-md) border-b border-border bg-card p-(--space-lg) md:sticky md:top-0 md:h-screen md:w-60 md:flex-none md:border-r md:border-b-0 md:py-(--space-2xl)"
    >
      <p className="text-(length:--text-label) font-semibold tracking-wide text-muted-foreground">
        {t("eyebrow")}
      </p>
      <ul className="flex flex-wrap gap-(--space-xs) md:flex-col">
        {gallerySections.map((section) => {
          const href = `#${section}`;
          return (
            <li key={section}>
              <a
                href={href}
                aria-current={hash === href ? "location" : undefined}
                className="block rounded-md px-(--space-md) py-(--space-sm) text-(length:--text-caption) text-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-[current=location]:bg-accent aria-[current=location]:font-semibold aria-[current=location]:text-accent-foreground"
              >
                {t(`sections.${section}`)}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
