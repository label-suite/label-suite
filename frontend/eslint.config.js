// ESLint flat config for the frontend package.
//
// Turns the layer table of frontend-agent-rules F1 and the extra rules in
// openspec/changes/frontend-skeleton/system-design.md (§分層與允許的 import)
// into machine checks. Each rule was verified to fail on a deliberate
// violation before being committed (design D3).
import boundaries from "eslint-plugin-boundaries";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

/**
 * "Test files", defined once and shared by every rule below: colocated tests,
 * the test support folder, and the Vitest config. Only these may import test
 * doubles (msw, faker, src/test/, Orval's generated *.msw.ts and *.faker.ts).
 */
const TEST_FILES = ["**/*.test.ts", "**/*.test.tsx", "src/test/**", "vitest.config.ts"];

/** Folders where server data may only come through the generated client (A6). */
const UI_LAYERS = ["src/pages/**", "src/features/**", "src/components/**"];

/** Test files inside the UI layers: still barred from axios and day.js. */
const UI_TEST_FILES = [
  "src/pages/**/*.test.{ts,tsx}",
  "src/features/**/*.test.{ts,tsx}",
  "src/components/**/*.test.{ts,tsx}",
];

const SOURCE_FILES = ["src/**/*.{ts,tsx}", "build/**/*.ts"];

/** The only file allowed to import day.js (frontend-agent-rules F10). */
const DATE_ENTRY = "src/lib/date.ts";

const GENERATED_CLIENT_MESSAGE =
  "Get server data through the client generated in src/api/generated/ (it goes through apiFetch, the single HTTP boundary; api-agent-rules A6).";

const DAYJS_RESTRICTION = {
  paths: [
    {
      name: "dayjs",
      message:
        "Format dates through src/lib/date.ts; day.js may only be imported there (frontend-agent-rules F10).",
    },
  ],
  patterns: [
    {
      group: ["dayjs/*"],
      message:
        "Format dates through src/lib/date.ts; day.js may only be imported there (frontend-agent-rules F10).",
    },
  ],
};

const AXIOS_RESTRICTION = {
  paths: [{ name: "axios", message: GENERATED_CLIENT_MESSAGE }],
  patterns: [{ group: ["axios/*"], message: GENERATED_CLIENT_MESSAGE }],
};

const TEST_DOUBLE_MESSAGE =
  "Test doubles (msw, @faker-js/faker, src/test/, generated *.msw.ts and *.faker.ts) may only be imported by test files, so they never reach the production bundle.";

const TEST_DOUBLE_RESTRICTION = {
  paths: [
    { name: "msw", message: TEST_DOUBLE_MESSAGE },
    { name: "@faker-js/faker", message: TEST_DOUBLE_MESSAGE },
  ],
  patterns: [
    {
      group: [
        "msw/*",
        "@faker-js/faker/*",
        "@/test",
        "@/test/**",
        "**/test/**",
        "**/*.msw",
        "**/*.msw.ts",
        "**/*.faker",
        "**/*.faker.ts",
      ],
      message: TEST_DOUBLE_MESSAGE,
    },
  ],
};

const THEME_RAW_MESSAGE =
  "Only src/pages/dev-gallery/ may read src/styles/theme.css as raw text (its Token mapping section); other pages must not import styles (frontend-agent-rules F1).";

const THEME_RAW_RESTRICTION = {
  paths: [],
  patterns: [{ group: ["**/styles/theme.css?raw"], message: THEME_RAW_MESSAGE }],
};

/**
 * Merges restriction sets into one `no-restricted-imports` entry. Flat config
 * replaces (does not merge) a rule's options when several config objects match
 * the same file, so every file group below gets its full combined list.
 */
function restrictedImports(...restrictions) {
  return [
    "error",
    {
      paths: restrictions.flatMap((restriction) => restriction.paths),
      patterns: restrictions.flatMap((restriction) => restriction.patterns),
    },
  ];
}

const FETCH_GLOBAL = ["error", { name: "fetch", message: GENERATED_CLIENT_MESSAGE }];

const FETCH_PROPERTIES = [
  "error",
  { object: "window", property: "fetch", message: GENERATED_CLIENT_MESSAGE },
  { object: "globalThis", property: "fetch", message: GENERATED_CLIENT_MESSAGE },
  { object: "self", property: "fetch", message: GENERATED_CLIENT_MESSAGE },
];

