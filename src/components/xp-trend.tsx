/**
 * Pixel bar chart of daily XP. Pure/presentational — each column is a day,
 * height scaled against the peak day in range. On-brand with the retro HUD
 * (no charting lib; matches the StatBar segment look).
 */
export function XpTrend({ data }: { data: { date: string; xp: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.xp));
  if (data.length === 0) {
    return <p className="text-base text-muted">No XP logged yet.</p>;
  }
  return (
    <div>
      <div className="flex h-24 items-end gap-[2px]">
        {data.map((d) => {
          const pct = d.xp > 0 ? Math.max(8, Math.round((d.xp / max) * 100)) : 3;
          return (
            <div
              key={d.date}
              className="flex h-full flex-1 items-end"
              title={`${d.date}: ${d.xp} XP`}
            >
              <div
                className={`w-full border border-black/40 ${
                  d.xp > 0 ? "bg-xp" : "bg-line/20"
                }`}
                style={{ height: `${pct}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-sm text-muted tabular-nums">
        <span>{data[0]?.date.slice(5)}</span>
        <span className="text-xp">peak {max} XP</span>
        <span>{data[data.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}
