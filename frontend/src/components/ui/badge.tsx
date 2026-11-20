import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

/** The variants the approved screen uses (ui-design.md §/dev/gallery, Q9). */
export const badgeVariantValues = ["success", "warning", "error", "info", "neutral"] as const;

export type BadgeVariant = (typeof badgeVariantValues)[number];

const variantClasses = {
  success: "border-success-border bg-success-bg text-success",
  warning: "border-warning-border bg-warning-bg text-warning",
  error: "border-error-border bg-error-bg text-error",
  info: "border-info-border bg-info-bg text-info",
  neutral: "border-border bg-muted text-muted-foreground",
} satisfies Record<BadgeVariant, string>;

export const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2 py-0.5 text-(length:--text-label) font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: Object.fromEntries(
        badgeVariantValues.map((value) => [value, variantClasses[value]]),
      ) as Record<BadgeVariant, string>,
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

/** Props of {@link Badge}; every native span attribute is passed through. */
export interface BadgeProps
  extends React.ComponentProps<"span">, VariantProps<typeof badgeVariants> {
  /** Render the single child element instead of a <span> (shadcn's Slot). */
  asChild?: boolean;
}

export function Badge({ className, variant = "neutral", asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}
