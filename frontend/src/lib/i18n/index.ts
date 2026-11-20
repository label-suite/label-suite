/**
 * The i18n layer (design D7, clarification Q5).
 *
 * Only the `common` namespace is loaded at start-up. Page namespaces such as
 * `systemHealth` and `devGallery` are added by their own entry modules through
 * registerNamespace, so their text ships only with the dev-only chunks.
 */
import i18next, { type i18n as I18nInstance } from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "./locales/en/common.json";
import zhTWCommon from "./locales/zh-TW/common.json";
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

/**
 * Initialises the i18n instance with only the `common` namespace, in the
 * language resolved from the browser. There is no language switcher; tests
 * pick a language with `i18n.changeLanguage`.
 *
 * @param navigatorLanguage The value of `navigator.language`, if any.
 */
export function initI18n(navigatorLanguage: string | undefined): I18nInstance {
  void i18n.use(initReactI18next).init({
    lng: resolveLanguage(navigatorLanguage),
    supportedLngs: ["zh-TW", "en"],
    fallbackLng: false,
    ns: ["common"],
    defaultNS: "common",
    resources: {
      "zh-TW": { common: zhTWCommon },
      en: { common: enCommon },
    },
    initAsync: false,
    interpolation: { escapeValue: false },
  });
  return i18n;
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
