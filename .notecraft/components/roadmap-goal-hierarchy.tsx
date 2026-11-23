import { useState, type ReactElement } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { EPICS, GOALS, HORIZONS, type Epic, type GoalId, type HorizonId } from "./roadmap-data";

/**
 * 三層目標階層：越近拆得越細。
 * 下個月拆到 Feature 與 Sub-feature；接下來兩個月只到 Epic；之後只到 Goal。
 * 點 Goal 會在三欄裡亮起服務同一個目標的 Epic。
 */

const goalShort = (id: GoalId): string => GOALS.find((g) => g.id === id)?.short ?? id;

/** 依主要目標分組；「之後」改列出後期 Epic 服務的所有目標。 */
function groups(h: HorizonId): { goal: GoalId; epics: Epic[] }[] {
  const inH = EPICS.filter((e) => e.horizon === h);
  const ids: GoalId[] = [];
  inH.forEach((e) => (h === "later" ? e.goals : [e.goals[0]]).forEach((g) => !ids.includes(g) && ids.push(g)));
  ids.sort();
  return ids.map((goal) => ({
    goal,
    epics: inH.filter((e) => (h === "later" ? e.goals.includes(goal) : e.goals[0] === goal)),
  }));
}

export default function RoadmapGoalHierarchy(): ReactElement {
  const reduce = useReducedMotion();
  const [focus, setFocus] = useState<GoalId | null>(null);
  const [closed, setClosed] = useState<string[]>([]);
  const toggle = (id: string): void => setClosed((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const dim = (e: Epic): boolean => focus !== null && !e.goals.includes(focus);
  const t = { duration: reduce ? 0 : 0.2, ease: [0.4, 0, 0.2, 1] as const };

  const goalButton = (g: GoalId, big: boolean): ReactElement => (
    <button
      type="button"
      aria-pressed={focus === g}
      onClick={() => setFocus((f) => (f === g ? null : g))}
      className={
        "w-full rounded-lg border px-3 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 " +
        (big ? "py-2.5 " : "py-2 ") +
        (focus === g ? "border-indigo-600 bg-indigo-600 text-white" : "border-indigo-200 bg-indigo-50 text-indigo-950 hover:border-indigo-500")
      }
    >
      <span className={"font-mono text-xs " + (focus === g ? "text-indigo-100" : "text-indigo-600")}>{g}</span>
      <span className="ml-2 text-sm font-semibold">{goalShort(g)}</span>
    </button>
  );

  return (
    <div className="not-prose space-y-3 text-indigo-950">
      <div className="grid gap-6 md:grid-cols-[1.35fr_1fr_0.9fr]">
        {HORIZONS.map((h) => (
          <section key={h.id} aria-label={h.label} className="min-w-0">
            <header className="mb-3 border-b border-slate-200 pb-2">
              <h4 className="text-base font-semibold">{h.label}</h4>
              <p className="text-xs text-slate-500">{h.detail}</p>
            </header>
            <div className="space-y-4">
              {groups(h.id).map(({ goal, epics }) => (
                <div key={goal} className="space-y-2">
                  {goalButton(goal, h.id !== "later")}

                  {h.id === "later" ? (
                    <p className="pl-1 text-xs text-slate-500">
                      {epics.map((e) => `${e.id} ${e.name}`).join("、")}
                    </p>
                  ) : (
                    <ul className="list-none space-y-2 pl-3">
                      {epics.map((e) => {
                        const open = !closed.includes(e.id);
                        const hasFeatures = (e.features?.length ?? 0) > 0;
                        return (
                          <li
                            key={e.id}
                            className="list-none transition-opacity duration-200"
                            style={{ opacity: dim(e) ? 0.3 : 1 }}
                          >
                            <button
                              type="button"
                              disabled={!hasFeatures}
                              aria-expanded={hasFeatures ? open : undefined}
                              onClick={() => toggle(e.id)}
                              className="flex w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-sm enabled:hover:border-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
                            >
                              {hasFeatures &&
                                (open ? (
                                  <ChevronDown size={14} className="shrink-0 text-slate-500" />
                                ) : (
                                  <ChevronRight size={14} className="shrink-0 text-slate-500" />
                                ))}
                              <span className="font-mono text-xs text-indigo-600">{e.id}</span>
                              <span className="font-medium">{e.name}</span>
                            </button>
                            <AnimatePresence initial={false}>
                              {hasFeatures && open && (
                                <motion.ul
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={t}
                                  className="ml-3 list-none overflow-hidden border-l border-indigo-200 pl-3"
                                >
                                  {e.features?.map((f) => (
                                    <li key={f.label} className="list-none pt-1.5">
                                      <span className="block rounded bg-slate-50 px-2 py-1 text-xs">{f.label}</span>
                                      {f.subs && (
                                        <ul className="ml-2 list-none border-l border-slate-200 pl-2">
                                          {f.subs.map((s) => (
                                            <li key={s} className="list-none pt-1 text-xs text-slate-500">
                                              {s}
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </li>
                                  ))}
                                </motion.ul>
                              )}
                            </AnimatePresence>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <p aria-live="polite" className="text-xs text-slate-500">
        {focus
          ? `已亮起服務「${goalShort(focus)}」的 Epic；再點一次取消。`
          : "點 Goal 亮起服務同一個目標的 Epic；點下個月的 Epic 可收合它的 Feature。"}
      </p>
    </div>
  );
}
