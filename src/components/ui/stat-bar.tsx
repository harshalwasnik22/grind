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
  /**
   * Make the bar interactive: click (or arrow keys) reports the chosen
   * fraction 0–1 of `max`. When set, the track renders as a slider. Only pass
   * this from a Client Component.
   */
  onSeek?: (fraction: number) => void;
};

/**
 * Segmented pixel progress bar (XP / HP style). Renders a recessed track with
 * a solid fill and dark segment notches drawn on top for the retro look.
 * Pass `onSeek` to let the user click along the bar to set its value.
 */
export function StatBar({
  value,
  max,
  color = "xp",
  label,
  showValue = true,
  note,
  onSeek,
}: StatBarProps) {
  const safeMax = max <= 0 ? 1 : max;
  const pct = clamp((value / safeMax) * 100, 0, 100);
  const interactive = typeof onSeek === "function";

  function seekFromPointer(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    onSeek?.(clamp((e.clientX - rect.left) / rect.width, 0, 1));
  }

  function seekFromKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const step = 1 / safeMax;
    const current = value / safeMax;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = current + step;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown")
      next = current - step;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = 1;
    if (next !== null) {
      e.preventDefault();
      onSeek?.(clamp(next, 0, 1));
    }
  }

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
        className={`pixel-inset relative h-4 w-full overflow-hidden ${
          interactive
            ? "cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-gold"
            : ""
        }`}
        role={interactive ? "slider" : "progressbar"}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
        tabIndex={interactive ? 0 : undefined}
        title={interactive ? "Click to set progress" : undefined}
        onClick={interactive ? seekFromPointer : undefined}
        onKeyDown={interactive ? seekFromKey : undefined}
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
