import { useState, type KeyboardEvent, type ReactElement } from "react";
import { BARS, HORIZONS, LANES, MARKERS, epicById, type Bar, type LaneId } from "./roadmap-data";

/**
 * 泳道時程：交付、里程碑、產品模組、基礎建設、UX 五條泳道，
 * 橫軸是兩個時段（下個月／接下來兩個月）。
 * 點任一條 bar，下方面板顯示它所屬 Epic 的一句話。
 */

const INK = "#1E1B4B"; // --color-ink
const LINE = "#E2E8F0"; // --color-border
const LANE_BG = "#F8FAFC"; // --color-slate-50
const HEAD_BG = "#EEF2FF"; // --color-primary-soft-bg
const HEAD_TEXT = "#4F46E5"; // --color-primary-strong
const FONT = "'Inter','Noto Sans TC','PingFang TC',-apple-system,sans-serif"; // --font-sans

/** Lane colours follow the label-suite-design order for telling groups apart. */
const LANE_COLOR: Record<LaneId, string> = {
  release: "#6366F1", // --color-primary
  milestone: "#047857", // --color-cta
  product: "#1D4ED8", // --color-info
  infra: "#8B5CF6", // --color-file-markdown
  ux: "#818CF8", // --color-secondary
};

const W = 640;
const LABEL_W = 84;
const HEAD_H = 34;
const ROW_H = 26;
const LANE_PAD = 6;
const LANE_GAP = 6;
const END = HORIZONS[HORIZONS.length - 1].span[1];
const UNIT = (W - LABEL_W - 8) / END;
const x = (t: number): number => LABEL_W + t * UNIT;

/** Rough label width: CJK glyphs ~12px, others ~6.6px at font-size 12. */
const textW = (s: string): number => [...s].reduce((w, c) => w + (/[　-鿿＀-￯]/.test(c) ? 12 : 6.6), 0);

interface Placed extends Bar {
  row: number;
  inside: boolean;
  /** Label drawn left of the bar because it would overflow the right edge. */
  left: boolean;
}

/** True when a label starting at px would run past the right edge. */
const overflows = (px: number, label: string): boolean => px + textW(label) > W - 2;

/** Greedy row packing that reserves room for labels drawn outside short bars. */
function pack(bars: Bar[]): { placed: Placed[]; rows: number } {
  const ends: number[] = [];
  const placed = [...bars]
    .sort((a, b) => a.start - b.start)
    .map((b) => {
      const inside = (b.end - b.start) * UNIT >= textW(b.label) + 12;
      const left = !inside && overflows(x(b.end) + 6, b.label);
      const labelSpan = (textW(b.label) + 10) / UNIT;
      const effStart = left ? b.start - labelSpan : b.start;
      const effEnd = inside || left ? b.end : b.end + labelSpan;
      let row = ends.findIndex((e) => e <= effStart + 0.001);
      if (row === -1) row = ends.length;
      ends[row] = effEnd + 0.04;
      return { ...b, row, inside, left };
    });
  return { placed, rows: Math.max(ends.length, 1) };
}

const diamond = (cx: number, cy: number, r: number): string => `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;
const star = (cx: number, cy: number, r: number): string =>
  Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    return `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
  }).join(" ");

