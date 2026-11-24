import { useEffect, useRef, useState, type ReactElement } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, X } from "lucide-react";
import { GOALS, type GoalId } from "./roadmap-data";
import { LAYERS, PENDING, STAGES, type Stage } from "./user-journey-data";

/**
 * 使用者旅程圖：專案負責人用現有工具走完一次標記的七個階段（提案）。
 * 階段橫向排開；情緒曲線在訪談前畫成虛線佔位；洞見列標出預計對應的 PRD 目標；
 * 點一個階段展開它的五層內容。所有內容讀 user-journey-data.ts，不在元件內另寫一份。
 */

// SVG colours: SVG attributes cannot read Tailwind classes, so each one names its token.
const PRIMARY = "#6366F1"; // --color-primary
const PRIMARY_STRONG = "#4F46E5"; // --color-primary-strong
const PRIMARY_BORDER = "#C7D2FE"; // --color-primary-border
const MUTED = "#64748B"; // --color-ink-muted
const BORDER = "#E2E8F0"; // --color-border
const WHITE = "#FFFFFF"; // --color-white

const CURVE_H = 120;
const PAD_Y = 22;
const SCORE_MAX = 2;

const goalShort = (id: GoalId): string => GOALS.find((g) => g.id === id)?.short ?? id;

function useMeasuredWidth(min: number) {
  const ref = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(min);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(min, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [min]);
  return { ref, width };
}

