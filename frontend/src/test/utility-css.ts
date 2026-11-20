/**
 * Tailwind's real utility CSS for the classes an element carries, attached to
 * the jsdom document. jsdom loads no stylesheet by default, so a class such as
 * `pointer-events-none` has no effect in tests; with this, user-event sees the
 * computed style a browser would, and a test can catch a click the browser
 * would never deliver.
 */
import { compile } from "tailwindcss";

/** Attaches the utility CSS for every class on `element`; returns a function that removes it. */
export async function attachUtilityCss(element: Element): Promise<() => void> {
  const compiler = await compile("@tailwind utilities;");
  const style = document.createElement("style");
  style.textContent = compiler.build(Array.from(element.classList));
  document.head.append(style);
  return () => {
    style.remove();
  };
}
