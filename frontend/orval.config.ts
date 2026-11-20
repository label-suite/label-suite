import { defineConfig } from "orval";

/**
 * The only Orval configuration (design D5). It reads the committed
 * backend/openapi.json and owns src/api/generated/ entirely: the folder is
 * cleaned before every run, so nothing in it may be edited or added by hand.
 */
export default defineConfig({
  labelSuite: {
    input: {
      target: "../backend/openapi.json",
    },
    output: {
      mode: "split",
      target: "src/api/generated/label-suite.ts",
      clean: true,
      client: "react-query",
      httpClient: "axios",
      mock: true,
      override: {
        mutator: {
          path: "src/api/mutator.ts",
          name: "apiFetch",
        },
        query: {
          signal: true,
        },
      },
    },
  },
});
