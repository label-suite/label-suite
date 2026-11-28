import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The two loading animations of design/system Skeleton: A pulse (card and
 * list layouts) and B shimmer (form and dashboard layouts). Exported so the
 * gallery catalog binds to it with `satisfies Record<...>` (design D7).
 */
export const skeletonAnimationValues = ["pulse", "shimmer"] as const;

export type SkeletonAnimation = (typeof skeletonAnimationValues)[number];

const animationClasses = {
  pulse: "animate-pulse bg-border",
  // The gradient, its 1.5s sweep and the reduced-motion stop live in styles/index.css.
  shimmer: "animate-shimmer",
} satisfies Record<SkeletonAnimation, string>;

/** Props of {@link Skeleton}. */
interface SkeletonProps extends React.ComponentProps<"div"> {
  /** Which loading animation to play; pulse when omitted. */
  animation?: SkeletonAnimation;
}

/**
 * A loading placeholder bar, always hidden from assistive technology; the
 * surrounding region announces the loading state instead (ui-design.md §無障礙).
 * Pulse is coloured with the border colour of the canonical Skeleton (Q17);
 * shimmer sweeps a muted highlight across the same border colour.
 */
export function Skeleton({ className, animation = "pulse", ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      data-animation={animation}
      className={cn("rounded-sm", animationClasses[animation], className)}
      {...props}
      aria-hidden="true"
    />
  );
}
