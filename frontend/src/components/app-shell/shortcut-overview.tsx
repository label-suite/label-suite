import { useId, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import type { ShellShortcutGroup } from "./types";

/** Props of {@link ShortcutOverview}. */
export interface ShortcutOverviewProps {
  /** The overview is open; the entry button and the `?` key both open it. */
  open: boolean;
  /** Called when the overview asks to open or close (Esc, the close button, a click outside). */
  onOpenChange: (open: boolean) => void;
  /** The groups usable on the current page; nothing else is listed (clarification Q3). */
  groups: readonly ShellShortcutGroup[];
}

/** Props of {@link ShortcutGroupSection}. */
interface ShortcutGroupSectionProps {
  /** The group to list. */
  group: ShellShortcutGroup;
}

/** One group: its title, then one row per action with its key caps. */
function ShortcutGroupSection({ group }: ShortcutGroupSectionProps) {
  const { t } = useTranslation("appShell");
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="overflow-hidden rounded-(--radius-lg) border border-border bg-card"
    >
      <h3
        id={headingId}
        className="border-b border-border px-(--space-md) py-(--space-sm) text-(length:--text-label) font-semibold tracking-wide text-muted-foreground uppercase"
      >
        {t(group.titleKey)}
      </h3>
      <dl className="px-(--space-md)">
        {group.shortcuts.map((shortcut) => (
          <div
            key={shortcut.labelKey}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-(--space-lg) py-(--space-sm)"
          >
            <dt className="text-(length:--text-label) font-medium text-foreground">
              {t(shortcut.labelKey)}
            </dt>
            <dd className="flex flex-wrap justify-end gap-(--space-xs)">
              {shortcut.keys.map((key) => (
                <kbd
                  key={key}
                  className="inline-flex h-6.5 min-w-6.5 items-center justify-center rounded-(--radius-sm) border border-border bg-surface-subtle px-1.5 text-(length:--text-label) font-semibold text-foreground"
                >
                  {key}
                </kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * The shortcut overview (design/system App Shell 「#shortcutHelpModal」),
 * on the shared Dialog: focus starts on the close button and stays inside;
 * Esc, the close button or a click outside closes it, and focus returns to
 * whatever had it when the overview opened, including when the `?` key opened
 * it rather than the entry button.
 */
export function ShortcutOverview({ open, onOpenChange, groups }: ShortcutOverviewProps) {
  const { t } = useTranslation("appShell");
  const returnFocusTo = useRef<HTMLElement | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t("shortcuts.close")}
        aria-describedby={undefined}
        className="sm:max-w-3xl"
        onOpenAutoFocus={() => {
          const focused = document.activeElement;
          returnFocusTo.current = focused instanceof HTMLElement ? focused : null;
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusTo.current?.focus();
          returnFocusTo.current = null;
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("shortcuts.title")}</DialogTitle>
        </DialogHeader>
        {groups.map((group) => (
          <ShortcutGroupSection key={group.id} group={group} />
        ))}
      </DialogContent>
    </Dialog>
  );
}
