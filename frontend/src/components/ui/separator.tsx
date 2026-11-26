import * as React from "react";
import { Separator as SeparatorPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/** The orientations the gallery shows; read at run time by its completeness test. */
export const separatorOrientationValues = ["horizontal", "vertical"] as const;

export type SeparatorOrientation = (typeof separatorOrientationValues)[number];

/** Props of {@link Separator}; every Radix Separator prop is passed through. */
export interface SeparatorProps extends React.ComponentProps<typeof SeparatorPrimitive.Root> {
  /** Which way the line runs; horizontal unless set. */
  orientation?: SeparatorOrientation;
}

/**
 * A one-pixel line in the border colour (shadcn/ui Separator; design/system
 * Divider `.divider-hr`). Decorative by default, so screen readers skip it;
 * pass `decorative={false}` when it separates content meaningfully.
 */
export function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: SeparatorProps) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        className,
      )}
      {...props}
    />
  );
}
