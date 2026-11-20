import type * as React from "react";
import { Inbox } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Props of {@link Empty}. shadcn/ui has no empty-state primitive, so this one
 * is hand-written from design/system/components/empty-state.md.
 */
export interface EmptyProps extends Omit<React.ComponentProps<"div">, "title"> {
  /** What is missing, e.g. "No data yet". */
  title: React.ReactNode;
  /** Why it is empty and what to do next (UXC-09 keeps first-use and filtered apart by copy). */
  description: React.ReactNode;
  /** An optional next step, usually a Button. */
  action?: React.ReactNode;
}

/**
 * The panel-sized empty state: a dashed border around the Inbox icon, a title,
 * a description and an optional action (empty-state.md §變體 `.empty-state-panel`;
 * icon chosen in Q19 UI-5).
 */
export function Empty({ title, description, action, className, ...props }: EmptyProps) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex flex-col items-center gap-(--space-sm) rounded-lg border border-dashed border-border bg-control-disabled p-(--space-lg) text-center",
        className,
      )}
      {...props}
    >
      <Inbox aria-hidden="true" className="size-10 text-muted-foreground" />
      <p className="text-(length:--text-caption) font-semibold text-foreground">{title}</p>
      <p className="text-(length:--text-caption) text-muted-foreground">{description}</p>
      {action === undefined ? null : <div className="mt-(--space-sm)">{action}</div>}
    </div>
  );
}
