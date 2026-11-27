import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Design token custom properties, extracted from the prototype at build time
// (design D8). A plain import, never inside @layer, so the tokens win over
// Tailwind's same-named theme variables.
import "virtual:design-tokens.css";
import "./styles/index.css";

import { readApiConfig } from "@/api/config";
import { App } from "@/app/app";
import { createAppRouter } from "@/app/router";
import { initI18n } from "@/lib/i18n";
import { initTheme } from "@/lib/theme";

// Fail at start-up, before anything renders, when VITE_API_BASE_URL is invalid.
readApiConfig();
// The interface language is the remembered choice, or zh-TW (login-auth-guard D8).
initI18n();
// public/theme-init.js already applied the appearance before the first paint;
// from here lib/theme follows the operating system and owns later changes.
initTheme();

const container = document.getElementById("root");
if (container === null) {
  throw new Error("index.html is missing the #root element");
}

createRoot(container).render(
  <StrictMode>
    <App router={createAppRouter()} />
  </StrictMode>,
);
