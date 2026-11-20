import { defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      // apiFetch always sends absolute URLs in tests, so MSW handlers match on them.
      env: {
        VITE_API_BASE_URL: "http://localhost:8000",
      },
      setupFiles: ["./src/test/setup.ts"],
      // Vitest empties every CSS import by default, `?raw` ones included. Tests
      // that read a stylesheet as text (the mapping layer, the gallery's Token
      // mapping) need the real content; ordinary CSS imports stay empty.
      css: { include: [/\.css\?raw$/] },
      coverage: {
        provider: "v8",
        exclude: ["src/api/generated/**", "src/test/**", "*.config.ts", "*.config.js"],
      },
    },
  }),
);
