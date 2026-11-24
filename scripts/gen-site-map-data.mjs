#!/usr/bin/env node
// Generates .notecraft/components/site-map-data.ts, the data behind the PRD
// §Site Map tree (prd-site-map-tree.tsx), from the documents that own it:
//
// - modules: the title of each module's index.mdx ("01 帳號" -> "帳號")
// - pages: the bullet list in PRD §Site Map (label, spec link, and whether it
//   sits under "不是獨立頁面")
// - features: the `###` subsections under each spec's `## 規格`, minus the
//   generic subsections in EXCLUDED_FEATURES, each with the anchor NoteCraft
//   gives that heading
//
// The data file is derived, so the specs are always right and any difference
// is the data file having drifted. Rerun after adding or renaming a `###`
// under a spec's `## 規格`, or after changing the PRD §Site Map list.
//
// Run: node scripts/gen-site-map-data.mjs           (write the data file)
//      node scripts/gen-site-map-data.mjs --check   (fail when it is stale)

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { slug, stripIgnored } from "./check-specs.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
export const SPECS_DIR = join(ROOT, "docs", "specs");
export const DATA_PATH = join(ROOT, ".notecraft", "components", "site-map-data.ts");

const FEATURE_CHAPTER = "規格";
const NOT_STANDALONE = "不是獨立頁面";

// Generic subsections every page (or many pages) has; they say how a page
// behaves, not what it offers, so they are not features. Matched by the exact
// heading text. The list was confirmed by the maintainer on 2026-11-24 in
// issue #617; the screen-state and screen-width entries spell out the
// "similar subsections" by the names the specs actually use.
export const EXCLUDED_FEATURES = [
  // Data fields
  "資料欄位",
  // Screen widths
  "不同螢幕寬度的呈現",
  "在窄螢幕上的呈現",
  "小螢幕的呈現",
  // Page scope
  "這一頁定什麼、不定什麼",
  // Loading, empty and load-failure screen states
  "還在載入與載入失敗",
  "任務列表沒有任務時",
  "空狀態與載入失敗",
  "載入中、空的與載入失敗",
  "空的與找不到",
  "四種互斥的頁面狀態",
  "兩個分頁各有一組自己的狀態",
  "載入失敗只換掉內容區",
  "統計總覽的空狀態",
  "品質監控要先有試標才有東西看",
  // URL and screen-state sync
  "網址與畫面狀態同步",
  // Language switching
  "語言切換",
  "語系切換不重新載入",
  // Links out to other pages
  "導向其他頁面",
];

const SPEC_FILE_RE = /^0\d-[\w-]+\/0\d-[\w-]+\.mdx$/;
const SPEC_LINK_RE = /：見 \[規格 (\d{2}-\d{2})\]\(\.\/(0\d-[\w-]+\/0\d-[\w-]+)\.mdx\)/;

/** The title in a document's frontmatter. */
function frontmatterTitle(text) {
  return text.match(/^---\n[\s\S]*?^title:\s*'([^']*)'/m)?.[1] ?? null;
}

