import { clamp } from "@/lib/utils";

type BarColor = "xp" | "hp" | "gold" | "info" | "magenta";

const fillColor: Record<BarColor, string> = {
  xp: "var(--color-xp)",
  hp: "var(--color-hp)",
  gold: "var(--color-gold)",
  info: "var(--color-info)",
  magenta: "var(--color-magenta)",
};

type StatBarProps = {
  value: number;
  max: number;
  color?: BarColor;
  /** Left-side label (e.g. "DSA"). */
  label?: string;
  /** Show "value/max" on the right of the label row. */
  showValue?: boolean;
  /** Optional trailing note (e.g. "+120xp"). */
  note?: string;
};

/**
 * Segmented pixel progress bar (XP / HP style). Renders a recessed track with
 * a solid fill and dark segment notches drawn on top for the retro look.
 */
export function StatBar({
  value,
  max,
  color = "xp",
  label,
  showValue = true,
  note,
}: StatBarProps) {
  const safeMax = max <= 0 ? 1 : max;
  const pct = clamp((value / safeMax) * 100, 0, 100);

  return (
    <div className="w-full">
      {(label != null || showValue || note != null) && (
        <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
          {label != null && (
            <span className="pixel-title text-[0.5rem] uppercase text-fg">
              {label}
            </span>
          )}
          <span className="ml-auto tabular-nums text-muted">
            {showValue && (
              <span className="text-fg">
                {value}
                <span className="text-muted">/{max}</span>
              </span>
            )}
            {note != null && <span className="ml-2 text-xp">{note}</span>}
          </span>
        </div>
      )}

      <div
        className="pixel-inset relative h-4 w-full overflow-hidden"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div
          className="absolute inset-y-0 left-0"
          style={{ width: `${pct}%`, backgroundColor: fillColor[color] }}
        />
        {/* Segment notches drawn over the whole bar for the pixel look */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent 0 10px, rgba(0,0,0,0.45) 10px 12px)",
          }}
        />
      </div>
    </div>
  );
}
