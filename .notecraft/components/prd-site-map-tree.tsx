import type { ReactElement } from "react";
import { FileText, Layers } from "lucide-react";

/**
 * PRD Site Map overview: one static tree that shows the whole system at once.
 * Root "入口" -> seven modules -> twenty pages, drawn left to right in SVG.
 * Every page node shows its spec number and links to that spec page.
 * Pages that are not standalone pages (cross-page behaviour or lists) use a
 * different icon and a dashed outline; the legend sits below the tree.
 * The node list and module membership mirror the bullet list in PRD §Site Map;
 * that list is the single source, this file only draws it.
 */

/* ------------------------------------------------------------ colour tokens */

const INK = "#1E1B4B"; // --color-ink
const MUTED = "#64748B"; // --color-ink-muted
const PRIMARY_STRONG = "#4F46E5"; // --color-primary-strong
const PRIMARY_BORDER = "#C7D2FE"; // --color-primary-border
const SLATE_50 = "#F8FAFC"; // --color-slate-50
const WHITE = "#FFFFFF"; // --color-white
const FONT = "'Inter','Noto Sans TC','PingFang TC',-apple-system,sans-serif"; // --font-sans
const MONO = "'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace"; // --font-mono

/* ------------------------------------------------------------ data (PRD §Site Map) */

interface Module {
  id: string;
  label: string;
  /** Module colour from prd-writing/references/visualize.md; used on outlines and connectors only */
  color: string;
}

interface Page {
  spec: string;
  label: string;
  /** Spec file path under docs/specs/, without the .mdx extension */
  path: string;
  /** false: listed under "不是獨立頁面" in PRD §Site Map */
  standalone: boolean;
}

const ROOT_LABEL = "入口";

const MODULES: Module[] = [
  { id: "01", label: "帳號", color: "#6366F1" }, // --color-primary
  { id: "02", label: "儀表板", color: "#047857" }, // --color-cta
  { id: "03", label: "任務管理", color: "#1D4ED8" }, // --color-info
  { id: "04", label: "標記作業", color: "#8B5CF6" }, // --color-file-markdown
  { id: "05", label: "資料集", color: "#818CF8" }, // --color-secondary
  { id: "06", label: "系統管理", color: "#6366F1" }, // --color-primary (cycle restarts at 06)
  { id: "07", label: "共用介面", color: "#047857" }, // --color-cta
];

const PAGES: Page[] = [
  { spec: "01-01", label: "登入", path: "01-account/01-login", standalone: true },
  { spec: "01-02", label: "註冊", path: "01-account/02-register", standalone: true },
  { spec: "01-03", label: "用一次性連結設定密碼", path: "01-account/03-reset-password", standalone: true },
  { spec: "01-04", label: "個人設定", path: "01-account/04-profile", standalone: true },
  { spec: "01-05", label: "登入狀態與安全", path: "01-account/05-login-state", standalone: false },
  { spec: "02-01", label: "儀表板", path: "02-dashboard/01-dashboard", standalone: true },
  { spec: "03-01", label: "任務列表", path: "03-task-management/01-task-list", standalone: true },
  { spec: "03-02", label: "新增任務", path: "03-task-management/02-task-new", standalone: true },
  { spec: "03-03", label: "任務詳情", path: "03-task-management/03-task-detail", standalone: true },
  { spec: "04-01", label: "標記清單", path: "04-annotation/01-annotation-list", standalone: true },
  { spec: "04-02", label: "標記工作區", path: "04-annotation/02-annotation-workspace", standalone: true },
  { spec: "05-01", label: "資料集分析列表", path: "05-dataset/01-analysis-list", standalone: true },
  { spec: "05-02", label: "資料集分析詳情", path: "05-dataset/02-analysis-detail", standalone: true },
  { spec: "05-03", label: "資料匯入與版本", path: "05-dataset/03-ingestion-lineage", standalone: true },
  { spec: "06-01", label: "使用者管理", path: "06-admin/01-user-management", standalone: true },
  { spec: "06-02", label: "角色設定", path: "06-admin/02-role-settings", standalone: true },
  { spec: "07-01", label: "側欄導覽", path: "07-shared/01-sidebar", standalone: false },
  { spec: "07-02", label: "工作頁籤", path: "07-shared/02-workspace-tabs", standalone: false },
  { spec: "07-03", label: "無權限與找不到", path: "07-shared/03-denied-and-not-found", standalone: false },
  { spec: "07-04", label: "通知事件", path: "07-shared/04-notification-events", standalone: false },
];

/* ------------------------------------------------------------ links */

// Same rule NoteCraft applies to MDX links: docs/specs/<path>.mdx -> /notes/specs/<path>,
// prefixed with the site base when the site is deployed under a sub-path.
const RAW_BASE = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
const BASE = RAW_BASE === "/" ? "" : RAW_BASE.replace(/\/+$/, "");
const specHref = (path: string): string => `${BASE}/notes/specs/${path}`;

/* ------------------------------------------------------------ layout (computed once, SSR-safe) */

const PAD = 8;
const ROW = 34; // vertical pitch of page nodes
const PAGE_H = 28;
const GROUP_GAP = 14; // extra space between modules
const ROOT = { x: PAD, w: 76, h: 36 };
const MOD = { x: 128, w: 128, h: 32 };
const PAGE = { x: 300, w: 268 };
const W = PAGE.x + PAGE.w + PAD;

interface PlacedPage extends Page {
  y: number; // centre line
}

interface PlacedModule extends Module {
  y: number; // centre line
  pages: PlacedPage[];
}

