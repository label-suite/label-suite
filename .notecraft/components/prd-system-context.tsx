import { useId, useState } from "react";
import type { ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { Boxes, KeyRound, Mail, Server, ShieldCheck, User } from "lucide-react";

// C4 model level 1 (System Context) for Label Suite.
// Source of truth: docs/specs/00-prd.mdx §系統情境 table; every node and edge below matches a row there.

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
const H = 520;

type Integration = "google" | "resend";
type Kind = "person" | "system" | "external";
type NodeId = "deployer" | "admin" | "member" | "system" | "google" | "resend";

type CtxNode = {
  id: NodeId;
  kind: Kind;
  typeLabel: string;
  title: string;
  short: string;
  desc: string;
  icon: ReactNode;
  x: number;
  y: number;
  w: number;
  h: number;
  optional?: Integration;
};

type CtxEdge = {
  id: string;
  from: NodeId;
  to: NodeId;
  short: string;
  full: string;
  points: [number, number][];
  label: { x: number; y: number; anchor: "start" | "end" };
  requires?: Integration; // drawn as active only when this integration is configured
  fallbackFor?: Integration; // drawn only when this integration is NOT configured
};

// ---------- data: matches §系統情境 row by row ----------
const NODES: CtxNode[] = [
  {
    id: "deployer",
    kind: "person",
    typeLabel: "人",
    title: "部署者",
    short: "部署平台，不是系統角色",
    desc: "部署平台並建立 Seeder 管理員；這期的批次資料匯入由部署者直接匯入，不經過介面。Resend 未設定時，從伺服器 log 取得設定密碼連結轉給使用者。",
    icon: <Server size={18} />,
    x: 24,
    y: 24,
    w: 184,
    h: 88,
  },
  {
    id: "admin",
    kind: "person",
    typeLabel: "人",
    title: "系統管理員",
    short: "含 Seeder 管理員",
    desc: "管理平台帳號、系統角色與角色權限；可以看到所有任務的列表。部署時建立的 Seeder 管理員權限相同，但不能被停用、降級或移除。",
    icon: <ShieldCheck size={18} />,
    x: 228,
    y: 24,
    w: 184,
    h: 88,
  },
  {
    id: "member",
    kind: "person",
    typeLabel: "人",
    title: "平台成員",
    short: "負責人、審核員、標記員",
    desc: "自行註冊或由系統管理員邀請加入；建立自己的任務、參與被指派的任務。在各任務裡另有任務角色：專案負責人、審核員、標記員。",
    icon: <User size={18} />,
    x: 432,
    y: 24,
    w: 184,
    h: 88,
  },
  {
    id: "system",
    kind: "system",
    typeLabel: "要描述的系統",
    title: "Label Suite",
    short: "資料標記與品質評估平台",
    desc: "讓學術 NLP 研究團隊用設定建立標記任務，在同一個平台完成試標、正式標記、審核與資料品質分析。內部的前端、API、背景工作與資料庫屬於 C4 第二層，不在這張圖上。",
    icon: <Boxes size={20} />,
    x: 200,
    y: 210,
    w: 240,
    h: 104,
  },
  {
    id: "google",
    kind: "external",
    typeLabel: "外部系統・可選",
    title: "Google（OIDC）",
    short: "登入頁的 Google SSO",
    desc: "登入頁的 Google SSO 走直接 OIDC 整合（ADR-035）。GOOGLE_CLIENT_ID 沒設定時按鈕退回 no-op，Email 與密碼登入照常可用。",
    icon: <KeyRound size={18} />,
    x: 90,
    y: 420,
    w: 200,
    h: 84,
    optional: "google",
  },
  {
    id: "resend",
    kind: "external",
    typeLabel: "外部系統・可選",
    title: "Resend",
    short: "寄出帳號相關信件",
    desc: "寄出註冊驗證信、忘記密碼信與設定密碼信（ADR-013）。沒有設定 key 時，設定密碼連結改印在伺服器 log，由部署者轉給使用者，畫面要讓管理員知道信沒有寄出去（2026-11-10 裁定）。",
    icon: <Mail size={18} />,
    x: 350,
    y: 420,
    w: 200,
    h: 84,
    optional: "resend",
  },
];

const EDGES: CtxEdge[] = [
  {
    id: "member-system",
    from: "member",
    to: "system",
    short: "建立任務與標記審核",
    full: "註冊與登入；依任務角色建立任務、標記、審核、匯出標記結果",
    points: [
      [524, 112],
      [380, 210],
    ],
    label: { x: 462, y: 176, anchor: "start" },
  },
  {
    id: "admin-system",
    from: "admin",
    to: "system",
    short: "管理帳號與角色權限",
    full: "管理平台帳號、系統角色與角色權限",
    points: [
      [320, 112],
      [320, 210],
    ],
    label: { x: 328, y: 150, anchor: "start" },
  },
  {
    id: "deployer-system",
    from: "deployer",
    to: "system",
    short: "部署與匯入資料",
    full: "部署平台、建立 Seeder 管理員、直接匯入批次資料",
    points: [
      [130, 112],
      [270, 210],
    ],
    label: { x: 212, y: 165, anchor: "start" },
  },
  {
    id: "system-deployer-log",
    from: "system",
    to: "deployer",
    short: "log 裡的設定密碼連結",
    full: "Resend 未設定時，設定密碼連結印在伺服器 log，由部署者轉給使用者",
    points: [
      [230, 210],
      [90, 112],
    ],
    label: { x: 148, y: 165, anchor: "end" },
    fallbackFor: "resend",
  },
  {
    id: "system-google",
    from: "system",
    to: "google",
    short: "OIDC 驗證 Google 登入",
    full: "以 OIDC 驗證使用者的 Google 帳號",
    points: [
      [270, 314],
      [190, 420],
    ],
    label: { x: 216, y: 367, anchor: "end" },
    requires: "google",
  },
  {
    id: "system-resend",
    from: "system",
    to: "resend",
    short: "寄驗證、重設與設定密碼信",
    full: "交寄註冊驗證信、忘記密碼信與設定密碼信",
    points: [
      [370, 314],
      [450, 420],
    ],
    label: { x: 424, y: 367, anchor: "start" },
    requires: "resend",
  },
  {
    id: "resend-member",
    from: "resend",
    to: "member",
    short: "寄到使用者信箱",
    full: "把信送到使用者的信箱",
    points: [
      [550, 462],
      [630, 462],
      [630, 62],
      [616, 62],
    ],
    label: { x: 622, y: 290, anchor: "end" },
    requires: "resend",
  },
];

const DEFAULT_NODE: NodeId = "system";
const INTEGRATIONS: { id: Integration; label: string }[] = [
  { id: "google", label: "Google OIDC" },
  { id: "resend", label: "Resend" },
];
// ---------- end data ----------

type EdgeState = "active" | "off" | "hidden" | "fallback";

function edgeState(e: CtxEdge, cfg: Record<Integration, boolean>): EdgeState {
  if (e.fallbackFor) return cfg[e.fallbackFor] ? "hidden" : "fallback";
  if (e.requires && !cfg[e.requires]) return "off";
  return "active";
}

// Rough text width for label backgrounds: CJK glyphs ~12px, ASCII ~7px at 12px font size.
function textWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += /[\u0000-ÿ]/.test(ch) ? 7 : 12;
  return w;
}

