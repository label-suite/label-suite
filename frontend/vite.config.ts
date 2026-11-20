import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    // Fixed port: the backend's CORS_ALLOWED_ORIGINS lists http://localhost:5173.
    // No proxy on purpose, so cross-origin problems show up during development.
    port: 5173,
    strictPort: true,
  },
});
