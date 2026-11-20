import { describe, expect, it } from "vitest";

const NAMESPACES = ["common", "devGallery", "systemHealth"];
const LANGUAGES = ["en", "zh-TW"];

/** Every locale file, read straight from disk (not through i18next). */
const files = import.meta.glob<unknown>("./locales/*/*.json", { eager: true, import: "default" });

/** Returns the dotted path of every leaf key in a locale tree. */
function collectKeys(tree: unknown, prefix = ""): string[] {
  if (typeof tree !== "object" || tree === null || Array.isArray(tree)) {
    return [prefix];
  }
  return Object.entries(tree).flatMap(([key, value]) =>
    collectKeys(value, prefix === "" ? key : `${prefix}.${key}`),
  );
}

/** Throws an error naming every key that one language has and the other lacks. */
function assertSameKeys(namespace: string, byLanguage: Record<string, unknown>): void {
  const keySets = Object.entries(byLanguage).map(
    ([language, tree]) => [language, new Set(collectKeys(tree).filter(Boolean))] as const,
  );
  const problems = keySets.flatMap(([language, keys]) =>
    keySets
      .filter(([other]) => other !== language)
      .flatMap(([other, otherKeys]) =>
        [...otherKeys]
          .filter((key) => !keys.has(key))
          .map((key) => `${language}/${namespace} is missing "${key}" (present in ${other})`),
      ),
  );
  if (problems.length > 0) {
    throw new Error(problems.join("\n"));
  }
}

/** Groups the globbed files as namespace -> language -> tree. */
function groupByNamespace(): Map<string, Record<string, unknown>> {
  const grouped = new Map<string, Record<string, unknown>>();
  for (const [path, tree] of Object.entries(files)) {
    const match = /^\.\/locales\/([^/]+)\/([^/]+)\.json$/.exec(path);
    if (match?.[1] === undefined || match[2] === undefined) {
      throw new Error(`Unexpected locale file path: ${path}`);
    }
    const [, language, namespace] = match;
    grouped.set(namespace, { ...grouped.get(namespace), [language]: tree });
  }
  return grouped;
}

describe("locale files", () => {
  it("has every namespace in both languages", () => {
    const grouped = groupByNamespace();
    expect([...grouped.keys()].sort()).toEqual(NAMESPACES);
    for (const byLanguage of grouped.values()) {
      expect(Object.keys(byLanguage).sort()).toEqual(LANGUAGES);
    }
  });

  it.each(NAMESPACES)("has the same keys in zh-TW and en for %s", (namespace) => {
    const byLanguage = groupByNamespace().get(namespace) ?? {};
    expect(() => {
      assertSameKeys(namespace, byLanguage);
    }).not.toThrow();
  });

  it("fails and names the missing key when one language lacks a key", () => {
    const byLanguage = {
      "zh-TW": { title: "x", status: { ok: "x", down: "x" } },
      en: { title: "x", status: { ok: "x" } },
    };
    expect(() => {
      assertSameKeys("systemHealth", byLanguage);
    }).toThrow('en/systemHealth is missing "status.down" (present in zh-TW)');
  });
});