export default function RoadmapSwimlane(): ReactElement {
  const [sel, setSel] = useState<Bar | null>(null);

  let y = HEAD_H + 8;
  const lanes = LANES.map((l) => {
    const markerLane = l.id === "release" || l.id === "milestone";
    const p = pack(BARS.filter((b) => b.lane === l.id));
    const rows = markerLane ? 1 + Math.max(0, ...MARKERS.filter((m) => m.lane === l.id).map((m) => m.row)) : p.rows;
    const h = rows * ROW_H + LANE_PAD * 2;
    const top = y;
    y += h + LANE_GAP;
    return { ...l, top, h, placed: p.placed, markerLane };
  });
  const H = y + 4;

  const epic = sel?.epic ? epicById(sel.epic) : undefined;
  const onKey = (b: Bar) => (e: KeyboardEvent<SVGGElement>): void => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSel(b);
    }
  };

  return (
    <div className="not-prose space-y-3">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ minWidth: 600, fontFamily: FONT }}
          role="img"
          aria-label="泳道時程：橫軸分下個月、接下來兩個月兩段；五條泳道依序是交付、里程碑、產品模組、基礎建設、UX 與設計。"
        >
          {HORIZONS.map((h) => (
            <g key={h.id}>
              <rect x={x(h.span[0]) + 1} y={0} width={(h.span[1] - h.span[0]) * UNIT - 2} height={HEAD_H} rx={6} fill={HEAD_BG} />
              <text x={(x(h.span[0]) + x(h.span[1])) / 2} y={HEAD_H / 2 + 5} textAnchor="middle" fontSize={14} fontWeight={600} fill={HEAD_TEXT}>
                {h.label}
              </text>
              {h.span[0] > 0 && <line x1={x(h.span[0])} x2={x(h.span[0])} y1={HEAD_H} y2={H} stroke={LINE} strokeDasharray="4 4" />}
            </g>
          ))}

          {lanes.map((l) => {
            const c = LANE_COLOR[l.id];
            return (
              <g key={l.id}>
                <rect x={LABEL_W} y={l.top} width={W - LABEL_W} height={l.h} fill={LANE_BG} />
                <rect x={0} y={l.top} width={LABEL_W - 8} height={l.h} rx={6} fill={c} />
                <text x={(LABEL_W - 8) / 2} y={l.top + l.h / 2 + 4} textAnchor="middle" fontSize={12} fontWeight={600} fill="#FFFFFF">
                  {l.label}
                </text>

                {l.markerLane &&
                  MARKERS.filter((m) => m.lane === l.id).map((m) => {
                    const cy = l.top + LANE_PAD + m.row * ROW_H + ROW_H / 2;
                    const cx = x(m.at);
                    const flip = overflows(cx + 12, m.label);
                    return (
                      <g key={m.label}>
                        <polygon points={l.id === "release" ? diamond(cx, cy, 7) : star(cx, cy, 8)} fill={c} />
                        <text x={flip ? cx - 12 : cx + 12} y={cy + 4} textAnchor={flip ? "end" : "start"} fontSize={12} fill={INK}>
                          {m.label}
                        </text>
                      </g>
                    );
                  })}

                {l.placed.map((b) => {
                  const by = l.top + LANE_PAD + b.row * ROW_H + 3;
                  const bw = (b.end - b.start) * UNIT;
                  const active = sel?.label === b.label;
                  return (
                    <g
                      key={b.label}
                      role="button"
                      tabIndex={0}
                      aria-label={`${b.label}${b.epic ? `（${b.epic}）` : ""}`}
                      aria-pressed={active}
                      onClick={() => setSel(b)}
                      onKeyDown={onKey(b)}
                      style={{ cursor: "pointer", outline: "none" }}
                    >
                      <rect x={x(b.start)} y={by} width={bw} height={ROW_H - 6} rx={4} fill={c} fillOpacity={active ? 0.9 : 0.14} stroke={c} strokeWidth={active ? 2 : 1} />
                      <text
                        x={b.inside ? x(b.start) + bw / 2 : b.left ? x(b.start) - 6 : x(b.end) + 6}
                        y={by + (ROW_H - 6) / 2 + 4}
                        textAnchor={b.inside ? "middle" : b.left ? "end" : "start"}
                        fontSize={12}
                        fill={active && b.inside ? "#FFFFFF" : INK}
                      >
                        {b.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      <div aria-live="polite" className="min-h-[3.5rem] rounded-lg bg-slate-50 px-3 py-2 text-sm text-indigo-950">
        {sel ? (
          epic ? (
            <>
              <span className="font-mono text-xs text-indigo-600">{epic.id}</span>{" "}
              <span className="font-semibold">{epic.name}</span>
              <span className="text-slate-500">（{sel.label}）</span>：{epic.oneLiner}
            </>
          ) : (
            <span className="font-semibold">{sel.label}</span>
          )
        ) : (
          <span className="text-slate-500">點任一條 bar 看它屬於哪個 Epic、要做什麼。</span>
        )}
      </div>
    </div>
  );
}
