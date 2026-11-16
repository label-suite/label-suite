import { useId, useState } from "react";
import type { ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { KeyRound, Lock, Mail, Server, Users } from "lucide-react";

// C4 model level 2 (Container) for Label Suite.
// Source of truth: docs/development/architecture.mdx §容器視圖 table and the sections it cites
// (技術選型, 測試集答案不外露, 資料庫雙層, 非同步任務, 部署與維運). Every node and edge matches a row there.

// SVG colours: label-suite-design tokens
const C = {
  primary: "#6366F1", // --color-primary
  primaryStrong: "#4F46E5", // --color-primary-strong
  primarySoft: "#EEF2FF", // --color-primary-soft-bg
  primaryBorder: "#C7D2FE", // --color-primary-border
  ink: "#1E1B4B", // --color-ink
  muted: "#64748B", // --color-ink-muted
  border: "#E2E8F0", // --color-border
  slate50: "#F8FAFC", // --color-slate-50
  off: "#CBD5E1", // slate-300: lines only, never text (closest step below --color-border for a disabled line)
  warning: "#A16207", // --color-warning
  white: "#FFFFFF", // --color-white
} as const;

const FONT = "'Inter', 'Noto Sans TC', 'PingFang TC', -apple-system, sans-serif"; // --font-sans
const W = 640;
const H = 616;
const BOUNDARY = { x: 12, y: 100, w: 604, h: 390 };

type Tier = "lite" | "prod";
type Integration = "google" | "resend";
type Kind = "person" | "container" | "store" | "inner" | "external";
type NodeId =
  | "users"
  | "deployer"
  | "spa"
  | "nginx"
  | "api"
  | "worker"
  | "redis"
  | "db"
  | "answers"
  | "google"
  | "resend";

type Text = { typeLabel: string; title: string; short: string; desc: string };

type CNode = {
  id: NodeId;
  kind: Kind;
  text: Text | Record<Tier, Text>; // a Record when the text depends on the database tier
  icon?: ReactNode;
  x: number;
  y: number;
  w: number;
  h: number;
  optional?: Integration;
};

type CEdge = {
  id: string;
  from: NodeId;
  to: NodeId;
  short: string;
  full: string | Record<Tier, string>;
  points: [number, number][];
  label: { x: number; y: number; anchor: "start" | "middle" | "end" };
  requires?: Integration; // drawn as active only when this integration is configured
  fallbackFor?: Integration; // drawn only when this integration is NOT configured
};

// ---------- data: matches architecture.mdx §容器視圖 row by row ----------
const NODES: CNode[] = [
  {
    id: "deployer",
    kind: "person",
    text: {
      typeLabel: "人",
      title: "部署者",
      short: "不是系統角色",
      desc: "用 Docker Compose 部署整套容器（Lite 層 docker-compose.yml、正式層 docker-compose.prod.yml），這期的批次資料也由部署者直接匯入。Resend 未設定時，從伺服器 log 取得設定密碼連結轉給使用者，所以 Lite 層的 log 視為敏感。",
    },
    icon: <Server size={16} />,
    x: 44,
    y: 8,
    w: 220,
    h: 68,
  },
  {
    id: "users",
    kind: "person",
    text: {
      typeLabel: "人",
      title: "使用者",
      short: "平台成員、系統管理員",
      desc: "平台成員與系統管理員都從瀏覽器使用平台，請求一律先到 Nginx。第一層的兩種人在這一層走同一條路，差別在 API 的授權判定，不在容器。",
    },
    icon: <Users size={16} />,
    x: 376,
    y: 8,
    w: 220,
    h: 68,
  },
  {
    id: "spa",
    kind: "container",
    text: {
      typeLabel: "容器・React 19＋Vite",
      title: "前端 SPA",
      short: "在使用者的瀏覽器執行",
      desc: "React 19、Vite、TypeScript strict，路由與伺服器狀態用 React Router 與 TanStack Query（ADR-004，React 版本依 2026-11-10 裁定）。build 出的 /dist 由 Nginx 服務；API client 由 Orval 從 openapi.json 產生，所有請求走同一道 HTTP 邊界。",
    },
    x: 44,
    y: 128,
    w: 220,
    h: 72,
  },
  {
    id: "nginx",
    kind: "container",
    text: {
      typeLabel: "容器・nginx:alpine",
      title: "Nginx",
      short: "公開入口・可接 Cloudflare",
      desc: "公開入口與靜態前端伺服器（ADR-023）。有 Cloudflare 時由它當 DNS、CDN 與 TLS 邊緣，Nginx 仍是原站入口，照樣要擋安全標頭並隔離內部服務。",
    },
    x: 376,
    y: 128,
    w: 220,
    h: 72,
  },
  {
    id: "worker",
    kind: "container",
    text: {
      typeLabel: "容器・Celery",
      title: "背景 worker",
      short: "scoring／default 佇列",
      desc: "Celery（ADR-007），和 API 共用同一個 image（ADR-008）。評分走 scoring 佇列：parse_submission → load_answers → compute_metrics → write_results；雜務走 default。最多重試三次，退避 60、180、540 秒，單一評分工作上限 300 秒。",
    },
    x: 44,
    y: 240,
    w: 180,
    h: 72,
  },
  {
    id: "redis",
    kind: "store",
    text: {
      typeLabel: "快取佇列",
      title: "Redis 7",
      short: "/0 /1 /2",
      desc: "一個 Redis 7 實例同時當 Celery broker（/0）、result backend（/1）與應用快取（/2），用 DB 編號隔開（ADR-006）。快取 DB 的淘汰策略是 allkeys-lru，共用實例不設 maxmemory。",
    },
    x: 270,
    y: 240,
    w: 100,
    h: 72,
  },
  {
    id: "api",
    kind: "container",
    text: {
      typeLabel: "容器・FastAPI＋uvicorn",
      title: "API",
      short: "認證、授權與業務邏輯",
      desc: "FastAPI 加 pydantic v2 加 uvicorn（ADR-003）。驗 httpOnly cookie 裡的 access JWT、跑權限矩陣四步判定，再進業務邏輯。評分這類耗時工作不在這裡做：端點驗完檔案就送進 scoring 佇列，之後回查狀態。",
    },
    x: 416,
    y: 240,
    w: 180,
    h: 72,
  },
  {
    id: "db",
    kind: "store",
    text: {
      lite: {
        typeLabel: "資料庫・Lite 層",
        title: "SQLite",
        short: "./data 共用 volume",
        desc: "依 DATABASE_URL 是否設定決定資料庫層（ADR-024）。Lite 層是預設：SQLite 檔放在 ./data，API 用 aiosqlite、worker 用同步的 sqlite3。./data 必須是持久化 volume，而且 backend 與 worker 兩個 container 要掛同一個路徑，否則 worker 寫的資料 API 讀不到。",
      },
      prod: {
        typeLabel: "資料庫・正式層",
        title: "PostgreSQL 16",
        short: "設 DATABASE_URL 啟用",
        desc: "設了 DATABASE_URL 就是正式層（ADR-024）：PostgreSQL 16，給多人與並發寫入。API 用 asyncpg，worker 由同一個 URL 推導出 psycopg2，因為 Celery 跑在同步執行緒裡，不能用 async engine。",
      },
    },
    x: 44,
    y: 370,
    w: 396,
    h: 100,
  },
  {
    id: "answers",
    kind: "inner",
    text: {
      typeLabel: "資料表",
      title: "測試集答案表",
      short: "只有 worker 讀",
      desc: "測試集答案存在獨立、受存取控制的資料表，不與一般標記資料同表（ADR-005）。讀答案只在 worker 的 load_answers()，答案不離開 worker；授權第四步另加答案隔離條件，權限矩陣為 true 也蓋不過（ADR-037）。",
    },
    icon: <Lock size={14} />,
    x: 232,
    y: 410,
    w: 192,
    h: 44,
  },
  {
    id: "google",
    kind: "external",
    text: {
      typeLabel: "外部系統・可選",
      title: "Google（OIDC）",
      short: "登入頁的 Google SSO",
      desc: "登入頁的 Google SSO，由 API 走直接 OIDC 整合（ADR-035）。GOOGLE_CLIENT_ID 沒設定時按鈕退回 no-op，Email 與密碼登入照常可用。",
    },
    icon: <KeyRound size={16} />,
    x: 200,
    y: 528,
    w: 190,
    h: 72,
    optional: "google",
  },
  {
    id: "resend",
    kind: "external",
    text: {
      typeLabel: "外部系統・可選",
      title: "Resend",
      short: "寄出帳號相關信件",
      desc: "寄出註冊驗證信、忘記密碼信與設定密碼信（ADR-013）。沒有設定 key 時，設定密碼連結改印在伺服器 log，由部署者轉給使用者，畫面要讓管理員知道信沒有寄出去（2026-11-10 裁定）。",
    },
    icon: <Mail size={16} />,
    x: 406,
    y: 528,
    w: 190,
    h: 72,
    optional: "resend",
  },
];

const EDGES: CEdge[] = [
  {
    id: "users-nginx",
    from: "users",
    to: "nginx",
    short: "HTTPS",
    full: "以 HTTPS 開啟平台；有 Cloudflare 時先經過它的 DNS、CDN 與 TLS 邊緣",
    points: [
      [486, 76],
      [486, 128],
    ],
    label: { x: 494, y: 118, anchor: "start" },
  },
  {
    id: "nginx-spa",
    from: "nginx",
    to: "spa",
    short: "提供 /dist",
    full: "服務前端 build 出來的 /dist 靜態檔",
    points: [
      [376, 158],
      [264, 158],
    ],
    label: { x: 320, y: 152, anchor: "middle" },
  },
  {
    id: "spa-nginx",
    from: "spa",
    to: "nginx",
    short: "呼叫 /api/v1",
    full: "以 JSON 呼叫 /api/v1，身分放在 httpOnly cookie",
    points: [
      [264, 176],
      [376, 176],
    ],
    label: { x: 320, y: 195, anchor: "middle" },
  },
  {
    id: "nginx-api",
    from: "nginx",
    to: "api",
    short: "反向代理 /api/v1",
    full: "把 /api/v1 轉給 API；API、worker、Redis 與資料庫都留在內部",
    points: [
      [486, 200],
      [486, 240],
    ],
    label: { x: 478, y: 225, anchor: "end" },
  },
  {
    id: "api-redis",
    from: "api",
    to: "redis",
    short: "送任務",
    full: "評分任務送進 scoring 佇列（/0）、查任務結果（/1）、讀寫應用快取（/2）",
    points: [
      [416, 276],
      [370, 276],
    ],
    label: { x: 393, y: 268, anchor: "middle" },
  },
  {
    id: "worker-redis",
    from: "worker",
    to: "redis",
    short: "取任務",
    full: "從 scoring 與 default 佇列取任務，結果寫回 result backend 留 24 小時",
    points: [
      [224, 276],
      [270, 276],
    ],
    label: { x: 247, y: 268, anchor: "middle" },
  },
  {
    id: "api-db",
    from: "api",
    to: "db",
    short: "讀寫業務資料",
    full: {
      lite: "以 sqlite+aiosqlite 讀寫 ./data/label_suite.db",
      prod: "以 postgresql+asyncpg 讀寫",
    },
    points: [
      [430, 312],
      [430, 370],
    ],
    label: { x: 438, y: 346, anchor: "start" },
  },
  {
    id: "worker-db",
    from: "worker",
    to: "db",
    short: "寫入結果",
    full: {
      lite: "write_results 以同步 sqlite3 寫進同一個 ./data/label_suite.db",
      prod: "write_results 以同步 psycopg2 寫入",
    },
    points: [
      [80, 312],
      [80, 370],
    ],
    label: { x: 88, y: 346, anchor: "start" },
  },
  {
    id: "worker-answers",
    from: "worker",
    to: "answers",
    short: "load_answers",
    full: "load_answers() 只在 worker 行程內讀答案，答案不離開 worker",
    points: [
      [200, 312],
      [200, 432],
      [232, 432],
    ],
    label: { x: 208, y: 346, anchor: "start" },
  },
  {
    id: "deployer-db",
    from: "deployer",
    to: "db",
    short: "直接匯入批次資料",
    full: "這期的批次資料由部署者直接匯入，不經過介面",
    points: [
      [44, 42],
      [26, 42],
      [26, 450],
      [44, 450],
    ],
    label: { x: 32, y: 226, anchor: "start" },
  },
  {
    id: "api-google",
    from: "api",
    to: "google",
    short: "OIDC 驗證登入",
    full: "以 OIDC 驗證使用者的 Google 帳號",
    points: [
      [520, 312],
      [520, 508],
      [295, 508],
      [295, 528],
    ],
    label: { x: 408, y: 513, anchor: "middle" },
    requires: "google",
  },
  {
    id: "api-resend",
    from: "api",
    to: "resend",
    short: "寄信",
    full: "交寄註冊驗證信、忘記密碼信與設定密碼信",
    points: [
      [572, 312],
      [572, 528],
    ],
    label: { x: 580, y: 420, anchor: "start" },
    requires: "resend",
  },
  {
    id: "api-deployer-log",
    from: "api",
    to: "deployer",
    short: "log 裡的設定密碼連結",
    full: "Resend 未設定時，設定密碼連結印在伺服器 log，由部署者轉給使用者",
    points: [
      [596, 262],
      [606, 262],
      [606, 90],
      [154, 90],
      [154, 76],
    ],
    label: { x: 330, y: 95, anchor: "middle" },
    fallbackFor: "resend",
  },
];

const DEFAULT_NODE: NodeId = "api";
const TIERS: { id: Tier; label: string }[] = [
  { id: "lite", label: "Lite（SQLite）" },
  { id: "prod", label: "正式（PostgreSQL）" },
];
const INTEGRATIONS: { id: Integration; label: string }[] = [
  { id: "google", label: "Google OIDC" },
  { id: "resend", label: "Resend" },
];
// ---------- end data ----------

type EdgeState = "active" | "off" | "hidden" | "fallback";

function edgeState(e: CEdge, cfg: Record<Integration, boolean>): EdgeState {
  if (e.fallbackFor) return cfg[e.fallbackFor] ? "hidden" : "fallback";
  if (e.requires && !cfg[e.requires]) return "off";
  return "active";
}

function textOf(n: CNode, tier: Tier): Text {
  return "title" in n.text ? n.text : n.text[tier];
}

function fullOf(e: CEdge, tier: Tier): string {
  return typeof e.full === "string" ? e.full : e.full[tier];
}

// Rough text width for label backgrounds: CJK glyphs ~12px, ASCII ~7px at 12px font size.
function textWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += /[\u0000-ÿ]/.test(ch) ? 7 : 12;
  return w;
}

