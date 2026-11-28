/**
 * The dashboard's focus ring on its buttons and links: a solid 2px outline in the
 * mapped `--ring` (← `--color-primary`), 2px out, after `dashboard.layout.css`'s
 * `.btn:focus-visible` (ui-design.md §用途 → 語意 token「焦點環」, G-05).
 *
 * `Button`'s base class carries `outline-none` (`--tw-outline-style:none`) and
 * `outline-2` only reads that variable, so `outline-solid` is needed to make the
 * outline draw. `ring-0` removes Button's 3px `ring-ring/50` halo, which the
 * prototype does not have.
 */
export const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:ring-0";
