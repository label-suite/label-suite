import { Keyboard } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { TOOL_BUTTON_HEIGHT } from "./dimensions";

/** Props of {@link UtilityRow}. */
export interface UtilityRowProps {
  /** The sidebar is collapsed: the shortcut entry hides, the appearance switch stays. */
  collapsed: boolean;
  /** Opens the shortcut overview. */
  onOpenShortcuts: () => void;
}

/**
 * The desktop sidebar's tool row (design/system App Shell, 底部工具列): the
 * shortcut overview entry and the appearance switch, each half the width.
 * There is no notification entry in this change (clarification Q7).
 */
export function UtilityRow({ collapsed, onOpenShortcuts }: UtilityRowProps) {
  const { t } = useTranslation("appShell");
  const label = t("shortcuts.open");

  return (
    <div
      role="group"
      aria-label={t("landmarks.tools")}
      className={cn("flex w-full items-center gap-(--space-sm)", collapsed && "justify-center")}
    >
      {collapsed ? null : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="shortcut-help-button"
          aria-label={label}
          title={label}
          onClick={onOpenShortcuts}
          className={cn(
            "min-w-0 flex-1 rounded-(--radius-md) border-border bg-card px-0 text-muted-foreground duration-(--dur-fast) hover:border-ring hover:bg-accent hover:text-icon-accent has-[>svg]:px-0",
            TOOL_BUTTON_HEIGHT,
          )}
        >
          <Keyboard aria-hidden="true" />
        </Button>
      )}
      <ThemeToggle className={collapsed ? "w-10" : "min-w-0 flex-1"} />
    </div>
  );
}