const nodeById = (id: NodeId): CtxNode => NODES.find((n) => n.id === id) as CtxNode;

export default function PrdSystemContext() {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const reduce = useReducedMotion();
  const [selected, setSelected] = useState<NodeId>(DEFAULT_NODE);
  const [cfg, setCfg] = useState<Record<Integration, boolean>>({ google: true, resend: true });

  const fade = reduce ? undefined : "opacity 200ms cubic-bezier(0.4, 0, 0.2, 1)";
  const marker = (s: EdgeState) => `url(#${uid}-arrow-${s === "fallback" ? "warn" : s === "off" ? "off" : "on"})`;
  const touches = (e: CtxEdge) => e.from === selected || e.to === selected;
  const related = new Set<NodeId>([selected]);
  EDGES.forEach((e) => {
    if (touches(e) && edgeState(e, cfg) !== "hidden") {
      related.add(e.from);
      related.add(e.to);
    }
  });

  const sel = nodeById(selected);
  const selEdges = EDGES.filter((e) => touches(e) && edgeState(e, cfg) !== "hidden");

  return (
    <div className="not-prose w-full space-y-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div role="group" aria-label="選擇要看的對象" className="flex flex-wrap gap-1.5">
          {NODES.map((n) => (
            <button
              key={n.id}
              type="button"
              aria-pressed={selected === n.id}
              onClick={() => setSelected(n.id)}
              className={
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 " +
                (selected === n.id
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-indigo-200 bg-white text-indigo-950 hover:bg-indigo-50")
              }
            >
              {n.title}
            </button>
          ))}
        </div>
        <div role="group" aria-label="外部整合是否設定" className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>部署設定</span>
          {INTEGRATIONS.map((it) => (
            <button
              key={it.id}
              type="button"
              aria-pressed={cfg[it.id]}
              onClick={() => setCfg((c) => ({ ...c, [it.id]: !c[it.id] }))}
              className={
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 " +
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

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label="Label Suite 的系統情境圖：上方是平台成員、系統管理員與部署者三種人，都直接使用 Label Suite；下方是兩個可選的外部系統，Label Suite 以 OIDC 向 Google 驗證登入，並透過 Resend 寄信到使用者信箱。Resend 未設定時，設定密碼連結改印在伺服器 log 由部署者轉交。"
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

          {EDGES.map((e) => {
            const s = edgeState(e, cfg);
            const on = touches(e);
            const opacity = s === "hidden" ? 0 : on ? 1 : 0.22;
            const stroke = s === "fallback" ? C.warning : s === "off" ? C.off : C.primary;
            // "off" is already carried by the grey dashed line and the node's 未設定 tag; a suffix would overrun the right rail
            const text = e.short;
            const tw = textWidth(text) + 8;
            const lx = e.label.anchor === "end" ? e.label.x - tw + 4 : e.label.x - 4;
            return (
              <g key={e.id} style={{ opacity, transition: fade }} aria-hidden="true">
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

          {NODES.map((n) => {
            const isSel = n.id === selected;
            const disabled = n.optional ? !cfg[n.optional] : false;
            const fill = n.kind === "system" ? C.primaryStrong : n.kind === "person" ? C.primarySoft : C.slate50;
            const stroke = isSel
              ? C.primary
              : n.kind === "system"
                ? C.primaryStrong
                : n.kind === "person"
                  ? C.primaryBorder
                  : disabled
                    ? C.off
                    : C.muted;
            const ink = n.kind === "system" ? C.white : disabled ? C.muted : C.ink;
            const sub = n.kind === "system" ? C.primarySoft : C.muted;
            const center = n.kind === "system";
            const tx = center ? n.x + n.w / 2 : n.x + 16;
            const anchor = center ? "middle" : "start";
            return (
              <g
                key={n.id}
                onClick={() => setSelected(n.id)}
                style={{ cursor: "pointer", opacity: related.has(n.id) ? 1 : 0.5, transition: fade }}
                aria-hidden="true"
              >
                <rect
                  x={n.x}
                  y={n.y}
                  width={n.w}
                  height={n.h}
                  rx={12}
                  fill={disabled ? C.white : fill}
                  stroke={stroke}
                  strokeWidth={isSel ? 2 : 1}
                  strokeDasharray={n.kind === "external" ? "6 4" : undefined}
                />
                {center ? (
                  <>
                    <g color={C.primarySoft}>
                      <svg x={n.x + n.w / 2 - 10} y={n.y + 12} width={20} height={20} overflow="visible">
                        {n.icon}
                      </svg>
                    </g>
                    <text x={tx} y={n.y + 48} textAnchor={anchor} fontSize={12} fill={sub}>
                      {n.typeLabel}
                    </text>
                    <text x={tx} y={n.y + 71} textAnchor={anchor} fontSize={18} fontWeight={600} fill={ink}>
                      {n.title}
                    </text>
                    <text x={tx} y={n.y + 92} textAnchor={anchor} fontSize={12} fill={sub}>
                      {n.short}
                    </text>
                  </>
                ) : (
                  <>
                    <g color={disabled ? C.muted : n.kind === "person" ? C.primaryStrong : C.muted}>
                      <svg x={n.x + 14} y={n.y + 14} width={18} height={18} overflow="visible">
                        {n.icon}
                      </svg>
                    </g>
                    <text x={n.x + 40} y={n.y + 28} fontSize={12} fill={C.muted}>
                      {n.typeLabel}
                    </text>
                    {disabled && (
                      <text x={n.x + n.w - 14} y={n.y + 28} textAnchor="end" fontSize={12} fontWeight={600} fill={C.muted}>
                        未設定
                      </text>
                    )}
                    <text x={tx} y={n.y + 54} fontSize={15} fontWeight={600} fill={ink}>
                      {n.title}
                    </text>
                    <text x={tx} y={n.y + 75} fontSize={12} fill={C.muted}>
                      {n.short}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div aria-live="polite" className="min-h-[188px] rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-base font-semibold text-indigo-950">{sel.title}</span>
          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-600">{sel.typeLabel}</span>
          {sel.optional && !cfg[sel.optional] && (
            <span className="rounded border border-dashed border-slate-200 px-1.5 py-0.5 text-xs text-slate-500">未設定</span>
          )}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-indigo-950">{sel.desc}</p>
        <div className="mt-3 space-y-1.5">
          {selEdges.map((e) => {
            const s = edgeState(e, cfg);
            const other = nodeById(e.from === selected ? e.to : e.from);
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
                <span className={s === "off" ? "text-slate-500 line-through" : "text-indigo-950"}>{e.full}</span>
                {s === "fallback" && <span className="shrink-0 text-xs text-yellow-700">替代路徑</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3 w-4 rounded border border-indigo-200 bg-indigo-50" />人
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3 w-4 rounded bg-indigo-600" />要描述的系統
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
