/*
 * Applies the appearance preference before the first paint (sidebar-nav
 * design D7; spec appearance-mode). index.html loads this as a same-origin
 * classic script, so it runs under the CSP `script-src 'self'` without an
 * inline script. It imports nothing and is not bundled; src/lib/theme.ts
 * holds the same reading rule and takes over once the app starts, and
 * src/lib/theme.test.ts runs one case table against both copies.
 *
 * Rule: the stored `label-suite-theme` value `light` or `dark` wins; anything
 * else (`system`, missing, unreadable, invalid) follows the operating system.
 */
(function () {
  var choice = null;
  try {
    choice = window.localStorage.getItem("label-suite-theme");
  } catch (error) {
    choice = null;
  }
  var dark = choice === "dark";
  if (choice !== "dark" && choice !== "light") {
    try {
      dark =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch (error) {
      dark = false;
    }
  }
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
})();
