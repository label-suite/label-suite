import {
  Check,
  CloudUpload,
  Eye,
  FileText,
  Folder,
  ListChecks,
  Plus,
  Send,
  SquarePen,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useId } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import { annotationEntryHref, TASK_LIST_HREF } from "@/lib/route-paths";

import { ActionEntryCard, type ActionEntryStep } from "./action-entry-card";
import { useFocusOnMount } from "./use-focus-on-mount";

/*
 * The role circles read data-palette.css directly through variable-reference
 * arbitrary values (design D5, F6); the strings are written out in full so
 * Tailwind finds them. "Ink" steps take the ink colour in the light theme only
 * (`dashboard.components.css` `.step-icon--ink`).
 */
const EMERALD = "bg-[var(--data-role-emerald-bg)] text-[var(--data-role-emerald-fg)]";
const EMERALD_INK =
  "bg-[var(--data-role-emerald-bg)] text-foreground dark:text-[var(--data-role-emerald-fg)]";
const VIOLET = "bg-[var(--data-role-violet-bg)] text-[var(--data-role-violet-fg)]";
const VIOLET_INK =
  "bg-[var(--data-role-violet-bg)] text-foreground dark:text-[var(--data-role-violet-fg)]";
const INDIGO = "bg-[var(--data-role-indigo-bg)] text-[var(--data-role-indigo-fg)]";

/** One step in the declaration: its icon and circle colour; the text comes from `dashboard`. */
interface StepDeclaration {
  /** The step's key under `entry.cards.<card>.steps`. */
  key: "step1" | "step2" | "step3";
  /** The step icon. */
  icon: LucideIcon;
  /** The step circle's colour classes. */
  tone: string;
}

/** One card in the declaration; its texts live under `entry.cards.<key>` in `dashboard`. */
interface CardDeclaration {
  /** The card's key under `entry.cards`. */
  key: "leader" | "annotator" | "reviewer";
  /** The role icon. */
  icon: LucideIcon;
  /** The role circle's colour classes. */
  tone: string;
  /** The three steps, in order. */
  steps: readonly [StepDeclaration, StepDeclaration, StepDeclaration];
  /** Where the CTA goes. */
  href: string;
}

/**
 * Cards A, B and C (spec 02-01 §還沒有任務角色的人看到什麼 1–8; Logic Flow
 * 分段一 4–6; ui-design.md §元件與 design token for the Lucide names). The
 * links carry only the entry mark and the role (Q3; Hard Rules 5 and 6).
 */
const CARDS: readonly CardDeclaration[] = [
  {
    key: "leader",
    icon: Users,
    tone: EMERALD,
    steps: [
      { key: "step1", icon: Plus, tone: EMERALD },
      { key: "step2", icon: CloudUpload, tone: EMERALD_INK },
      { key: "step3", icon: Users, tone: EMERALD },
    ],
    href: TASK_LIST_HREF,
  },
  {
    key: "annotator",
    icon: Tag,
    tone: VIOLET,
    steps: [
      { key: "step1", icon: Folder, tone: VIOLET },
      { key: "step2", icon: SquarePen, tone: VIOLET_INK },
      { key: "step3", icon: Send, tone: VIOLET_INK },
    ],
    href: annotationEntryHref("annotator"),
  },
  {
    key: "reviewer",
    icon: FileText,
    tone: INDIGO,
    steps: [
      { key: "step1", icon: Eye, tone: INDIGO },
      { key: "step2", icon: Check, tone: INDIGO },
      { key: "step3", icon: ListChecks, tone: INDIGO },
    ],
    href: annotationEntryHref("reviewer"),
  },
];

/**
 * One step with its texts read from `dashboard` in the current language; a
 * key missing there falls back to Traditional Chinese (frontend-i18n).
 */
function translateStep(
  t: TFunction<"dashboard">,
  card: CardDeclaration["key"],
  step: StepDeclaration,
): ActionEntryStep {
  return {
    id: step.key,
    icon: step.icon,
    tone: step.tone,
    name: t(`entry.cards.${card}.steps.${step.key}.name`),
    description: t(`entry.cards.${card}.steps.${step.key}.description`),
  };
}

/** Props of {@link ActionEntrySection}. */
export interface ActionEntrySectionProps {
  /**
   * Move focus to the section title on mount. The page sets it when a retried
   * load succeeded (design D9); a first load leaves focus alone.
   */
  focusOnMount?: boolean;
}

/**
 * The layout of a platform member with no task role (spec 02-01 A1): the
 * section title (focusable from script only), its subtitle and the three
 * action entry cards, three columns from 768px and one below. The outer block
 * has no frame; only the cards do (`dashboard.components.css:380`–`:384`).
 */
export function ActionEntrySection({ focusOnMount = false }: ActionEntrySectionProps) {
  const { t } = useTranslation("dashboard");
  const titleId = useId();
  const titleRef = useFocusOnMount<HTMLHeadingElement>(focusOnMount);

  return (
    <section
      aria-labelledby={titleId}
      data-testid="user-view"
      className="flex min-w-0 flex-col gap-(--space-md)"
    >
      <div>
        <h2
          id={titleId}
          ref={titleRef}
          tabIndex={-1}
          className="text-(length:--text-body) leading-(--leading-normal) font-semibold text-foreground"
        >
          {t("entry.title")}
        </h2>
        <p className="mt-(--space-xs) text-(length:--text-caption) leading-(--leading-relaxed) text-muted-foreground">
          {t("entry.subtitle")}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-(--space-md) md:grid-cols-3">
        {CARDS.map((card) => (
          <ActionEntryCard
            key={card.key}
            icon={card.icon}
            tone={card.tone}
            title={t(`entry.cards.${card.key}.title`)}
            description={t(`entry.cards.${card.key}.description`)}
            steps={[
              translateStep(t, card.key, card.steps[0]),
              translateStep(t, card.key, card.steps[1]),
              translateStep(t, card.key, card.steps[2]),
            ]}
            cta={t(`entry.cards.${card.key}.cta`)}
            href={card.href}
          />
        ))}
      </div>
    </section>
  );
}
