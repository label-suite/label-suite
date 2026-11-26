/** The interface languages this app ships. */
export type AppLanguage = "zh-TW" | "en";

/**
 * Maps a remembered language value to an interface language: exactly `zh-TW`
 * or `en` is kept; anything else, including an empty or missing value and
 * other spellings such as `EN-us`, is `zh-TW`. The browser's reported
 * language is never consulted (spec 01-01 §語言切換, login-auth-guard D8).
 *
 * @param stored The remembered value, if any.
 */
export function resolveLanguage(stored: string | null | undefined): AppLanguage {
  return stored === "en" ? "en" : "zh-TW";
}