const PLACED: PlacedModule[] = (() => {
  let cursor = PAD + PAGE_H / 2;
  return MODULES.map((m, i) => {
    if (i > 0) cursor += GROUP_GAP;
    const pages = PAGES.filter((p) => p.spec.startsWith(`${m.id}-`)).map((p, j) => ({
      ...p,
      y: cursor + j * ROW,
    }));
    cursor += pages.length * ROW;
    const y = pages.length ? (pages[0].y + pages[pages.length - 1].y) / 2 : cursor;
    return { ...m, y, pages };
  });
})();

const H = PLACED[PLACED.length - 1].pages.slice(-1)[0].y + PAGE_H / 2 + PAD;
const ROOT_Y = (PLACED[0].y + PLACED[PLACED.length - 1].y) / 2;

/** Elbow connector: horizontal out of the parent, vertical along the spine, horizontal into the child */
function elbow(x1: number, y1: number, x2: number, y2: number): string {
  const mid = x1 + (x2 - x1) / 2;
  return `M${x1},${y1} H${mid} V${y2} H${x2}`;
}

/* ------------------------------------------------------------ component */

export default function PrdSiteMapTree(): ReactElement {
  const total = PAGES.length;
  const notStandalone = PAGES.filter((p) => !p.standalone).length;

  return (
    <div className="not-prose space-y-3">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ minWidth: 560, maxWidth: W, fontFamily: FONT }}
          role="group"
          aria-labelledby="prd-site-map-tree-title"
        >
          <title id="prd-site-map-tree-title">
            {`全站樹狀圖：從${ROOT_LABEL}分出 ${MODULES.length} 個模組，共 ${total} 頁，其中 ${notStandalone} 項不是獨立頁面；每個頁面連到它的規格。`}
          </title>

          {/* connectors: root -> modules */}
          {PLACED.map((m) => (
            <path
              key={`root-${m.id}`}
              d={elbow(ROOT.x + ROOT.w, ROOT_Y, MOD.x, m.y)}
              fill="none"
              stroke={MUTED}
              strokeWidth={1.25}
              strokeLinejoin="round"
            />
          ))}

          {/* connectors: module -> pages */}
          {PLACED.flatMap((m) =>
            m.pages.map((p) => (
              <path
                key={`mod-${p.spec}`}
                d={elbow(MOD.x + MOD.w, m.y, PAGE.x, p.y)}
                fill="none"
                stroke={m.color}
                strokeWidth={1.25}
                strokeLinejoin="round"
              />
            )),
          )}

          {/* root */}
          <g>
            <rect
              x={ROOT.x}
              y={ROOT_Y - ROOT.h / 2}
              width={ROOT.w}
              height={ROOT.h}
              rx={8}
              fill={SLATE_50}
              stroke={MUTED}
              strokeWidth={1.5}
            />
            <text
              x={ROOT.x + ROOT.w / 2}
              y={ROOT_Y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={14}
              fontWeight={600}
              fill={INK}
            >
              {ROOT_LABEL}
            </text>
          </g>

          {/* modules */}
          {PLACED.map((m) => (
            <g key={m.id}>
              <rect
                x={MOD.x}
                y={m.y - MOD.h / 2}
                width={MOD.w}
                height={MOD.h}
                rx={8}
                fill={WHITE}
                stroke={m.color}
                strokeWidth={1.5}
              />
              <circle cx={MOD.x + 14} cy={m.y} r={4} fill={m.color} />
              <text x={MOD.x + 26} y={m.y} dominantBaseline="central" fontSize={13} fill={INK}>
                <tspan fontFamily={MONO} fontSize={12} fill={MUTED}>
                  {m.id}
                </tspan>
                <tspan dx={6} fontWeight={600}>
                  {m.label}
                </tspan>
              </text>
            </g>
          ))}

          {/* pages */}
          {PLACED.flatMap((m) =>
            m.pages.map((p) => {
              const top = p.y - PAGE_H / 2;
              const Icon = p.standalone ? FileText : Layers;
              return (
                <a
                  key={p.spec}
                  href={specHref(p.path)}
                  aria-label={`規格 ${p.spec} ${p.label}${p.standalone ? "" : "（不是獨立頁面）"}`}
                  className="group outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                >
                  <title>{`開啟規格 ${p.spec} ${p.label}`}</title>
                  <rect
                    x={PAGE.x}
                    y={top}
                    width={PAGE.w}
                    height={PAGE_H}
                    rx={6}
                    fill={p.standalone ? WHITE : SLATE_50}
                    stroke={p.standalone ? PRIMARY_BORDER : MUTED}
                    strokeWidth={1}
                    strokeDasharray={p.standalone ? undefined : "4 3"}
                    className="transition-colors duration-150 group-hover:fill-indigo-50"
                  />
                  <Icon
                    x={PAGE.x + 9}
                    y={p.y - 7}
                    size={14}
                    color={p.standalone ? PRIMARY_STRONG : MUTED}
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <text x={PAGE.x + 31} y={p.y} dominantBaseline="central" fontSize={13} fill={INK}>
                    <tspan fontFamily={MONO} fontSize={12} fill={PRIMARY_STRONG}>
                      {p.spec}
                    </tspan>
                    <tspan dx={8} className="group-hover:underline">
                      {p.label}
                    </tspan>
                  </text>
                </a>
              );
            }),
          )}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-indigo-200 bg-white">
            <FileText size={12} className="text-indigo-600" aria-hidden="true" />
          </span>
          獨立頁面
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-dashed border-slate-500 bg-slate-50">
            <Layers size={12} className="text-slate-500" aria-hidden="true" />
          </span>
          不是獨立頁面（跨頁共用的行為或清單）
        </span>
        <span>
          <span className="font-mono text-indigo-600">NN-NN</span> 是規格編號，點頁面開啟該頁規格
        </span>
      </div>
    </div>
  );
}
