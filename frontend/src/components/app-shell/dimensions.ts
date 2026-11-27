/**
 * The shell's fixed sizes, taken from the prototype (pages/shared/sidebar.css;
 * dashboard.layout.css for the phone bars). They are not spacing tokens and
 * tokens.css has none for them (design-gaps G-24), so they live here in one
 * place (sidebar-nav design D14) instead of scattered over the components.
 * Written as whole Tailwind classes so the build finds them.
 */

/** The desktop sidebar's width: 240px open, 88px collapsed. */
export const SIDEBAR_WIDTH = { expanded: "w-60", collapsed: "w-22" } as const;

/** The desktop sidebar's side padding: space-md open, the prototype's 10px collapsed. */
export const SIDEBAR_PADDING = { expanded: "px-(--space-md)", collapsed: "px-2.5" } as const;

/** The phone brand bar at the top: 64px (`--navbar-mobile-top-height`). */
export const MOBILE_TOP_BAR_HEIGHT = "h-16";

/** The phone main navigation at the bottom: 84px (`--navbar-mobile-height`). */
export const MOBILE_NAV_HEIGHT = "h-21";

/** Room the phone content leaves for the two fixed bars, so nothing is covered. */
export const MOBILE_CONTENT_INSET = "pt-16 pb-21";

/** The height of the desktop tool buttons (prototype `.sidebar-utility-btn`, 42px). */
export const TOOL_BUTTON_HEIGHT = "h-10.5";
