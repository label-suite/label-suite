/**
 * Entry of the /dev/gallery page; the dev-only router lazy-loads this module.
 * Importing it registers the devGallery namespace, so the page's text ships
 * only with that chunk (design D7).
 */
import { registerNamespace } from "@/lib/i18n";
import en from "@/lib/i18n/locales/en/devGallery.json";
import zhTW from "@/lib/i18n/locales/zh-TW/devGallery.json";

registerNamespace("devGallery", { "zh-TW": zhTW, en });

export { DevGalleryPage } from "./dev-gallery-page";
