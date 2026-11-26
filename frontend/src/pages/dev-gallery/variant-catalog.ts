/**
 * What the component gallery shows (design D10). Primitives that declare
 * variants are bound to their exported arrays with `satisfies Record<...>`, so
 * a value added to a primitive must be added here too; the page renders from
 * these records, and the completeness test compares their keys with the
 * arrays at run time. The values below without a primitive array (Button
 * states, Input states, Card parts, the Skeleton and Empty samples) are
 * declared by the catalog itself.
 */
import type { AlertVariant } from "@/components/ui/alert";
import type { BadgeVariant } from "@/components/ui/badge";
import type { ButtonSize, ButtonVariant } from "@/components/ui/button";
import type { SeparatorOrientation } from "@/components/ui/separator";

/** How the gallery shows one declared value. */
export interface Demo {
  /** devGallery key of a translated visible name; without it the value itself is the name. */
  labelKey?: string;
  /** devGallery key of sample text shown after the name (the Alert messages). */
  sampleKey?: string;
}

/** Button states shown beside the sizes (ui-design.md §元件樹 /dev/gallery). */
export const buttonStateValues = ["disabled", "loading"] as const;
/** The three Input samples. */
export const inputStateValues = ["default", "invalid", "disabled"] as const;
/** The Label sample: one label tied to an Input. */
export const labelSampleValues = ["field"] as const;
/** The Card sample's parts; the section count is these names joined. */
export const cardPartValues = ["header", "content", "footer"] as const;
/** The Skeleton sample: two bars. */
export const skeletonSampleValues = ["lines"] as const;
/** The Empty sample: the panel-sized empty state. */
export const emptySampleValues = ["panel"] as const;

export type ButtonState = (typeof buttonStateValues)[number];
export type InputState = (typeof inputStateValues)[number];
export type LabelSample = (typeof labelSampleValues)[number];
export type CardPart = (typeof cardPartValues)[number];
export type SkeletonSample = (typeof skeletonSampleValues)[number];
export type EmptySample = (typeof emptySampleValues)[number];

export const variantCatalog = {
  button: {
    variant: {
      default: {},
      cta: {},
      outline: {},
      secondary: {},
      ghost: {},
      destructive: {},
    } satisfies Record<ButtonVariant, Demo>,
    size: { sm: {}, md: {}, lg: {} } satisfies Record<ButtonSize, Demo>,
    state: { disabled: {}, loading: {} } satisfies Record<ButtonState, Demo>,
  },
  input: {
    state: {
      default: { labelKey: "input.states.default" },
      invalid: { labelKey: "input.states.invalid" },
      disabled: { labelKey: "input.states.disabled" },
    } satisfies Record<InputState, Demo>,
  },
  label: {
    sample: { field: { labelKey: "label.field" } } satisfies Record<LabelSample, Demo>,
  },
  badge: {
    variant: {
      success: {},
      warning: {},
      error: {},
      info: {},
      neutral: {},
      role: {},
    } satisfies Record<BadgeVariant, Demo>,
  },
  alert: {
    variant: {
      info: { sampleKey: "alert.samples.info" },
      success: { sampleKey: "alert.samples.success" },
      warning: { sampleKey: "alert.samples.warning" },
      error: { sampleKey: "alert.samples.error" },
    } satisfies Record<AlertVariant, Demo>,
  },
  card: {
    part: { header: {}, content: {}, footer: {} } satisfies Record<CardPart, Demo>,
  },
  separator: {
    orientation: { horizontal: {}, vertical: {} } satisfies Record<SeparatorOrientation, Demo>,
  },
  skeleton: {
    sample: { lines: {} } satisfies Record<SkeletonSample, Demo>,
  },
  empty: {
    sample: { panel: {} } satisfies Record<EmptySample, Demo>,
  },
};

/**
 * The values of one catalog record, in declaration order. Object.entries types
 * keys as plain strings; the record is keyed by exactly `Value`, so narrowing
 * them back is safe.
 */
export function catalogEntries<Value extends string>(demos: Record<Value, Demo>): [Value, Demo][] {
  return Object.entries<Demo>(demos) as [Value, Demo][];
}

/** The `data-gallery-item` value the completeness test looks for. */
export function galleryItem(component: string, axis: string, value: string): string {
  return `${component}:${axis}:${value}`;
}

/** The nine sections, in page order; ids are the anchors the nav links to. */
export const gallerySections = [
  "button",
  "input",
  "label",
  "badge",
  "alert",
  "card",
  "separator",
  "states",
  "tokens",
] as const;

export type GallerySectionId = (typeof gallerySections)[number];
