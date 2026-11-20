import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A loading placeholder bar, always hidden from assistive technology; the
 * surrounding region announces the loading state instead (ui-design.md §無障礙).
 * Coloured with the border colour of the canonical Skeleton (Q17).
 */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-sm bg-border", className)}
      {...props}
      aria-hidden="true"
    />
  );
}
