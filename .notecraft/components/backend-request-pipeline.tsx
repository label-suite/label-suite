import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, Fingerprint, Pause, Play, RotateCcw } from "lucide-react";

// Request pipeline of the backend on main, stepped per scenario.
// Source of truth: backend/app/main.py (middleware order), app/core/middleware.py,
// app/core/errors.py, app/core/envelope.py, app/modules/health/ and backend/tests/probe.py
// (the 422 and 500 routes exist only in tests). Messages are the zh-TW strings of
// backend/app/i18n/zh-TW/messages.json. Rate limiting and shutdown are not built yet,
// so they are not drawn.

type LayerId = "corr" | "cors" | "unhandled" | "locale" | "exc" | "router" | "service" | "repo" | "db";
type Group = "middleware" | "framework" | "module" | "store";
type Tone = "normal" | "warn" | "error";

type Layer = { id: LayerId; name: string; where: string; group: Group };

const LAYERS: Layer[] = [
  { id: "corr", name: "CorrelationIdMiddleware", where: "app/core/middleware.py", group: "middleware" },
  { id: "cors", name: "CORSMiddleware", where: "Starlette，設定在 app/main.py", group: "middleware" },
  { id: "unhandled", name: "UnhandledExceptionMiddleware", where: "app/core/middleware.py", group: "middleware" },
  { id: "locale", name: "LocaleMiddleware", where: "app/core/middleware.py", group: "middleware" },
  { id: "exc", name: "ExceptionMiddleware", where: "Starlette，handler 在 app/core/errors.py", group: "framework" },
  { id: "router", name: "Router", where: "app/modules/<module>/router.py", group: "module" },
  { id: "service", name: "Service", where: "app/modules/<module>/service.py", group: "module" },
  { id: "repo", name: "Repository", where: "app/modules/<module>/repository.py", group: "module" },
  { id: "db", name: "資料庫", where: "PostgreSQL 或 SQLite", group: "store" },
];

const GROUP_LABEL: Record<Group, string> = {
  middleware: "中介層（由外而內）",
  framework: "框架的 exception handler",
  module: "業務模組",
  store: "資料庫",
};

type Step = { layer: LayerId; dir: "in" | "out"; text: string; produce?: boolean; tone?: Tone };

type Scenario = {
  id: string;
  label: string;
  request: string;
  steps: Step[];
  status: string;
  statusTone: "ok" | "client" | "server";
  body: string;
};

const TRACE = "3f2b8c1e-6a4d-4f0e-9b7a-2c5d1e8f9a01";

const IN_MIDDLEWARE: Step[] = [
  {
    layer: "corr",
    dir: "in",
    text: "請求沒帶 X-Correlation-ID（或格式不合 ^[A-Za-z0-9-]{8,64}$），產生新的 UUID4，寫進 scope state 與 contextvar。之後每一層拿到的都是這個值。",
  },
  { layer: "cors", dir: "in", text: "不是預檢請求，往內傳。" },
  { layer: "unhandled", dir: "in", text: "包住內層；內層沒有丟出例外就不介入。" },
  { layer: "locale", dir: "in", text: "Accept-Language: zh-TW，語系定為 zh-TW，寫進 scope state，外層的 message 會用這個語系取字。" },
  { layer: "exc", dir: "in", text: "包住路由；內層丟出有 handler 的例外時，在這裡轉成錯誤外層。" },
];

const OUT_HEADERS = (unhandledText: string): Step[] => [
  { layer: "locale", dir: "out", text: "回應開始時加上 Content-Language: zh-TW。" },
  { layer: "unhandled", dir: "out", text: unhandledText },
  { layer: "cors", dir: "out", text: "加上 Access-Control-Allow-Origin，瀏覽器讀得到這個回應。" },
  { layer: "corr", dir: "out", text: "加上 X-Correlation-ID，值和外層的 traceId 相同。" },
];

