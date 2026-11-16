import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowDown, ChevronLeft, ChevronRight, Database, Folder, Globe, Languages, ShieldCheck } from "lucide-react";

// Backend request flow for Label Suite.
// Source of truth: docs/development/architecture.mdx §後端分層 (the layer table) and §認證與授權.
// The marker prompt repeats all eight steps in order, because agents read the raw .mdx, not this render.

type Zone = "gate" | "module" | "store" | "out";

type Step = {
  id: string;
  name: string;
  zone: Zone;
  where: string; // where the code lives
  does: string;
  doesNot?: string;
  cite: string;
};

const STEPS: Step[] = [
  {
    id: "cors",
    name: "CORS",
    zone: "gate",
    where: "app 層 middleware",
    does: "來源逐一列出。",
    doesNot: "不用 allow_origins=[\"*\"]。",
    cite: "Hard Rule 7",
  },
  {
    id: "authn",
    name: "認證 dependency",
    zone: "gate",
    where: "app 層 dependency",
    does: "驗 httpOnly cookie 裡的 access JWT，取 sub、sid、credential_version。",
    doesNot: "不從 Authorization header、查詢字串或自訂 header 推定身分；JWT 裡的 role 只供顯示。",
    cite: "ADR-021",
  },
  {
    id: "authz",
    name: "授權 dependency",
    zone: "gate",
    where: "app 層 dependency",
    does: "權限矩陣四步判定：驗身分與 token family → 讀系統角色與任務成員身分 → permission key 的 cell 為 allowed → 附加條件（任務歸屬、指派、測試集答案隔離）。",
    doesNot: "cell 為 true 也蓋不過附加條件；被隱藏的任務不洩漏它存在。",
    cite: "ADR-037",
  },
  {
    id: "schema",
    name: "pydantic 驗證",
    zone: "module",
    where: "app/modules/<module>/schemas",
    does: "驗證 request schema，不合格的輸入不會進到 Router。",
    cite: "Hard Rule 9",
  },
  {
    id: "router",
    name: "Router",
    zone: "module",
    where: "app/modules/<module>/router",
    does: "HTTP 轉接、取得呼叫者、套用欄位遮蔽、把 model 轉成 response schema。",
    doesNot: "不碰 Repository、不寫商業邏輯。",
    cite: "ADR-003",
  },
  {
    id: "service",
    name: "Service",
    zone: "module",
    where: "app/modules/<module>/service",
    does: "商業邏輯、任務狀態機、權限以外的業務卡控、寫 audit_events。",
    doesNot: "不組 HTTP 回應、不自己讀 Accept-Language。",
    cite: "ADR-022、032",
  },
  {
    id: "repo",
    name: "Repository",
    zone: "module",
    where: "app/modules/<module>/repository",
    does: "透過 SQLAlchemy model 讀寫資料；schema 只由 Alembic migration 管。",
    doesNot: "不寫原生 SQL（migration DDL 例外）。",
    cite: "ADR-005",
  },
  {
    id: "db",
    name: "PostgreSQL／SQLite",
    zone: "store",
    where: "設了 DATABASE_URL 走 PostgreSQL，沒設走 SQLite",
    does: "業務資料與獨立、受存取控制的測試集答案表。",
    cite: "ADR-024",
  },
  {
    id: "resp",
    name: "回應",
    zone: "out",
    where: "app/i18n/<lang>/",
    does: "成功回應包 envelope；使用者看得到的訊息依 Accept-Language 取字。",
    cite: "ADR-026",
  },
];

const ZONE_LABEL: Record<Zone, string> = {
  gate: "進入模組之前：全站共用",
  module: "一個模組一個資料夾",
  store: "資料庫",
  out: "回到瀏覽器",
};

