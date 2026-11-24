/**
 * User journey data: the single source for docs/product/user-journey.mdx.
 *
 * The journey is the project leader's current experience of one annotation
 * run with today's tools. The seven stages are a proposal derived from the
 * flow in the PRD's first goal, not interview results. Every content cell
 * stays PENDING until an interview fills it; edit this file, not the
 * component, when results come in.
 */

import type { GoalId } from "./roadmap-data";

/** The placeholder every content cell shows until an interview fills it. */
export const PENDING = "待訪談";

export type LayerId = "actions" | "touchpoints" | "quotes" | "emotion" | "highsLows";

export interface Layer {
  id: LayerId;
  label: string;
}

/** The five layers each stage has, top to bottom. */
export const LAYERS: Layer[] = [
  { id: "actions", label: "行為" },
  { id: "touchpoints", label: "接觸點" },
  { id: "quotes", label: "受訪者原話" },
  { id: "emotion", label: "情緒" },
  { id: "highsLows", label: "亮點與痛點" },
];

export interface Stage {
  id: string;
  name: string;
  /** One line on what the stage covers; part of the proposal, not feedback. */
  scope: string;
  /** Interview content per layer; PENDING until an interview fills it. */
  layers: Record<LayerId, string>;
  /** Emotion score from -2 to +2; null until an interview gives one. */
  emotion: number | null;
  /** Insight drawn from this stage; PENDING until the interviews are done. */
  insight: string;
  /** PRD goals the insight is expected to inform (proposal). */
  goals: GoalId[];
}

const pendingLayers = (): Record<LayerId, string> => ({
  actions: PENDING,
  touchpoints: PENDING,
  quotes: PENDING,
  emotion: PENDING,
  highsLows: PENDING,
});

export const STAGES: Stage[] = [
  {
    id: "find",
    name: "找工具與評估",
    scope: "決定這次標記要用哪些工具",
    layers: pendingLayers(),
    emotion: null,
    insight: PENDING,
    goals: ["G1"],
  },
  {
    id: "setup",
    name: "建任務與寫設定",
    scope: "把研究任務變成工具裡可以標記的任務",
    layers: pendingLayers(),
    emotion: null,
    insight: PENDING,
    goals: ["G2", "G3"],
  },
  {
    id: "pilot",
    name: "試標",
    scope: "正式標記前先讓標記員標一小批",
    layers: pendingLayers(),
    emotion: null,
    insight: PENDING,
    goals: ["G1", "G5"],
  },
  {
    id: "agreement",
    name: "確認一致性",
    scope: "判斷標記員對規則的理解是否一致",
    layers: pendingLayers(),
    emotion: null,
    insight: PENDING,
    goals: ["G1", "G4"],
  },
  {
    id: "annotate",
    name: "正式標記",
    scope: "標記員標完整份資料",
    layers: pendingLayers(),
    emotion: null,
    insight: PENDING,
    goals: ["G4", "G5"],
  },
  {
    id: "review",
    name: "審核",
    scope: "檢查並修正標記結果",
    layers: pendingLayers(),
    emotion: null,
    insight: PENDING,
    goals: ["G4", "G5"],
  },
  {
    id: "export",
    name: "匯出與分析",
    scope: "把結果拿出工具，做研究需要的分析",
    layers: pendingLayers(),
    emotion: null,
    insight: PENDING,
    goals: ["G1", "G4", "G6"],
  },
];
