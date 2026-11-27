import type * as React from "react";
import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/*
 * shadcn/ui Dialog on the radix-ui package already in the dependencies
 * (sidebar-nav design D9): focus moves inside and stays there, Esc and a click
 * outside close it, and focus returns to the trigger. Colours come from the
 * mapping layer only. The overlay uses shadcn's semantic `bg-background/80`
 * mask, so it follows the theme without a colour value (ui-design §元件與
 * design token, G-02). There are no open/close animations, so reduced motion
 * has nothing to turn off.
 */

/** The dialog's root; holds whether it is open. */
function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

/** The button that opens the dialog; focus returns to it on close. */
function DialogTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

/** Renders the dialog into document.body. */
function DialogPortal(props: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

/** Any element that closes the dialog. */
function DialogClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

/** The mask behind the dialog; clicking it closes the dialog. */
function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn("fixed inset-0 z-(--z-modal) bg-background/80", className)}
      {...props}
    />
  );
}

/** Props of {@link DialogContent}. */
export interface DialogContentProps extends React.ComponentProps<typeof DialogPrimitive.Content> {
  /**
   * Accessible name of an icon-only close button in the top corner. It comes
   * first in the dialog, so focus starts on it; without it there is no button.
   */
  closeLabel?: string;
}

/** The dialog panel, with its overlay, in a portal. */
function DialogContent({ className, children, closeLabel, ...props }: DialogContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-(--z-modal) grid max-h-[calc(100vh-var(--space-2xl))] w-full max-w-[calc(100%-var(--space-xl))] -translate-x-1/2 -translate-y-1/2 gap-(--space-md) overflow-y-auto rounded-(--radius-lg) border border-border bg-card p-(--space-lg) text-card-foreground shadow-card outline-none sm:max-w-lg",
          className,
        )}
        {...props}
      >
        {closeLabel === undefined ? null : (
          <DialogPrimitive.Close
            aria-label={closeLabel}
            title={closeLabel}
            className="absolute top-(--space-md) right-(--space-md) inline-flex size-8.5 cursor-pointer items-center justify-center rounded-(--radius-md) border border-border bg-card text-muted-foreground outline-none hover:border-ring hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <X aria-hidden="true" className="size-4" />
          </DialogPrimitive.Close>
        )}
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

/** The title row and optional description. */
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-(--space-xs) pr-(--space-2xl)", className)}
      {...props}
    />
  );
}

/** The actions row, right-aligned from the small breakpoint up. */
function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-(--space-sm) sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

/** The dialog's name; every dialog needs one. */
function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-(length:--text-h3) leading-tight font-semibold", className)}
      {...props}
    />
  );
}

/** The dialog's description, announced after its name. */
function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-(length:--text-caption) text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