const SCENARIOS: Scenario[] = [
  {
    id: "ok",
    label: "正常",
    request: "GET /api/v1/health，資料庫正常",
    steps: [
      ...IN_MIDDLEWARE,
      { layer: "router", dir: "in", text: "依賴注入：get_db 開一個 session，get_health_service 建好 HealthService，接著呼叫 check()。" },
      { layer: "service", dir: "in", text: "整段查詢包在 5 秒上限裡，呼叫 repository.ping()。" },
      { layer: "repo", dir: "in", text: "對目前的 session 執行 SELECT 1。" },
      { layer: "db", dir: "in", text: "回傳 1。" },
      { layer: "service", dir: "out", text: "回傳 HealthData：status ok、database ok。" },
      {
        layer: "router",
        dir: "out",
        produce: true,
        text: "ok(data, request) 組成功外層：code OK、message「成功」、timestamp 為 UTC 毫秒，traceId 取自 contextvar。",
      },
      { layer: "exc", dir: "out", text: "沒有例外，原樣往外傳。" },
      ...OUT_HEADERS("沒有例外，不介入。"),
    ],
    status: "200",
    statusTone: "ok",
    body: `{
  "success": true,
  "code": "OK",
  "message": "成功",
  "data": { "status": "ok", "database": "ok" },
  "timestamp": "2026-11-20T08:15:30.123Z",
  "traceId": "${TRACE}"
}`,
  },
  {
    id: "422",
    label: "422",
    request: "POST /api/v1/probe（只在測試掛載），body 缺 displayName",
    steps: [
      ...IN_MIDDLEWARE,
      {
        layer: "router",
        dir: "in",
        tone: "warn",
        text: "FastAPI 依 request schema 驗 body：缺 displayName，丟出 RequestValidationError。handler 沒有執行。",
      },
      {
        layer: "exc",
        dir: "out",
        produce: true,
        tone: "warn",
        text: "handle_validation_error 組 422 錯誤外層：code VALIDATION_FAILED，errors 一筆 body／displayName／missing。只留 Pydantic 的 type 與 msg，送進來的值不回顯。",
      },
      ...OUT_HEADERS("回應已經組好，不介入。"),
    ],
    status: "422",
    statusTone: "client",
    body: `{
  "success": false,
  "code": "VALIDATION_FAILED",
  "message": "輸入資料有誤，請檢查標示的欄位",
  "data": null,
  "errors": [
    { "location": "body", "field": "displayName",
      "code": "missing", "message": "Field required" }
  ],
  "timestamp": "2026-11-20T08:15:30.123Z",
  "traceId": "${TRACE}"
}`,
  },
  {
    id: "500",
    label: "500",
    request: "GET /api/v1/probe-crash（只在測試掛載），handler 丟出 RuntimeError",
    steps: [
      ...IN_MIDDLEWARE,
      { layer: "router", dir: "in", tone: "error", text: "handler 丟出 RuntimeError，例外訊息裡有不該外洩的內容。" },
      { layer: "exc", dir: "out", tone: "error", text: "這種例外沒有註冊 handler，繼續往外拋。" },
      { layer: "locale", dir: "out", tone: "error", text: "例外穿過，不處理。" },
      {
        layer: "unhandled",
        dir: "out",
        produce: true,
        tone: "error",
        text: "攔下例外：記一筆 ERROR（traceId、method、path、只有型別與 frame 的 traceback，不含例外訊息），回 500 INTERNAL_ERROR，message 只有通用說明。",
      },
      { layer: "cors", dir: "out", text: "加上 Access-Control-Allow-Origin：500 在 CORS 內側產生，瀏覽器讀得到錯誤外層。" },
      { layer: "corr", dir: "out", text: "加上 X-Correlation-ID，值和外層的 traceId 相同，和 log 那一筆也相同。" },
    ],
    status: "500",
    statusTone: "server",
    body: `{
  "success": false,
  "code": "INTERNAL_ERROR",
  "message": "系統發生錯誤，請稍後再試",
  "data": null,
  "errors": null,
  "timestamp": "2026-11-20T08:15:30.123Z",
  "traceId": "${TRACE}"
}`,
  },
  {
    id: "503",
    label: "health 503",
    request: "GET /api/v1/health，資料庫連不上",
    steps: [
      ...IN_MIDDLEWARE,
      { layer: "router", dir: "in", text: "依賴注入後呼叫 HealthService.check()。" },
      { layer: "service", dir: "in", text: "整段查詢包在 5 秒上限裡，呼叫 repository.ping()。" },
      { layer: "repo", dir: "in", text: "對目前的 session 執行 SELECT 1。" },
      { layer: "db", dir: "in", tone: "error", text: "連線失敗或逾時。" },
      { layer: "repo", dir: "out", tone: "error", text: "例外原樣往上拋，資料層不處理 HTTP。" },
      {
        layer: "service",
        dir: "out",
        tone: "error",
        text: "認得這是連不上：記一筆 WARNING（traceId 與例外型別），丟出 DatabaseUnavailableError，不串接原例外。",
      },
      { layer: "router", dir: "out", tone: "error", text: "例外穿過；get_db 收到同一個例外，rollback 後關閉 session。" },
      {
        layer: "exc",
        dir: "out",
        produce: true,
        tone: "error",
        text: "AppError 的 handler 組 503 錯誤外層：code DATABASE_UNAVAILABLE，不含連線字串或驅動訊息。",
      },
      ...OUT_HEADERS("回應已經組好，不介入。"),
    ],
    status: "503",
    statusTone: "server",
    body: `{
  "success": false,
  "code": "DATABASE_UNAVAILABLE",
  "message": "資料庫暫時無法連線，請稍後再試",
  "data": null,
  "errors": null,
  "timestamp": "2026-11-20T08:15:30.123Z",
  "traceId": "${TRACE}"
}`,
  },
];