export default defineConfig(
  {
    ignores: ["src/api/generated/**", "dist/**", "coverage/**"],
  },

  // Type-aware TypeScript rules (F2, Hard Rule 7).
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
    },
  },

  // Hooks call order and dependencies (F3); Vite fast-refresh boundaries.
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },

  // Layer boundaries (F1).
  {
    files: SOURCE_FILES,
    plugins: { boundaries },
    settings: {
      "import/resolver": {
        typescript: { project: "./tsconfig.json" },
      },
      "boundaries/root-path": import.meta.dirname,
      "boundaries/elements": [
        { type: "app", pattern: "src/app", partialMatch: false },
        { type: "pages", pattern: "src/pages/*", capture: ["page"], partialMatch: false },
        { type: "features", pattern: "src/features/*", capture: ["feature"], partialMatch: false },
        { type: "components", pattern: "src/components", partialMatch: false },
        { type: "api", pattern: "src/api", partialMatch: false },
        { type: "lib", pattern: "src/lib", partialMatch: false },
        { type: "styles", pattern: "src/styles", partialMatch: false },
        { type: "build", pattern: "build", partialMatch: false },
        { type: "test", pattern: "src/test", partialMatch: false },
      ],
      "boundaries/files": [
        { category: "test-file", pattern: TEST_FILES },
        // Vite's entry point lives at the src root but belongs to the app layer.
        // Element patterns match folders, so it is classified as a file instead.
        { category: "app-entry", pattern: "src/main.tsx" },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          message:
            "{{ from.element.type }} may not import {{ to.element.type }} (frontend-agent-rules F1 layer table).",
          policies: [
            // app (and the src/main.tsx entry) assembles every layer.
            {
              from: [{ element: { type: "app" } }, { file: { categories: "app-entry" } }],
              allow: {
                to: {
                  element: {
                    types: ["pages", "features", "components", "api", "lib", "styles"],
                  },
                },
              },
            },
            // pages use a feature only through its public index.ts.
            {
              from: { element: { type: "pages" } },
              allow: [
                { to: { element: { types: ["components", "api", "lib"] } } },
                { to: { element: { type: "features", fileInternalPath: "index.ts" } } },
              ],
            },
            {
              from: { element: { type: "pages" } },
              disallow: { to: { element: { type: "features", fileInternalPath: "!index.ts" } } },
              message:
                "pages may only import a feature through its index.ts, the feature's public boundary (frontend-agent-rules F1).",
            },
            // Named exception (Q16): the component gallery reads theme.css as raw
            // text so its Token mapping section always matches the file. No other
            // page may import styles.
            {
              from: { element: { type: "pages", captured: { page: "dev-gallery" } } },
              allow: {
                to: { element: { type: "styles", fileInternalPath: "theme.css" } },
              },
            },
            // features never import another feature: a different captured name is
            // a different element, and no policy allows features -> features.
            {
              from: { element: { type: "features" } },
              allow: { to: { element: { types: ["components", "api", "lib"] } } },
            },
            {
              from: { element: { type: "components" } },
              allow: { to: { element: { type: "lib" } } },
            },
            {
              from: { element: { type: "api" } },
              allow: { to: { element: { type: "lib" } } },
            },
            {
              from: { element: { type: "test" } },
              allow: { to: { element: { types: ["api", "lib"] } } },
            },
            // Test files may use the test support folder.
            {
              from: { file: { categories: "test-file" } },
              allow: { to: { element: { type: "test" } } },
            },
          ],
        },
      ],
    },
  },

  // Import restrictions. Flat config replaces rule options per file, so these
  // groups run from the widest to the narrowest and each lists its full set.
  {
    files: SOURCE_FILES,
    rules: {
      "no-restricted-imports": restrictedImports(DAYJS_RESTRICTION, TEST_DOUBLE_RESTRICTION),
    },
  },
  {
    files: UI_LAYERS,
    rules: {
      "no-restricted-imports": restrictedImports(
        DAYJS_RESTRICTION,
        AXIOS_RESTRICTION,
        TEST_DOUBLE_RESTRICTION,
      ),
      "no-restricted-globals": FETCH_GLOBAL,
      "no-restricted-properties": FETCH_PROPERTIES,
    },
  },
  {
    files: ["src/pages/**"],
    ignores: ["src/pages/dev-gallery/**"],
    rules: {
      "no-restricted-imports": restrictedImports(
        DAYJS_RESTRICTION,
        AXIOS_RESTRICTION,
        TEST_DOUBLE_RESTRICTION,
        THEME_RAW_RESTRICTION,
      ),
    },
  },
  {
    files: [DATE_ENTRY],
    rules: {
      "no-restricted-imports": restrictedImports(TEST_DOUBLE_RESTRICTION),
    },
  },
  {
    files: TEST_FILES,
    rules: {
      "no-restricted-imports": restrictedImports(DAYJS_RESTRICTION),
    },
  },
  {
    files: UI_TEST_FILES,
    rules: {
      "no-restricted-imports": restrictedImports(DAYJS_RESTRICTION, AXIOS_RESTRICTION),
    },
  },
  {
    files: ["src/pages/**/*.test.{ts,tsx}"],
    ignores: ["src/pages/dev-gallery/**"],
    rules: {
      "no-restricted-imports": restrictedImports(
        DAYJS_RESTRICTION,
        AXIOS_RESTRICTION,
        THEME_RAW_RESTRICTION,
      ),
    },
  },
);
