import * as React from "react";
import { Label as LabelPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * A field's visible name (shadcn/ui Label; login-auth-guard ui-design §元件樹 ›
 * 登入頁). Point it at its field with `htmlFor`. 14px medium text in the ink
 * colour, as the prototype's sign-in labels (`login.html:210`).
 */
export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-(--space-sm) text-(length:--text-caption) leading-none font-medium text-foreground select-none peer-disabled:cursor-not-allowed peer-disabled:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
