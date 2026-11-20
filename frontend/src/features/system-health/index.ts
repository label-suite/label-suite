/**
 * Public boundary of the system-health feature. Importing it registers the
 * systemHealth namespace, so its text ships only with the dev-only chunk that
 * imports this module (design D7).
 */
import { registerNamespace } from "@/lib/i18n";
import en from "@/lib/i18n/locales/en/systemHealth.json";
import zhTW from "@/lib/i18n/locales/zh-TW/systemHealth.json";

registerNamespace("systemHealth", { "zh-TW": zhTW, en });

export { HealthStatusPanel } from "./health-status-panel";
