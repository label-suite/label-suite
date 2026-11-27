import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * The variants the approved screen uses (ui-design.md §/dev/gallery, Q10).
 * shadcn's `link` is removed on purpose; the gallery's completeness test reads
 * this array at run time, so a variant added here must also be shown there.
 */
export const buttonVariantValues = [
  "default",
  "cta",
  "outline",
  "secondary",
  "ghost",
  "destructive",
] as const;

/** Heights 36, 44 and 52px (ui-design.md §用途 → token). */
export const buttonSizeValues = ["sm", "md", "lg"] as const;

export type ButtonVariant = (typeof buttonVariantValues)[number];
export type ButtonSize = (typeof buttonSizeValues)[number];

const variantClasses = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  cta: "bg-cta text-cta-foreground hover:bg-cta-hover",
  outline:
    "border-primary-border bg-card text-primary hover:bg-accent hover:text-accent-foreground",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
} satisfies Record<ButtonVariant, string>;

const sizeClasses = {
  sm: "h-9 gap-1.5 px-3 has-[>svg]:px-2.5",
  md: "h-11 px-4 has-[>svg]:px-3",
  lg: "h-13 px-6 has-[>svg]:px-4",
} satisfies Record<ButtonSize, string>;

/** Builds a cva variant map from a declared value array, so the array stays the source. */
function fromValues<Value extends string>(
  values: readonly Value[],
  classes: Record<Value, string>,
): Record<Value, string> {
  return Object.fromEntries(values.map((value) => [value, classes[value]])) as Record<
    Value,
    string
  >;
}

/*
 * Disabled and aria-disabled buttons get an explicit muted look instead of the
 * canonical `opacity .4` (ui-design.md §artifact 對不到刻度或 token 的值, Q17).
 * aria-disabled buttons keep pointer events, so a mouse click still focuses
 * them (ui-design.md §無障礙); handleClick ignores the click itself.
 */
export const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-transparent text-(length:--text-caption) font-medium whitespace-nowrap transition-all outline-none motion-reduce:transition-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:border-border disabled:bg-control-disabled disabled:text-muted-foreground aria-disabled:cursor-not-allowed aria-disabled:border-border aria-disabled:bg-control-disabled aria-disabled:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: fromValues(buttonVariantValues, variantClasses),
      size: fromValues(buttonSizeValues, sizeClasses),
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

/** Props of {@link Button}; every native button attribute is passed through. */
export interface ButtonProps
  extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  /** Render the single child element instead of a <button> (shadcn's Slot). */
  asChild?: boolean;
  /**
   * The request this button started is in progress: shows a spinner beside the
   * text, sets aria-busy and aria-disabled, and ignores clicks, Enter and Space.
   * The native `disabled` attribute is not used, so focus stays on the button
   * (ui-design.md §無障礙).
   */
  loading?: boolean;
}

function isAriaDisabled(value: ButtonProps["aria-disabled"]): boolean {
  return value === true || value === "true";
}

export function Button({
  className,
  variant = "default",
  size = "md",
  asChild = false,
  loading = false,
  onClick,
  children,
  "aria-disabled": ariaDisabled,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  const inert = loading || isAriaDisabled(ariaDisabled);

  // A native button turns Enter and Space into a click, so blocking the click
  // here covers the keyboard too; preventDefault also stops a form submit.
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (inert) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      aria-disabled={inert ? true : ariaDisabled}
      aria-busy={loading ? true : undefined}
      onClick={handleClick}
      {...props}
    >
      {loading && !asChild ? (
        <>
          <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}
