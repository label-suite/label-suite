/**
 * Props of {@link Metric}: the two strings and nothing else (design D7). No
 * loading flag, children or class override; layout belongs to the caller's grid.
 */
export interface MetricProps {
  /** The small caption above the value; the caller supplies it already translated. */
  label: string;
  /** The figure shown below the label, unit included; the caller formats and translates it. */
  value: string;
}

/**
 * A KPI tile (design/system Metric KPI Tile §結構): a bordered frame with the
 * label on top and the value below. The font sizes follow the G-66 mapping of
 * design D6: label `--text-label`, weight 600, upper case; value `--text-h3`,
 * weight 700, `--leading-tight`. Not interactive and not focusable; no card
 * shadow. It knows nothing of loading: a skeleton stands in for the whole tile.
 */
export function Metric({ label, value }: MetricProps) {
  return (
    <div
      data-slot="metric"
      className="flex flex-col rounded-(--radius-lg) border border-border bg-card p-(--space-md) text-card-foreground"
    >
      <span className="mb-(--space-xs) text-(length:--text-label) font-semibold tracking-[0.04em] text-muted-foreground uppercase">
        {label}
      </span>
      <strong className="text-(length:--text-h3) leading-(--leading-tight) font-bold text-foreground">
        {value}
      </strong>
    </div>
  );
}