const STATUS_CLASS: Record<Scenario["statusTone"], string> = {
  ok: "border-green-200 bg-green-50 text-green-700",
  client: "border-yellow-200 bg-yellow-50 text-yellow-700",
  server: "border-red-200 bg-red-50 text-red-700",
};

const TONE_PANEL: Record<Tone, string> = {
  normal: "border-indigo-200 bg-indigo-50",
  warn: "border-yellow-200 bg-yellow-50",
  error: "border-red-200 bg-red-50",
};

function shortTrace(t: string) {
  return `${t.slice(0, 8)}…${t.slice(-4)}`;
}

export default function BackendRequestPipeline() {
  const reduce = useReducedMotion();
  const [sid, setSid] = useState(0);
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);

  const sc = SCENARIOS[sid];
  const last = sc.steps.length - 1;
  const cur = sc.steps[at];
  const done = at === last;
  const producer = sc.steps.find((s) => s.produce);

  useEffect(() => {
    if (!playing) return;
    if (at >= last) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(() => setAt((i) => Math.min(i + 1, last)), reduce ? 900 : 1400);
    return () => window.clearTimeout(t);
  }, [playing, at, last, reduce]);

  const pick = (i: number) => {
    setSid(i);
    setAt(0);
    setPlaying(false);
  };
  const go = (i: number) => {
    setPlaying(false);
    setAt(Math.max(0, Math.min(last, i)));
  };

  // Which steps touch each layer in this scenario: marks visited rows, and a click jumps to
  // the next step at that layer (wrapping to its first one).
  const stepsAt = (id: LayerId) => sc.steps.map((s, i) => (s.layer === id ? i : -1)).filter((i) => i >= 0);

  const btn =
    "inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500";

  let lastGroup: Group | null = null;

  return (
    <div className="not-prose space-y-4">
      <div role="group" aria-label="情境" className="flex flex-wrap gap-2">
        {SCENARIOS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={i === sid}
            onClick={() => pick(i)}
            className={
              "rounded-full border px-3 py-1 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 " +
              (i === sid
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-slate-200 bg-white text-indigo-950 hover:bg-slate-50")
            }
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-slate-500">
        請求：<code className="font-mono text-indigo-950">{sc.request}</code>
      </p>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-1">
          {LAYERS.map((l) => {
            const touches = stepsAt(l.id);
            const reached = touches.length > 0;
            const isCur = cur.layer === l.id;
            const visited = touches.some((i) => i < at);
            const isProducer = producer?.layer === l.id;
            const showGroup = l.group !== lastGroup;
            lastGroup = l.group;
            const inHere = isCur && cur.dir === "in";
            const outHere = isCur && cur.dir === "out";
            return (
              <div key={l.id}>
                {showGroup && (
                  <div className="pb-1 pt-2 text-xs font-medium text-slate-500">{GROUP_LABEL[l.group]}</div>
                )}
                <button
                  type="button"
                  disabled={!reached}
                  aria-current={isCur ? "step" : undefined}
                  onClick={() => go(touches.find((i) => i > at) ?? touches[0])}
                  className={
                    "relative flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 " +
                    (isCur
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : visited
                        ? "border-indigo-200 bg-indigo-50 text-indigo-950 hover:bg-indigo-100"
                        : reached
                          ? "border-slate-200 bg-white text-indigo-950 hover:bg-slate-50"
                          : "border-dashed border-slate-200 bg-white text-slate-500")
                  }
                >
                  <span className="flex w-4 shrink-0 justify-center" aria-hidden="true">
                    {inHere && (
                      <motion.span
                        initial={reduce ? false : { y: -4, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: reduce ? 0 : 0.25, ease: "easeOut" }}
                      >
                        <ArrowDown size={14} />
                      </motion.span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{l.name}</span>
                    <span className={"block truncate font-mono text-xs " + (isCur ? "text-indigo-100" : "text-slate-500")}>
                      {reached ? l.where : "這個情境不會到這一層"}
                    </span>
                  </span>
                  {isProducer && (
                    <span
                      className={
                        "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium " +
                        (isCur ? "border-white bg-white text-indigo-600" : "border-indigo-200 bg-white text-indigo-600")
                      }
                    >
                      產生回應
                    </span>
                  )}
                  <span className="flex w-4 shrink-0 justify-center" aria-hidden="true">
                    {outHere && (
                      <motion.span
                        initial={reduce ? false : { y: 4, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: reduce ? 0 : 0.25, ease: "easeOut" }}
                      >
                        <ArrowUp size={14} />
                      </motion.span>
                    )}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-slate-500">
              第 {at + 1} 步，共 {sc.steps.length} 步・{cur.dir === "in" ? "去程" : "回程"}
            </span>
            <div role="group" aria-label="逐步控制" className="flex items-center gap-0.5">
              <button type="button" className={btn} aria-label="上一步" disabled={at === 0} onClick={() => go(at - 1)}>
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className={btn}
                aria-label={playing ? "暫停" : "播放"}
                onClick={() => {
                  if (done) setAt(0);
                  setPlaying((p) => !p);
                }}
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <button type="button" className={btn} aria-label="下一步" disabled={done} onClick={() => go(at + 1)}>
                <ChevronRight size={16} />
              </button>
              <button type="button" className={btn} aria-label="重設" onClick={() => go(0)}>
                <RotateCcw size={16} />
              </button>
            </div>
          </div>

          <motion.div
            key={`${sc.id}-${at}`}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduce ? 0 : 0.25, ease: "easeOut" }}
            aria-live="polite"
            className={"min-h-[8.5rem] rounded-lg border p-3 " + TONE_PANEL[cur.tone ?? "normal"]}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-indigo-950">
                {LAYERS.find((l) => l.id === cur.layer)?.name}
              </span>
              {cur.produce && (
                <span className="rounded-full border border-indigo-200 bg-white px-2 py-0.5 text-xs font-medium text-indigo-600">
                  產生回應
                </span>
              )}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-indigo-950">{cur.text}</p>
          </motion.div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-white px-2 py-0.5 font-mono text-indigo-600">
              <Fingerprint size={12} aria-hidden="true" />
              traceId {shortTrace(TRACE)}
            </span>
            <span className="text-slate-500">第一層決定之後，每一步都是同一個值</span>
          </div>

          <div className={"rounded-lg border bg-white p-3 transition-opacity " + (done ? "opacity-100" : "opacity-50")}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500">回應</span>
              <span className={"rounded-full border px-2 py-0.5 font-mono text-xs font-semibold " + STATUS_CLASS[sc.statusTone]}>
                {sc.status}
              </span>
              <span className="text-xs text-slate-500">{done ? "已送出" : "走到最後一步才送出"}</span>
            </div>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-2 font-mono text-xs leading-relaxed text-indigo-950">
              {sc.body}
            </pre>
            <div className="mt-2 space-y-1 font-mono text-xs text-indigo-950">
              <div>X-Correlation-ID: {TRACE}</div>
              <div>Content-Language: zh-TW</div>
            </div>
            <p className={"mt-2 inline-flex items-center gap-1 text-xs font-medium " + (done ? "text-green-700" : "text-slate-500")}>
              <Check size={14} aria-hidden="true" />
              外層的 traceId 與標頭 X-Correlation-ID 相同
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