/** Emotion row: a solid line where both ends have a score, a dashed placeholder elsewhere. */
function EmotionCurve({ stages, active }: { stages: Stage[]; active: number | null }): ReactElement {
  const { ref, width } = useMeasuredWidth(560);
  const x = (i: number): number => ((i + 0.5) / stages.length) * width;
  const y = (score: number | null): number => {
    const s = score ?? 0;
    return PAD_Y + ((SCORE_MAX - s) / (2 * SCORE_MAX)) * (CURVE_H - 2 * PAD_Y);
  };
  const pending = stages.every((s) => s.emotion === null);

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${width} ${CURVE_H}`}
      width="100%"
      height={CURVE_H}
      role="img"
      aria-label={
        pending
          ? "情緒曲線尚未訪談：七個階段都以空心圓點標在中線上，彼此以虛線相連，表示佔位。"
          : "情緒曲線：各階段的情緒分數，虛線段表示還沒有分數的階段。"
      }
      className="block"
    >
      <rect x="0.5" y="0.5" width={width - 1} height={CURVE_H - 1} fill={WHITE} stroke={BORDER} />
      {/* -2 / 0 / +2 guides */}
      {[SCORE_MAX, 0, -SCORE_MAX].map((s) => (
        <g key={s}>
          <line x1={0} x2={width} y1={y(s)} y2={y(s)} stroke={BORDER} strokeWidth={1} />
          <text x={6} y={y(s) - 4} fontSize={11} fill={MUTED} fontFamily="Inter, 'Noto Sans TC', sans-serif">
            {s > 0 ? `+${s}` : s}
          </text>
        </g>
      ))}
      {stages.slice(0, -1).map((s, i) => {
        const next = stages[i + 1];
        const solid = s.emotion !== null && next.emotion !== null;
        return (
          <line
            key={s.id}
            x1={x(i)}
            y1={y(s.emotion)}
            x2={x(i + 1)}
            y2={y(next.emotion)}
            stroke={solid ? PRIMARY : PRIMARY_BORDER}
            strokeWidth={solid ? 2 : 1.5}
            strokeDasharray={solid ? undefined : "6 5"}
          />
        );
      })}
      {stages.map((s, i) => {
        const on = active === i;
        return (
          <circle
            key={s.id}
            cx={x(i)}
            cy={y(s.emotion)}
            r={on ? 6 : 5}
            fill={s.emotion === null ? WHITE : on ? PRIMARY_STRONG : PRIMARY}
            stroke={s.emotion === null ? (on ? PRIMARY_STRONG : PRIMARY_BORDER) : WHITE}
            strokeWidth={s.emotion === null ? (on ? 2 : 1.5) : 1.5}
          />
        );
      })}
      {pending && (
        <text
          x={width / 2}
          y={CURVE_H - 6}
          textAnchor="middle"
          fontSize={12}
          fill={MUTED}
          fontFamily="Inter, 'Noto Sans TC', sans-serif"
        >
          情緒曲線{PENDING}：虛線是佔位
        </text>
      )}
    </svg>
  );
}

function PendingText({ text }: { text: string }): ReactElement {
  return text === PENDING ? (
    <span className="inline-block rounded border border-dashed border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-500">
      {text}
    </span>
  ) : (
    <span className="text-sm text-indigo-950">{text}</span>
  );
}

export default function UserJourneyMap(): ReactElement {
  const reduce = useReducedMotion();
  const [active, setActive] = useState<number | null>(0);
  const t = { duration: reduce ? 0 : 0.2, ease: [0.4, 0, 0.2, 1] as const };
  const cols = { gridTemplateColumns: `5.5rem repeat(${STAGES.length}, minmax(0, 1fr))` };
  const stage = active === null ? null : STAGES[active];

  return (
    <div className="not-prose w-full space-y-3 text-indigo-950">
      <div className="overflow-x-auto">
        <div className="min-w-[46rem] space-y-2">
          {/* Stages */}
          <div className="grid gap-1.5" style={cols}>
            <div className="self-center text-xs font-semibold text-slate-500">階段（提案）</div>
            <div role="group" aria-label="旅程階段" className="contents">
              {STAGES.map((s, i) => {
                const on = active === i;
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-expanded={on}
                    aria-controls="user-journey-layers"
                    onClick={() => setActive(on ? null : i)}
                    className={
                      "flex min-h-[5.5rem] flex-col items-start rounded-lg border px-2 py-2 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 " +
                      (on
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-indigo-200 bg-indigo-50 text-indigo-950 hover:border-indigo-500")
                    }
                  >
                    <span className={"font-mono text-xs " + (on ? "text-indigo-100" : "text-indigo-600")}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="mt-0.5 text-sm font-semibold leading-snug">{s.name}</span>
                    <span className={"mt-1 text-xs leading-snug " + (on ? "text-indigo-100" : "text-slate-500")}>
                      {s.scope}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Emotion curve */}
          <div className="grid gap-1.5" style={cols}>
            <div className="self-center text-xs font-semibold text-slate-500">情緒</div>
            <div style={{ gridColumn: `2 / span ${STAGES.length}` }}>
              <EmotionCurve stages={STAGES} active={active} />
            </div>
          </div>

          {/* Insights, mapped to PRD goals */}
          <div className="grid gap-1.5" style={cols}>
            <div className="self-start pt-1 text-xs font-semibold text-slate-500">
              洞見
              <span className="block font-normal">對應 PRD 目標</span>
            </div>
            {STAGES.map((s, i) => (
              <div
                key={s.id}
                className={
                  "space-y-1.5 rounded-lg border px-2 py-2 " +
                  (active === i ? "border-indigo-500" : "border-slate-200")
                }
              >
                <PendingText text={s.insight} />
                <div className="flex flex-wrap gap-1">
                  {s.goals.map((g) => (
                    <span
                      key={g}
                      title={goalShort(g)}
                      className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-xs text-indigo-600"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Five layers of the selected stage */}
      <div id="user-journey-layers" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {stage ? (
            <motion.section
              key={stage.id}
              aria-label={`${stage.name}的五層內容`}
              initial={{ opacity: 0, y: reduce ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={t}
              className="rounded-lg border border-slate-200"
            >
              <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2">
                <div>
                  <span className="font-mono text-xs text-indigo-600">
                    {String((active ?? 0) + 1).padStart(2, "0")}
                  </span>
                  <span className="ml-2 text-sm font-semibold">{stage.name}</span>
                  <span className="ml-2 text-xs text-slate-500">{stage.scope}</span>
                </div>
                <button
                  type="button"
                  aria-label="收起五層內容"
                  onClick={() => setActive(null)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
                >
                  <X size={16} />
                </button>
              </header>
              <div className="divide-y divide-slate-100">
                {LAYERS.map((l) => (
                  <div key={l.id} className="grid grid-cols-[7rem_1fr] items-center gap-3 px-3 py-2">
                    <span className="text-xs font-semibold text-slate-500">{l.label}</span>
                    <PendingText text={stage.layers[l.id]} />
                  </div>
                ))}
                <div className="grid grid-cols-[7rem_1fr] items-center gap-3 bg-slate-50 px-3 py-2">
                  <span className="text-xs font-semibold text-slate-500">洞見</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <PendingText text={stage.insight} />
                    {stage.goals.map((g) => (
                      <span key={g} className="text-xs text-indigo-950">
                        <span className="font-mono text-indigo-600">{g}</span> {goalShort(g)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.section>
          ) : (
            <motion.p
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={t}
              className="flex items-center gap-1.5 text-sm text-slate-500"
            >
              <ChevronDown size={16} aria-hidden="true" />
              點一個階段，展開它的行為、接觸點、受訪者原話、情緒、亮點與痛點
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
