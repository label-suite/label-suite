/**
 * The i18n layer (design D7, clarification Q5; login-auth-guard D8).
 *
 * `common` (shared components), `auth` (the sign-in page, the Google callback
 * and the landing page), `appShell` (the signed-in shell) and `dashboard` (the
 * landing page, dashboard-shell D8) are loaded at
 * start-up and ship in the production bundle (sidebar-nav D10). Development page
 * namespaces such as `systemHealth` and `devGallery` are added by their own
 * entry modules through registerNamespace, so their text ships only with the
 * dev-only chunks.
 *
 * The interface language is remembered in localStorage under
 * `labelsuite.lang` (brand.md §設計決策). A missing, unreadable or unknown
 * value means `zh-TW`; the browser's language is not consulted. A key missing
 * from English falls back to its Traditional Chinese text rather than showing
 * the key name (sidebar-nav clarification P1); the key-set test still fails a
 * commit that leaves one out.
 */
import i18next, { type i18n as I18nInstance } from "i18next";
import { initReactI18next } from "react-i18next";

import enAppShell from "./locales/en/appShell.json";
import enAuth from "./locales/en/auth.json";
import enCommon from "./locales/en/common.json";
import enDashboard from "./locales/en/dashboard.json";
import zhTWAppShell from "./locales/zh-TW/appShell.json";
import zhTWAuth from "./locales/zh-TW/auth.json";
import zhTWCommon from "./locales/zh-TW/common.json";
import zhTWDashboard from "./locales/zh-TW/dashboard.json";
import { resolveLanguage, type AppLanguage } from "./resolve-language";

export { resolveLanguage, type AppLanguage } from "./resolve-language";

/** A namespace's translations: nested objects whose leaves are strings. */
export interface LocaleTree {
  [key: string]: string | LocaleTree;
}

/** One namespace's translations for every interface language. */
export type LocaleBundles = Record<AppLanguage, LocaleTree>;

/** The app's single i18next instance, shared with react-i18next. */
export const i18n: I18nInstance = i18next.createInstance();

/** The localStorage key of the remembered interface language. */
export const LANGUAGE_STORAGE_KEY = "labelsuite.lang";

/** Reads the remembered language; storage that cannot be read counts as nothing remembered. */
export function readStoredLanguage(): AppLanguage {
  try {
    return resolveLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return resolveLanguage(null);
  }
}

/** Sets `<html lang>`, which also switches the tokens.css line heights. */
function applyDocumentLanguage(language: AppLanguage): void {
  // Node (the build/ tests) has no document.
  if (typeof document !== "undefined") {
    document.documentElement.lang = language;
  }
}

/**
 * Initialises the i18n instance with the `common`, `auth`, `appShell` and
 * `dashboard` namespaces, in the remembered language, and sets `<html lang>` to match.
 */
export function initI18n(): I18nInstance {
  const language = readStoredLanguage();
  void i18n.use(initReactI18next).init({
    lng: language,
    supportedLngs: ["zh-TW", "en"],
    fallbackLng: "zh-TW",
    ns: ["common", "auth", "appShell", "dashboard"],
    defaultNS: "common",
    resources: {
      "zh-TW": {
        common: zhTWCommon,
        auth: zhTWAuth,
        appShell: zhTWAppShell,
        dashboard: zhTWDashboard,
      },
      en: { common: enCommon, auth: enAuth, appShell: enAppShell, dashboard: enDashboard },
    },
    initAsync: false,
    interpolation: { escapeValue: false },
  });
  applyDocumentLanguage(language);
  return i18n;
}

/**
 * Switches the interface language at once and remembers it for every later
 * page (spec 01-01 §語言切換). When storage cannot be written the switch still
 * applies to this page.
 *
 * @param language The language the user picked.
 */
export async function changeInterfaceLanguage(language: AppLanguage): Promise<void> {
  await i18n.changeLanguage(language);
  applyDocumentLanguage(language);
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Storage disabled or full: the choice is simply not remembered.
  }
}

/**
 * Adds one namespace for both languages. Safe to call again for the same
 * namespace: later text deep-merges over and overwrites earlier text.
 *
 * @param namespace The namespace name, e.g. `systemHealth`.
 * @param resources The namespace's translations per language.
 */
export function registerNamespace(namespace: string, resources: LocaleBundles): void {
  for (const language of ["zh-TW", "en"] as const) {
    i18n.addResourceBundle(language, namespace, resources[language], true, true);
  }
}

/** The current interface language, sent to the backend as Accept-Language. */
export function getCurrentLanguage(): AppLanguage {
  return resolveLanguage(i18n.language);
}