const nodeById = (id: NodeId): CNode => NODES.find((n) => n.id === id) as CNode;

const chip =
  "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ";
const toggle =
  "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ";

export default function ArchitectureContainerView() {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const reduce = useReducedMotion();
  const [selected, setSelected] = useState<NodeId>(DEFAULT_NODE);
  const [tier, setTier] = useState<Tier>("lite");
  const [cfg, setCfg] = useState<Record<Integration, boolean>>({ google: true, resend: true });

  const fade = reduce ? undefined : "opacity 200ms cubic-bezier(0.4, 0, 0.2, 1)";
  const marker = (s: EdgeState) => `url(#${uid}-arrow-${s === "fallback" ? "warn" : s === "off" ? "off" : "on"})`;
  const touches = (e: CEdge) => e.from === selected || e.to === selected;
  const related = new Set<NodeId>([selected]);
  EDGES.forEach((e) => {
    if (touches(e) && edgeState(e, cfg) !== "hidden") {
      related.add(e.from);
      related.add(e.to);
    }
  });

  const sel = nodeById(selected);
  const selText = textOf(sel, tier);
  const selEdges = EDGES.filter((e) => touches(e) && edgeState(e, cfg) !== "hidden");

  return (
    <div className="not-prose w-full space-y-3">
      <div role="group" aria-label="選擇要看的容器或對象" className="flex flex-wrap gap-1.5">
        {NODES.map((n) => (
          <button
            key={n.id}
            type="button"
            aria-pressed={selected === n.id}
            onClick={() => setSelected(n.id)}
            className={
              chip +
              (selected === n.id
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-indigo-200 bg-white text-indigo-950 hover:bg-indigo-50")
            }
          >
            {textOf(n, tier).title}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
        <div role="group" aria-label="資料庫層" className="flex flex-wrap items-center gap-2">
          <span>資料庫層</span>
          {TIERS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tier === t.id}
              onClick={() => setTier(t.id)}
              className={
                toggle +
                (tier === t.id
                  ? "border-indigo-200 bg-indigo-50 text-indigo-600"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="外部整合是否設定" className="flex flex-wrap items-center gap-2">
          <span>部署設定</span>
          {INTEGRATIONS.map((it) => (
            <button
              key={it.id}
              type="button"
              aria-pressed={cfg[it.id]}
              onClick={() => setCfg((c) => ({ ...c, [it.id]: !c[it.id] }))}
              className={
                toggle +
                (cfg[it.id]
                  ? "border-indigo-200 bg-indigo-50 text-indigo-600"
                  : "border-dashed border-slate-200 bg-white text-slate-500")
              }
            >
              <span
                aria-hidden="true"
                className={"h-2 w-2 rounded-full " + (cfg[it.id] ? "bg-indigo-500" : "border border-slate-500")}
              />
              {it.label}：{cfg[it.id] ? "已設定" : "未設定"}
            </button>
          ))}
        </div>
      </div>

      {/* side by side when the container is wide enough (slides); stacked in the 596px note column */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-[3_1_560px] overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label="Label Suite 的容器圖：使用者以 HTTPS 連到 Nginx，Nginx 提供前端 SPA 的靜態檔，並把 /api/v1 反向代理到 API。API 把評分任務送進 Redis 佇列，背景 worker 從佇列取任務、讀測試集答案表、把結果寫回資料庫；資料庫在 Lite 層是 SQLite，正式層是 PostgreSQL。測試集答案表只有 worker 讀。API 以 OIDC 向 Google 驗證登入、透過 Resend 寄信，兩者都是可選的；Resend 未設定時設定密碼連結印在伺服器 log 由部署者轉交。部署者也直接把批次資料匯入資料庫。"
          style={{ minWidth: 560, fontFamily: FONT }}
        >
          <defs>
            {(
              [
                ["on", C.primary],
                ["off", C.off],
                ["warn", C.warning],
              ] as const
            ).map(([k, color]) => (
              <marker
                key={k}
                id={`${uid}-arrow-${k}`}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M0 0 L10 5 L0 10 z" fill={color} />
              </marker>
            ))}
          </defs>
          <rect x="0.5" y="0.5" width={W - 1} height={H - 1} fill={C.white} stroke={C.border} />

          {/* system boundary: everything inside is one Label Suite deployment */}
          <g aria-hidden="true">
            <rect
              x={BOUNDARY.x}
              y={BOUNDARY.y}
              width={BOUNDARY.w}
              height={BOUNDARY.h}
              rx={14}
              fill={C.slate50}
              stroke={C.primaryBorder}
              strokeDasharray="8 5"
            />
            <text x={320} y={BOUNDARY.y + 18} textAnchor="middle" fontSize={12} fontWeight={600} fill={C.primaryStrong}>
              Label Suite
            </text>
          </g>

          {NODES.map((n) => {
            const t = textOf(n, tier);
            const isSel = n.id === selected;
            const disabled = n.optional ? !cfg[n.optional] : false;
            const fill =
              n.kind === "person" ? C.primarySoft : n.kind === "external" ? (disabled ? C.white : C.slate50) : C.white;
            const stroke = isSel
              ? C.primaryStrong
              : n.kind === "person"
                ? C.primaryBorder
                : n.kind === "external"
                  ? disabled
                    ? C.off
                    : C.muted
                  : C.primary;
            const ink = disabled ? C.muted : C.ink;
            const dimmed = !related.has(n.id) && !(n.id === "db" && selected === "answers");
            if (n.kind === "inner") {
              return (
                <g
                  key={n.id}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setSelected(n.id);
                  }}
                  style={{ cursor: "pointer", opacity: dimmed ? 0.5 : 1, transition: fade }}
                  aria-hidden="true"
                >
                  <rect
                    x={n.x}
                    y={n.y}
                    width={n.w}
                    height={n.h}
                    rx={8}
                    fill={C.primarySoft}
                    stroke={isSel ? C.primaryStrong : C.primary}
                    strokeWidth={isSel ? 2 : 1}
                  />
                  <g color={C.primaryStrong}>
                    <svg x={n.x + 10} y={n.y + 8} width={14} height={14} overflow="visible">
                      {n.icon}
                    </svg>
                  </g>
                  <text x={n.x + 30} y={n.y + 19} fontSize={13} fontWeight={600} fill={C.ink}>
                    {t.title}
                  </text>
                  <text x={n.x + 30} y={n.y + 36} fontSize={12} fill={C.muted}>
                    {t.short}
                  </text>
                </g>
              );
            }
            const tx = n.x + 14;
            const typeX = n.icon ? n.x + 36 : tx;
            return (
              <g
                key={n.id}
                onClick={() => setSelected(n.id)}
                style={{ cursor: "pointer", opacity: dimmed ? 0.5 : 1, transition: fade }}
                aria-hidden="true"
              >
                <rect
                  x={n.x}
                  y={n.y}
                  width={n.w}
                  height={n.h}
                  rx={n.kind === "store" ? 6 : 12}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isSel ? 2 : 1}
                  strokeDasharray={n.kind === "external" ? "6 4" : undefined}
                />
                {n.icon && (
                  <g color={disabled ? C.muted : n.kind === "person" ? C.primaryStrong : C.muted}>
                    <svg x={n.x + 14} y={n.y + 9} width={16} height={16} overflow="visible">
                      {n.icon}
                    </svg>
                  </g>
                )}
                <text x={typeX} y={n.y + 22} fontSize={12} fill={n.kind === "container" ? C.primaryStrong : C.muted}>
                  {t.typeLabel}
                </text>
                {disabled && (
                  <text x={n.x + n.w - 14} y={n.y + 22} textAnchor="end" fontSize={12} fontWeight={600} fill={C.muted}>
                    未設定
                  </text>
                )}
                <text x={tx} y={n.y + 44} fontSize={15} fontWeight={600} fill={ink}>
                  {t.title}
                </text>
                <text x={tx} y={n.y + 62} fontSize={12} fill={C.muted}>
                  {t.short}
                </text>
              </g>
            );
          })}

          {/* edges after nodes so the lines that pass into the database box stay visible */}
          {EDGES.map((e) => {
            const s = edgeState(e, cfg);
            const on = touches(e);
            const opacity = s === "hidden" ? 0 : on ? 1 : 0.22;
            const stroke = s === "fallback" ? C.warning : s === "off" ? C.off : C.primary;
            const text = e.short;
            const tw = textWidth(text) + 8;
            const lx =
              e.label.anchor === "end"
                ? e.label.x - tw + 4
                : e.label.anchor === "middle"
                  ? e.label.x - tw / 2
                  : e.label.x - 4;
            return (
              <g key={e.id} style={{ opacity, transition: fade, pointerEvents: "none" }} aria-hidden="true">
                <polyline
                  points={e.points.map((p) => p.join(",")).join(" ")}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={on ? 1.75 : 1.25}
                  strokeDasharray={s === "active" ? undefined : "5 4"}
                  markerEnd={marker(s)}
                />
                <rect x={lx} y={e.label.y - 13} width={tw} height={18} rx={4} fill={C.white} />
                <text
                  x={e.label.x}
                  y={e.label.y}
                  textAnchor={e.label.anchor}
                  fontSize={12}
                  fill={s === "fallback" ? C.warning : C.muted}
                >
                  {text}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

        <div aria-live="polite" className="min-h-[312px] flex-[1_1_260px] rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-base font-semibold text-indigo-950">{selText.title}</span>
          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-600">{selText.typeLabel}</span>
          {sel.optional && !cfg[sel.optional] && (
            <span className="rounded border border-dashed border-slate-200 px-1.5 py-0.5 text-xs text-slate-500">未設定</span>
          )}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-indigo-950">{selText.desc}</p>
        <div className="mt-3 space-y-1.5">
          {selEdges.map((e) => {
            const s = edgeState(e, cfg);
            const other = textOf(nodeById(e.from === selected ? e.to : e.from), tier);
            const outgoing = e.from === selected;
            return (
              <div key={e.id} className="flex items-start gap-2 text-sm">
                <span
                  className={
                    "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium " +
                    (s === "fallback"
                      ? "bg-yellow-50 text-yellow-700"
                      : s === "off"
                        ? "bg-slate-50 text-slate-500"
                        : "bg-indigo-50 text-indigo-600")
                  }
                >
                  {outgoing ? `→ ${other.title}` : `← ${other.title}`}
                </span>
                <span className={s === "off" ? "text-slate-500 line-through" : "text-indigo-950"}>{fullOf(e, tier)}</span>
                {s === "fallback" && <span className="shrink-0 text-xs text-yellow-700">替代路徑</span>}
              </div>
            );
          })}
        </div>
      </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3 w-4 rounded border border-indigo-200 bg-indigo-50" />人
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3 w-4 rounded border border-indigo-500 bg-white" />容器
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3 w-4 rounded-sm border border-indigo-500 bg-white" />
          資料儲存
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Lock size={12} aria-hidden="true" className="text-indigo-600" />
          測試集答案邊界
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3 w-4 rounded border border-dashed border-slate-500 bg-slate-50" />
          外部系統（可選）
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="w-5 border-t border-dashed border-yellow-700" />
          未設定 Resend 時的替代路徑
        </span>
      </div>
    </div>
  );
}
