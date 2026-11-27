import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { setThemeChoice, useResolvedTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** Props of {@link ThemeToggle}. */
export interface ThemeToggleProps {
  /** The phone brand bar's smaller square (prototype `.mobile-theme-toggle-btn`); same name and behaviour. */
  compact?: boolean;
  /** Extra classes from the caller, e.g. to share a row's width. */
  className?: string;
}

/**
 * Switches between light and dark at once and remembers the choice
 * (design/system Theme Toggle; sidebar-nav design D7, clarification Q5). One
 * icon button that points where a click goes: a moon while the page is light,
 * a sun while it is dark, following what is actually shown, so a `system`
 * choice on a dark system shows the sun. The signed-in shell and the
 * component gallery share it, so its text lives in `common`. It writes only
 * `light` or `dark`; choosing `system` belongs to the profile page.
 */
export function ThemeToggle({ compact = false, className }: ThemeToggleProps) {
  const { t } = useTranslation("common");
  const resolved = useResolvedTheme();
  const label = resolved === "dark" ? t("theme.switchToLight") : t("theme.switchToDark");

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-testid={compact ? "mobile-theme-toggle" : "sidebar-theme-toggle"}
      aria-label={label}
      title={label}
      onClick={() => {
        setThemeChoice(resolved === "dark" ? "light" : "dark");
      }}
      className={cn(
        "rounded-(--radius-md) border-border bg-card px-0 text-muted-foreground duration-(--dur-fast) hover:border-ring hover:bg-accent hover:text-icon-accent has-[>svg]:px-0",
        compact ? "size-8.5 rounded-(--radius-sm)" : "h-10.5 min-w-10.5",
        className,
      )}
    >
      {resolved === "dark" ? (
        <Sun aria-hidden="true" data-theme-toggle-icon="sun" />
      ) : (
        <Moon aria-hidden="true" data-theme-toggle-icon="moon" />
      )}
    </Button>
  );
}
