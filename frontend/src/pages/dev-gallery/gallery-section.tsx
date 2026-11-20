import type * as React from "react";

import { cn } from "@/lib/utils";

/** Props of {@link GallerySection}. */
export interface GallerySectionProps {
  /** The section id; also the anchor the gallery nav links to (`#button`). */
  id: string;
  /** The h2 text that names the section. */
  title: string;
  /** The small text beside the title: a derived count or a short note. */
  meta: string;
  /** The samples. */
  children: React.ReactNode;
  /** Extra classes for the section's sample area. */
  className?: string;
}

/** One gallery block: a `section` named by its h2, with a count or note beside it. */
export function GallerySection({ id, title, meta, children, className }: GallerySectionProps) {
  const headingId = `${id}-heading`;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="flex scroll-mt-(--space-lg) flex-col gap-(--space-md) rounded-lg border border-border bg-card p-(--space-lg) text-card-foreground"
    >
      <div className="flex flex-wrap items-baseline gap-(--space-sm)">
        <h2 id={headingId} className="text-(length:--text-h3) font-semibold">
          {title}
        </h2>
        <span className="text-(length:--text-label) text-muted-foreground">{meta}</span>
      </div>
      <div className={cn("flex flex-col gap-(--space-md)", className)}>{children}</div>
    </section>
  );
}
