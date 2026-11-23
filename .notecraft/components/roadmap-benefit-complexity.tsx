import { useState, type ReactElement } from "react";
import { EPICS, HORIZONS, type Epic, type Level } from "./roadmap-data";

/**
 * 效益與複雜度四象限：只分高低，不打分數。
 * 實際順序依模組依賴，不依象限；點 Epic 看它落在這格的理由與它排在哪個時段。
 */

interface Quadrant {
  benefit: Level;
  complexity: Level;
  title: string;
  hint: string;
}

/** Row-major, top row = high benefit; left column = low complexity. */
const QUADRANTS: Quadrant[] = [
  { benefit: "high", complexity: "low", title: "高效益／低複雜", hint: "划算，條件一到就做" },
  { benefit: "high", complexity: "high", title: "高效益／高複雜", hint: "核心投入，拆小逐步交付" },
  { benefit: "low", complexity: "low", title: "低效益／低複雜", hint: "多半是前置或收尾" },
  { benefit: "low", complexity: "high", title: "低效益／高複雜", hint: "只因其他工作依賴它才做" },
];

const horizonLabel = (e: Epic): string => HORIZONS.find((h) => h.id === e.horizon)?.label ?? "";

export default function RoadmapBenefitComplexity(): ReactElement {
  const [sel, setSel] = useState<Epic | null>(null);

  return (
    <div className="not-prose space-y-3 text-indigo-950">
      <div className="grid grid-cols-[1.5rem_1fr] gap-2">
        <div className="flex items-center justify-center">
          <span className="whitespace-nowrap text-xs text-slate-500 [writing-mode:vertical-rl] rotate-180">效益 低 → 高</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {QUADRANTS.map((q) => {
            const epics = EPICS.filter((e) => e.benefit === q.benefit && e.complexity === q.complexity);
            const core = q.benefit === "high";
            return (
              <section
                key={q.title}
                aria-label={q.title}
                className={"min-h-[8.5rem] rounded-lg border p-3 " + (core ? "border-indigo-200 bg-indigo-50" : "border-slate-200 bg-slate-50")}
              >
                <h4 className="text-sm font-semibold">{q.title}</h4>
                <p className="mb-2 text-xs text-slate-600">{q.hint}</p>
                <div className="flex flex-wrap gap-1.5">
                  {epics.map((e) => {
                    const active = sel?.id === e.id;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSel(active ? null : e)}
                        className={
                          "rounded-md border px-2 py-1 text-xs transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 " +
                          (active ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-indigo-950 hover:border-indigo-500")
                        }
                      >
                        <span className={"font-mono " + (active ? "text-indigo-100" : "text-indigo-600")}>{e.id}</span> {e.name}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
          <p className="col-span-2 text-center text-xs text-slate-500">複雜度 低 → 高</p>
        </div>
      </div>

      <div aria-live="polite" className="min-h-[3.5rem] rounded-lg bg-slate-50 px-3 py-2 text-sm">
        {sel ? (
          <>
            <span className="font-mono text-xs text-indigo-600">{sel.id}</span> <span className="font-semibold">{sel.name}</span>
            <span className="text-slate-600">（排在{horizonLabel(sel)}）</span>：{sel.why}
          </>
        ) : (
          <span className="text-slate-600">點任一個 Epic 看它落在這格的理由。象限只說明投入與回報，實際順序依模組依賴。</span>
        )}
      </div>
    </div>
  );
}
