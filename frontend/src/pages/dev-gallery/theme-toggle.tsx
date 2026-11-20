/**
 * The gallery's light/dark switch (ui-design.md §元件樹 主題切換, Q13). It only
 * sets <html data-theme>, which the mapping layer and tokens.css follow; the
 * choice lives in component state and is never stored, so a reload starts
 * light. Leaving the gallery restores light, so /dev/health is never left dark.
 */
import { useEffect, useState } from "react";
import { Moon, Sun, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

const themes = ["light", "dark"] as const;

type Theme = (typeof themes)[number];

const icons = { light: Sun, dark: Moon } satisfies Record<Theme, LucideIcon>;

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

export function ThemeToggle() {
  const { t } = useTranslation("devGallery");
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(
    () => () => {
      applyTheme("light");
    },
    [],
  );

  return (
    <div
      role="group"
      aria-label={t("theme.label")}
      className="inline-flex gap-(--space-xs) rounded-md border border-border bg-card p-(--space-xs)"
    >
      {themes.map((value) => {
        const Icon = icons[value];
        return (
          <Button
            key={value}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={theme === value}
            className="aria-pressed:bg-accent aria-pressed:font-semibold aria-pressed:text-accent-foreground"
            onClick={() => {
              setTheme(value);
            }}
          >
            <Icon aria-hidden="true" />
            {t(`theme.${value}`)}
          </Button>
        );
      })}
    </div>
  );
}
