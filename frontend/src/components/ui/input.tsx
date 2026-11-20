import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Single-line text field. Label it with a native <label htmlFor> (design D9);
 * `aria-invalid` switches to the error outline, `disabled` to the explicit
 * muted look (ui-design.md §artifact 對不到刻度或 token 的值, Q17).
 */
export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 py-1 text-(length:--text-body) text-foreground transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground",
        "disabled:cursor-not-allowed disabled:border-border disabled:bg-control-disabled disabled:text-muted-foreground",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-error aria-invalid:ring-error/20",
        className,
      )}
      {...props}
    />
  );
}
