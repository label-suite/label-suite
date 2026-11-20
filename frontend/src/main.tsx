import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Design token custom properties, extracted from the prototype at build time
// (design D8). A plain import, never inside @layer, so the tokens win over
// Tailwind's same-named theme variables.
import "virtual:design-tokens.css";
import "./styles/index.css";

const container = document.getElementById("root");
if (container === null) {
  throw new Error("index.html is missing the #root element");
}

createRoot(container).render(<StrictMode />);
