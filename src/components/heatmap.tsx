import type { HeatCell } from "@/lib/analytics";

const levelClass = [
  "bg-bg", // 0 — no activity
  "bg-xp/25",
  "bg-xp/50",
  "bg-xp/75",
  "bg-xp",
];

/** GitHub-style contribution grid. `grid` is weeks (columns) × 7 days (rows). */
export function Heatmap({ grid }: { grid: HeatCell[][] }) {
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1">
        {grid.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((cell) => (
              <div
                key={cell.date}
                title={`${cell.date}: ${cell.total}`}
                className={`h-3 w-3 border border-black/40 ${levelClass[cell.level]}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1 text-sm text-muted">
        <span>less</span>
        {levelClass.map((c, i) => (
          <span key={i} className={`h-3 w-3 border border-black/40 ${c}`} />
        ))}
        <span>more</span>
      </div>
    </div>
  );
}
