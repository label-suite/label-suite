import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { changeInterfaceLanguage, getCurrentLanguage, type AppLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** The code shown on the button for each language (spec 01-01 §語言切換). */
const LANGUAGE_CODES: Record<AppLanguage, string> = { "zh-TW": "ZH", en: "EN" };

/** Props of {@link LanguageToggle}. */
export interface LanguageToggleProps {
  /** The page is frozen (a request is in flight): the button is disabled, mouse and keyboard alike. */
  disabled?: boolean;
  /** Called after the language has switched, so the page can clear its errors. */
  onChange?: () => void;
  /** The smaller size of the phone brand bar (prototype `.mobile-lang-toggle`); same name and behaviour. */
  compact?: boolean;
}

/**
 * Switches between Traditional Chinese and English at once and remembers the
 * choice (design/system Language Toggle). Only the code is visible; the
 * accessible name contains it, so a voice user can say "ZH" (WCAG 2.5.3, U8).
 * The account pages and the signed-in shell use this one component
 * (sidebar-nav design D2), so its text lives in `common`.
 */
export function LanguageToggle({
  disabled = false,
  onChange,
  compact = false,
}: LanguageToggleProps) {
  const { t } = useTranslation("common");
  const code = LANGUAGE_CODES[getCurrentLanguage()];

  const toggle = async () => {
    await changeInterfaceLanguage(getCurrentLanguage() === "zh-TW" ? "en" : "zh-TW");
    onChange?.();
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-testid="lang-toggle"
      data-size={compact ? "compact" : "default"}
      disabled={disabled}
      aria-label={t("languageToggle", { code })}
      onClick={() => {
        void toggle();
      }}
      className={cn(
        "rounded-(--radius-md) border-border text-foreground hover:border-ring hover:bg-accent hover:text-foreground",
        compact &&
          "px-(--space-sm) text-(length:--text-label) font-semibold has-[>svg]:px-(--space-sm)",
      )}
    >
      <Globe aria-hidden="true" />
      <span data-testid="lang-label">{code}</span>
    </Button>
  );
}
