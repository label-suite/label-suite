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

// Fail at start-up, before anything renders, when VITE_API_BASE_URL is invalid.
readApiConfig();
// The interface language is decided once from the browser (design D7).
initI18n(navigator.language);

const container = document.getElementById("root");
if (container === null) {
  throw new Error("index.html is missing the #root element");
}

createRoot(container).render(
  <StrictMode>
    <App router={createAppRouter()} />
  </StrictMode>,
);
