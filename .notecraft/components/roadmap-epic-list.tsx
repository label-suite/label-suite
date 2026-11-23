import { useState, type ReactElement } from "react";
import { Check, Copy } from "lucide-react";
import { EPICS, GOALS, HORIZONS, type HorizonId } from "./roadmap-data";

/**
 * Epic 一覽：每個 Epic 的一句話、對應目標與時段。
 * 「複製一句話清單」把目前篩選到的 Epic 複製成「E1 帳號：……」一行一個，
 * 可以直接貼進 Epic issue、簡報或週報。
 */

type Filter = HorizonId | "all";

const goalShort = (id: string): string => GOALS.find((g) => g.id === id)?.short ?? id;

export default function RoadmapEpicList(): ReactElement {
  const [filter, setFilter] = useState<Filter>("all");
  const [copied, setCopied] = useState(false);
  const rows = EPICS.filter((e) => filter === "all" || e.horizon === filter);

  const copy = async (): Promise<void> => {
    const text = rows.map((e) => `${e.id} ${e.name}：${e.oneLiner}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: "全部" },
    ...HORIZONS.map((h) => ({ id: h.id, label: h.label })),
  ];

  return (
    <div className="not-prose space-y-3 text-indigo-950">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="依時段篩選" className="flex flex-wrap gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={filter === t.id}
              onClick={() => setFilter(t.id)}
              className={
                "rounded-lg px-3 py-1 text-sm transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 " +
                (filter === t.id ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-indigo-50 hover:text-indigo-600")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-1 text-sm text-indigo-600 hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "已複製" : "複製一句話清單"}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 pr-3 font-medium">Epic</th>
              <th className="py-2 pr-3 font-medium">一句話</th>
              <th className="py-2 pr-3 font-medium">目標</th>
              <th className="py-2 pr-3 font-medium">範圍</th>
              <th className="py-2 font-medium">時段</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-b border-slate-100 align-top">
                <td className="whitespace-nowrap py-2 pr-3">
                  <span className="font-mono text-xs text-indigo-600">{e.id}</span>{" "}
                  <span className="font-medium">{e.name}</span>
                </td>
                <td className="py-2 pr-3 leading-relaxed">{e.oneLiner}</td>
                <td className="py-2 pr-3">
                  <div className="flex flex-wrap gap-1">
                    {e.goals.map((g, i) => (
                      <span
                        key={g}
                        title={goalShort(g)}
                        className={
                          "rounded px-1.5 py-0.5 font-mono text-xs " +
                          (i === 0 ? "bg-indigo-50 text-indigo-600" : "text-slate-500")
                        }
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="whitespace-nowrap py-2 pr-3 text-slate-500">{e.scope}</td>
                <td className="whitespace-nowrap py-2 text-slate-500">
                  {HORIZONS.find((h) => h.id === e.horizon)?.label}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">目標欄第一個是主要目標，階層圖依它分組；滑過代號可看目標名稱。</p>
    </div>
  );
}
