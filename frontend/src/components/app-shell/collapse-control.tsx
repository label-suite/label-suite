import { useTranslation } from "react-i18next";

/** Props of {@link CollapseControl}. */
export interface CollapseControlProps {
  /** The sidebar is collapsed now. */
  collapsed: boolean;
  /** The id of the sidebar element it collapses. */
  sidebarId: string;
  /** Collapses or expands the sidebar. */
  onToggle: () => void;
}

/**
 * The keyboard path to collapsing (clarification Q12; design D8). It fills
 * the empty space between the items and the tools, is transparent with no
 * text, and shows only a focus ring for keyboard focus, so a mouse user still
 * sees the prototype's empty space and clicking it is the same toggle. Its
 * name says what it will do, and focus stays on it after toggling.
 */
export function CollapseControl({ collapsed, sidebarId, onToggle }: CollapseControlProps) {
  const { t } = useTranslation("appShell");

  return (
    <button
      type="button"
      aria-label={collapsed ? t("collapse.expand") : t("collapse.collapse")}
      aria-expanded={!collapsed}
      aria-controls={sidebarId}
      onClick={onToggle}
      className="my-(--space-sm) min-h-(--space-xl) w-full flex-1 cursor-pointer rounded-(--radius-md) bg-transparent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    />
  );
}
