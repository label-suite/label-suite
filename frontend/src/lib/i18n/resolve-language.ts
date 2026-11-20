/** The interface languages this app ships. */
export type AppLanguage = "zh-TW" | "en";

/**
 * Maps the browser's reported language to an interface language: any code
 * starting with `zh` (case-insensitive) is `zh-TW`; everything else, including
 * an empty or missing value, is `en` (clarification Q5).
 *
 * @param navigatorLanguage The value of `navigator.language`, if any.
 */
export function resolveLanguage(navigatorLanguage: string | null | undefined): AppLanguage {
  return navigatorLanguage?.toLowerCase().startsWith("zh") ? "zh-TW" : "en";
}