/** Every heading in document order, with the anchor NoteCraft renders for it. */
export function headingsWithAnchors(text) {
  const seen = new Map();
  const out = [];
  const re = /^(#{1,6}) +(.+?)\s*$/gm;
  const clean = stripIgnored(text);
  let m;
  while ((m = re.exec(clean)) !== null) {
    const base = slug(m[2]);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.push({
      depth: m[1].length,
      title: m[2],
      anchor: n === 0 ? base : `${base}-${n}`,
    });
  }
  return out;
}

/** The `###` headings under `## 規格`, generic ones included. */
export function specSubsections(text) {
  const all = headingsWithAnchors(text);
  const start = all.findIndex((h) => h.depth === 2 && h.title === FEATURE_CHAPTER);
  if (start < 0) return [];
  const out = [];
  for (const h of all.slice(start + 1)) {
    if (h.depth <= 2) break;
    if (h.depth === 3) out.push({ title: h.title, anchor: h.anchor });
  }
  return out;
}

/** The `###` headings under `## 規格` that are features. */
export function features(text, excluded = EXCLUDED_FEATURES) {
  return specSubsections(text).filter((h) => !excluded.includes(h.title));
}

/**
 * Pages listed in PRD §Site Map, in list order: the label is the bullet text up
 * to its first comma, bracket or colon; a page under the top-level
 * "不是獨立頁面" bullet is not standalone.
 */
export function prdPages(prdText) {
  const lines = stripIgnored(prdText).split("\n");
  const start = lines.findIndex((l) => l === "## Site Map");
  if (start < 0) throw new Error("PRD has no ## Site Map chapter");
  const pages = [];
  let standalone = true;
  for (const line of lines.slice(start + 1)) {
    if (/^## /.test(line)) break;
    const top = line.match(/^- (.+)$/);
    if (top) standalone = top[1].trim() !== NOT_STANDALONE;
    const item = line.match(/^\s*- (.+)$/);
    if (!item) continue;
    const link = item[1].match(SPEC_LINK_RE);
    if (!link) continue;
    const label = item[1].split(/[，（：]/)[0].trim();
    pages.push({ spec: link[1], label, path: link[2], standalone });
  }
  return pages;
}

/** Spec page files under docs/specs, as "NN-module/NN-page" paths. */
function specFiles(specsDir) {
  return readdirSync(specsDir, { recursive: true })
    .map((p) => p.split("\\").join("/"))
    .filter((p) => SPEC_FILE_RE.test(p))
    .map((p) => p.replace(/\.mdx$/, ""))
    .sort();
}

/** Build the site map data, or throw when the sources disagree with each other. */
export function buildSiteMap(specsDir = SPECS_DIR, excluded = EXCLUDED_FEATURES) {
  const errors = [];
  const listed = prdPages(readFileSync(join(specsDir, "00-prd.mdx"), "utf8"));
  const files = specFiles(specsDir);

  for (const p of listed) {
    if (!files.includes(p.path))
      errors.push(`PRD §Site Map lists ${p.path}.mdx, which does not exist`);
    if (!p.path.startsWith(`${p.spec.slice(0, 2)}-`) || !p.path.includes(`/${p.spec.slice(3)}-`))
      errors.push(`PRD §Site Map labels ${p.path}.mdx as 規格 ${p.spec}`);
  }
  for (const f of files) {
    if (!listed.some((p) => p.path === f))
      errors.push(`docs/specs/${f}.mdx is not in PRD §Site Map`);
  }

  const used = new Set();
  const pages = [...listed]
    .sort((a, b) => a.spec.localeCompare(b.spec))
    .filter((p) => files.includes(p.path))
    .map((p) => {
      const text = readFileSync(join(specsDir, `${p.path}.mdx`), "utf8");
      for (const h of specSubsections(text)) if (excluded.includes(h.title)) used.add(h.title);
      return { ...p, features: features(text, excluded) };
    });

  for (const title of excluded) {
    if (!used.has(title))
      errors.push(`EXCLUDED_FEATURES lists 「${title}」, which no spec has under ## 規格 any more`);
  }

  const moduleIds = [...new Set(pages.map((p) => p.spec.slice(0, 2)))];
  const modules = moduleIds.map((id) => {
    const dir = readdirSync(specsDir).find((d) => d.startsWith(`${id}-`));
    const index = dir && join(specsDir, dir, "index.mdx");
    const title = index && existsSync(index) ? frontmatterTitle(readFileSync(index, "utf8")) : null;
    if (!title) errors.push(`module ${id} has no index.mdx title`);
    return { id, label: (title ?? id).replace(/^\d{2}\s+/, "") };
  });

  if (errors.length) throw new Error(errors.join("\n"));
  return { modules, pages };
}

/** Render the data as the TypeScript module the component imports. */
export function render({ modules, pages }) {
  const q = (s) => JSON.stringify(s);
  const out = [
    "/**",
    " * PRD §Site Map data: modules, pages and the features under each page.",
    " *",
    " * GENERATED by scripts/gen-site-map-data.mjs; do not edit by hand. Rerun",
    " * `node scripts/gen-site-map-data.mjs` after adding or renaming a `###`",
    " * under a spec's `## 規格`, or after changing the PRD §Site Map list. CI",
    " * runs it with --check and fails when this file is stale.",
    " */",
    "",
    "export interface SiteMapModule {",
    "  id: string;",
    "  label: string;",
    "}",
    "",
    "export interface SiteMapFeature {",
    "  title: string;",
    "  /** Heading anchor on the spec page, without the leading # */",
    "  anchor: string;",
    "}",
    "",
    "export interface SiteMapPage {",
    "  spec: string;",
    "  label: string;",
    "  /** Spec file path under docs/specs/, without the .mdx extension */",
    "  path: string;",
    '  /** false: listed under "不是獨立頁面" in PRD §Site Map */',
    "  standalone: boolean;",
    "  features: SiteMapFeature[];",
    "}",
    "",
    "export const SITE_MAP_MODULES: SiteMapModule[] = [",
    ...modules.map((m) => `  { id: ${q(m.id)}, label: ${q(m.label)} },`),
    "];",
    "",
    "export const SITE_MAP_PAGES: SiteMapPage[] = [",
  ];
  for (const p of pages) {
    out.push(
      "  {",
      `    spec: ${q(p.spec)},`,
      `    label: ${q(p.label)},`,
      `    path: ${q(p.path)},`,
      `    standalone: ${p.standalone},`,
    );
    if (p.features.length === 0) out.push("    features: [],");
    else {
      out.push("    features: [");
      for (const f of p.features)
        out.push(`      { title: ${q(f.title)}, anchor: ${q(f.anchor)} },`);
      out.push("    ],");
    }
    out.push("  },");
  }
  out.push("];", "");
  return out.join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  let data;
  try {
    data = buildSiteMap();
  } catch (e) {
    for (const line of e.message.split("\n")) console.error(`ERROR ${line}`);
    process.exit(1);
  }
  const next = render(data);
  const rel = relative(process.cwd(), DATA_PATH);
  const count = data.pages.reduce((n, p) => n + p.features.length, 0);
  if (check) {
    const current = existsSync(DATA_PATH) ? readFileSync(DATA_PATH, "utf8") : "";
    if (current !== next) {
      console.error(
        `ERROR ${rel} is stale; run \`node scripts/gen-site-map-data.mjs\` and commit the result`,
      );
      process.exit(1);
    }
    console.log(
      `gen-site-map-data: ${rel} is up to date (${data.pages.length} pages, ${count} features)`,
    );
  } else {
    writeFileSync(DATA_PATH, next);
    console.log(`gen-site-map-data: wrote ${rel} (${data.pages.length} pages, ${count} features)`);
  }
}
