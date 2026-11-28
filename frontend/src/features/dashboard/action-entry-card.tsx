import { ArrowRight, type LucideIcon } from "lucide-react";
import { useId } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { FOCUS_RING } from "./focus-ring";

/** One step of a card, already translated. */
export interface ActionEntryStep {
  /** A stable key within its card. */
  id: string;
  /** The step's icon, drawn inside a role-coloured circle; decorative. */
  icon: LucideIcon;
  /** Utility classes of the step circle: the role's data colours. */
  tone: string;
  /** The step name. */
  name: string;
  /** The line under the step name. */
  description: string;
}

/** Props of {@link ActionEntryCard}; every text arrives translated. */
export interface ActionEntryCardProps {
  /** The role icon in the large circle; decorative. */
  icon: LucideIcon;
  /** Utility classes of the large circle: the role's data colours (Q8). */
  tone: string;
  /** The card title, an h3 that also names the card. */
  title: string;
  /** The line under the title. */
  description: string;
  /** The three steps, in order. */
  steps: readonly [ActionEntryStep, ActionEntryStep, ActionEntryStep];
  /** The link text. */
  cta: string;
  /** Where the link goes, from lib/route-paths (design D4). */
  href: string;
}

/**
 * One action entry card (spec 02-01 §還沒有任務角色的人看到什麼; ui-design.md
 * §元件樹): a shadowless Card with a role circle, title, description, an ordered
 * list of three steps and a full-width CTA that is a router link, never
 * disabled (Q3). Font sizes follow the Q9 mapping; circle and icon sizes are
 * the prototype's literals (72/44px circles, 32/20px icons, 14px arrows).
 */
export function ActionEntryCard({
  icon: RoleIcon,
  tone,
  title,
  description,
  steps,
  cta,
  href,
}: ActionEntryCardProps) {
  const titleId = useId();

  return (
    <Card
      role="article"
      aria-labelledby={titleId}
      className="items-center gap-(--space-xs) rounded-(--radius-lg) px-(--space-md) pt-(--space-lg) pb-(--space-md) text-center shadow-none"
    >
      <div
        className={cn(
          "mb-1 flex size-18 items-center justify-center rounded-(--radius-full)",
          tone,
        )}
      >
        <RoleIcon aria-hidden="true" className="size-8" />
      </div>
      <h3 id={titleId} className="text-(length:--text-body) font-bold text-foreground">
        {title}
      </h3>
      <p className="mb-(--space-xs) text-(length:--text-label) text-muted-foreground">
        {description}
      </p>
      <ol className="my-(--space-xs) flex w-full items-start gap-4">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className="relative flex min-w-0 flex-1 flex-col items-center gap-1 text-center"
          >
            {index > 0 && (
              <ArrowRight
                aria-hidden="true"
                className="absolute top-3 -left-4 size-3.5 text-foreground opacity-40 dark:opacity-45"
              />
            )}
            <div
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-(--radius-full)",
                step.tone,
              )}
            >
              <step.icon aria-hidden="true" className="size-5" />
            </div>
            <strong className="block text-(length:--text-label) leading-(--leading-tight) font-bold text-foreground">
              {step.name}
            </strong>
            <span className="block text-(length:--text-label) leading-(--leading-snug) text-muted-foreground">
              {step.description}
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-auto w-full pt-(--space-sm)">
        <Button asChild variant="cta" className={cn("w-full font-semibold", FOCUS_RING)}>
          <Link to={href}>{cta}</Link>
        </Button>
      </div>
    </Card>
  );
}
