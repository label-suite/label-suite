import { Tag } from "lucide-react";

import { cn } from "@/lib/utils";

/** Props of {@link BrandMark}. */
export interface BrandMarkProps {
  /** Size and radius classes of the square. */
  className?: string;
  /** Size classes of the tag icon inside it. */
  iconClassName?: string;
}

/** The brand mark: a Lucide Tag on a primary-coloured rounded square, hidden from screen readers. */
export function BrandMark({ className, iconClassName }: BrandMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center bg-icon-accent text-primary-foreground",
        className,
      )}
    >
      <Tag className={iconClassName} strokeWidth={2} />
    </span>
  );
}