function Icon({ zone }: { zone: Zone }) {
  const p = { size: 14, "aria-hidden": true } as const;
  if (zone === "gate") return <ShieldCheck {...p} />;
  if (zone === "module") return <Folder {...p} />;
  if (zone === "store") return <Database {...p} />;
  return <Languages {...p} />;
}

export default function ArchitectureBackendLayers() {
  const reduce = useReducedMotion();
  const [at, setAt] = useState(0);
  const cur = STEPS[at];
  const go = (i: number) => setAt(Math.max(0, Math.min(STEPS.length - 1, i)));

  const card = (s: Step, i: number) => {
    const state = i < at ? "passed" : i === at ? "current" : "ahead";
    return (
      <div key={s.id}>
        <button
          type="button"
          aria-current={state === "current" ? "step" : undefined}
          onClick={() => go(i)}
          className={
            "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 " +
            (state === "current"
              ? "border-indigo-600 bg-indigo-600 text-white"
              : state === "passed"
                ? "border-indigo-200 bg-indigo-50 text-indigo-950 hover:bg-indigo-100"
                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50")
          }
        >
          <span
            className={
              "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold " +
              (state === "current" ? "bg-white text-indigo-600" : "bg-white text-slate-500 ring-1 ring-slate-200")
            }
          >
            {i + 1}
          </span>
          <span className="font-medium">{s.name}</span>
        </button>
      </div>
    );
  };

  const connector = (k: string) => (
    <div key={k} aria-hidden="true" className="flex justify-center py-0.5 text-slate-300">
      <ArrowDown size={14} />
    </div>
  );

  const zones: Zone[] = ["gate", "module", "store", "out"];

  return (
    <div className="not-prose w-full space-y-3">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-[1_1_280px]" role="group" aria-label="一個請求依序穿過的九站">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-500">
            <Globe size={12} aria-hidden="true" />
            HTTP 請求
          </div>
          {zones.map((z, zi) => {
            const items = STEPS.map((s, i) => ({ s, i })).filter((x) => x.s.zone === z);
            const boxed = z === "gate" || z === "module";
            return (
              <div key={z}>
                {zi > 0 && connector(`c-${z}`)}
                <div
                  className={
                    boxed
                      ? "rounded-xl border border-dashed px-2 pb-2 pt-1.5 " +
                        (z === "module" ? "border-indigo-200 bg-indigo-50/40" : "border-slate-200 bg-slate-50")
                      : ""
                  }
                >
                  {boxed && (
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                      <Icon zone={z} />
                      {z === "module" ? <code className="text-indigo-600">app/modules/&lt;module&gt;/</code> : ZONE_LABEL[z]}
                    </div>
                  )}
                  {items.map(({ s, i }, k) => (
                    <div key={s.id}>
                      {k > 0 && connector(`c-${s.id}`)}
                      {card(s, i)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-3">
          <motion.div
            key={cur.id}
            aria-live="polite"
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="min-h-[264px] rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-base font-semibold text-indigo-950">
                {at + 1}. {cur.name}
              </span>
              <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-600">
                {ZONE_LABEL[cur.zone]}
              </span>
            </div>
            <p className={"mt-1 text-xs text-slate-500 " + (cur.where.startsWith("app/") ? "font-mono" : "")}>{cur.where}</p>
            <p className="mt-3 text-sm leading-relaxed text-indigo-950">{cur.does}</p>
            {cur.doesNot && (
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                <span className="font-medium text-yellow-700">不做：</span>
                {cur.doesNot}
              </p>
            )}
            <p className="mt-3 text-xs text-slate-500">依據：{cur.cite}</p>
          </motion.div>

          <div role="group" aria-label="逐站走請求" className="flex items-center gap-2">
            <button
              type="button"
              aria-label="上一站"
              disabled={at === 0}
              onClick={() => go(at - 1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="下一站"
              disabled={at === STEPS.length - 1}
              onClick={() => go(at + 1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
            <span className="text-xs text-slate-500">
              第 {at + 1}／{STEPS.length} 站
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
