import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * The variants the approved screen uses (ui-design.md §/dev/gallery, Q9). The
 * prototype's Alert Banner has only error (design-gaps G-07); the other three
 * are completed on the frontend side.
 */
export const alertVariantValues = ["info", "success", "warning", "error"] as const;

export type AlertVariant = (typeof alertVariantValues)[number];

const variantClasses = {
  info: "border-info-border bg-info-bg text-info",
  success: "border-success-border bg-success-bg text-success",
  warning: "border-warning-border bg-warning-bg text-warning",
  error: "border-error-border bg-error-bg text-error",
} satisfies Record<AlertVariant, string>;

export const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-md border px-4 py-3 text-(length:--text-caption) has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: Object.fromEntries(
        alertVariantValues.map((value) => [value, variantClasses[value]]),
      ) as Record<AlertVariant, string>,
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

/** Props of {@link Alert}; every native div attribute is passed through. */
export interface AlertProps
  extends React.ComponentProps<"div">, VariantProps<typeof alertVariants> {}

/** A message box with `role="alert"` (alert-banner.md §鍵盤與焦點); pass `role` to override. */
export function Alert({ className, variant = "info", ...props }: AlertProps) {
  return (
    <div
      data-slot="alert"
      data-variant={variant}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

export function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("col-start-2 min-h-4 font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

/** The body text; it keeps the variant's colour so the whole box reads as one status. */
export function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("col-start-2 grid justify-items-start gap-1 [&_p]:leading-relaxed", className)}
      {...props}
    />
  );
}
