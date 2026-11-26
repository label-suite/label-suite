import { useState, type ReactElement } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, CircleHelp } from "lucide-react";
import { EPICS } from "./roadmap-data";
import {
  ACTIVITIES,
  EPIC_PENDING_LABEL,
  FILTERS,
  ROLES,
  STORIES,
  epicOf,
  matchesFilter,
  specByCode,
  type FilterId,
  type Story,
} from "./story-map-data";

/**
 * 使用者故事地圖：橫軸是使用者活動，縱軸是路線圖的 Epic；每張卡是一個 story，點下去開它的規格頁。
 * 角色篩選只讓該角色的 story 亮起來。所有內容讀 story-map-data.ts，Epic 名稱讀 roadmap-data.ts。
 */

// Same rule NoteCraft applies to MDX links: docs/specs/<path>.mdx -> /notes/specs/<path>,
// prefixed with the site base when the site is deployed under a sub-path.
const RAW_BASE = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
const BASE = RAW_BASE === "/" ? "" : RAW_BASE.replace(/\/+$/, "");
const specHref = (path: string): string => `${BASE}/notes/specs/${path}`;

const BACKBONE = ACTIVITIES.filter((a) => !a.cross);
const CROSS = ACTIVITIES.find((a) => a.cross);
const PENDING_ROW = "pending";

/** Row key of a story: its Epic id, or the pending row. */
const rowOf = (s: Story): string => epicOf(s)?.id ?? PENDING_ROW;

const roleText = (s: Story): string =>
  s.roles.map((r) => ROLES.find((x) => x.id === r)?.label ?? r).join("、");

function StoryCard({ story, lit, reduce }: { story: Story; lit: boolean; reduce: boolean }): ReactElement {
  const spec = specByCode(story.spec);
  const pending = story.epicPending === true;
  return (
    <motion.a
      href={spec ? specHref(spec.path) : undefined}
      animate={{ opacity: lit ? 1 : 0.28 }}
      transition={{ duration: reduce ? 0 : 0.2, ease: "easeOut" }}
      aria-label={`${story.text}（${roleText(story)}；規格 ${story.spec} ${spec?.label ?? ""}）${lit ? "" : "，不屬於目前篩選的角色"}`}
      className={`group block rounded-lg border px-2.5 py-2 text-left text-xs leading-relaxed no-underline outline-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
        pending
          ? "border-yellow-200 bg-yellow-50 hover:border-yellow-700"
          : "border-indigo-200 bg-white hover:border-indigo-500 hover:bg-indigo-50"
      }`}
    >
      <span className="block text-indigo-950">{story.text}</span>
      <span className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
        <span className="font-mono">{story.spec}</span>
        <span className="truncate">{roleText(story)}</span>
        <ArrowUpRight size={12} className="ml-auto shrink-0 text-slate-500 group-hover:text-indigo-600" aria-hidden="true" />
      </span>
    </motion.a>
  );
}

export default function StoryMap(): ReactElement {
  const [filter, setFilter] = useState<FilterId | null>(null);
  const reduce = useReducedMotion() ?? false;

  const backboneStories = STORIES.filter((s) => s.activity !== CROSS?.id);
  const crossStories = STORIES.filter((s) => s.activity === CROSS?.id);
  const hasPending = backboneStories.some((s) => s.epicPending);
  const rows = [
    ...EPICS.map((e) => ({ key: e.id, label: `${e.id} ${e.name}` })),
    ...(hasPending ? [{ key: PENDING_ROW, label: EPIC_PENDING_LABEL }] : []),
  ];
  const crossGroups = [
    ...EPICS.map((e) => ({ key: e.id, label: `${e.id} ${e.name}` })),
    { key: PENDING_ROW, label: EPIC_PENDING_LABEL },
  ]
    .map((g) => ({ ...g, stories: crossStories.filter((s) => rowOf(s) === g.key) }))
    .filter((g) => g.stories.length > 0);

  const litCount = STORIES.filter((s) => matchesFilter(s, filter)).length;
  const chip =
    "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500";

  return (
    <div className="not-prose space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="角色篩選" className="flex flex-wrap gap-1.5">
          {[{ id: null, label: "全部" }, ...FILTERS].map((f) => {
            const on = filter === f.id;
            return (
              <button
                key={f.label}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(f.id as FilterId | null)}
                className={`${chip} ${
                  on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-indigo-200 hover:text-indigo-950"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <p aria-live="polite" className="ml-auto text-xs text-slate-500">
          亮起 {litCount} / {STORIES.length} 個 story
        </p>
      </div>

      <div className="overflow-x-auto pb-2">
        <div
          className="grid min-w-[1180px] gap-1.5"
          style={{ gridTemplateColumns: `112px repeat(${BACKBONE.length}, minmax(0, 1fr))` }}
        >
          <div className="sticky left-0 z-10 bg-white" aria-hidden="true" />
          {BACKBONE.map((a, i) => (
            <div key={a.id} className="rounded-lg bg-indigo-600 px-2 py-2 text-center text-xs font-semibold text-white">
              <span className="mr-1 font-mono opacity-80">{i + 1}</span>
              {a.name}
            </div>
          ))}

          {rows.map((r) => {
            const inRow = backboneStories.filter((s) => rowOf(s) === r.key);
            return (
              <div key={r.key} className="contents">
                <div
                  className={`sticky left-0 z-10 flex items-start rounded-lg border px-2 py-2 text-xs font-semibold ${
                    r.key === PENDING_ROW ? "border-yellow-200 bg-yellow-50 text-yellow-700" : "border-slate-200 bg-slate-50 text-indigo-950"
                  }`}
                >
                  {r.key === PENDING_ROW && <CircleHelp size={14} className="mr-1 shrink-0" aria-hidden="true" />}
                  {r.label}
                </div>
                {BACKBONE.map((a) => {
                  const cell = inRow.filter((s) => s.activity === a.id);
                  return (
                    <div key={a.id} className="min-h-[44px] space-y-1.5 rounded-lg border border-dashed border-slate-200 p-1.5">
                      {cell.map((s) => (
                        <StoryCard key={s.id} story={s} lit={matchesFilter(s, filter)} reduce={reduce} />
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {CROSS && (
        <section aria-label={`${CROSS.name}，橫跨所有活動`} className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
          <h4 className="mb-2 text-sm font-semibold text-indigo-950">
            {CROSS.name}
            <span className="ml-2 text-xs font-normal text-slate-500">橫跨所有活動</span>
          </h4>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {crossGroups.map((g) => (
              <div key={g.key} className="space-y-1.5">
                <p className={`text-xs font-semibold ${g.key === PENDING_ROW ? "text-yellow-700" : "text-indigo-950"}`}>{g.label}</p>
                {g.stories.map((s) => (
                  <StoryCard key={s.id} story={s} lit={matchesFilter(s, filter)} reduce={reduce} />
                ))}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
