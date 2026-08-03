import Link from "next/link";
import { requirePlayer } from "@/lib/current-user";
import { getPlayerAnalytics } from "@/lib/analytics-data";
import { categoryMeta } from "@/lib/habit-meta";
import { Panel } from "@/components/ui/panel";
import { PixelButton } from "@/components/ui/pixel-button";
import { StatBar } from "@/components/ui/stat-bar";
import { StatTile } from "@/components/ui/stat-tile";
import { Heatmap } from "@/components/heatmap";
import { XpTrend } from "@/components/xp-trend";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const { user, profile } = await requirePlayer();
  const a = await getPlayerAnalytics(user.id, profile.timezone ?? "UTC");
  const maxCat = Math.max(1, ...a.categories.map((c) => c.value));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <header className="mb-6 flex items-center justify-between gap-3">
        <h1 className="pixel-title text-xl text-gold">Analytics</h1>
        <nav className="flex flex-wrap gap-2">
          <Link href="/">
            <PixelButton size="sm">Dashboard</PixelButton>
          </Link>
          <Link href="/leaderboard">
            <PixelButton size="sm">Ranks</PixelButton>
          </Link>
          <Link href="/me">
            <PixelButton size="sm">You</PixelButton>
          </Link>
        </nav>
      </header>

      {/* Headline stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="30-day"
          value={`${a.consistency30}%`}
          note="consistency"
          tone="xp"
        />
        <StatTile
          label="90-day"
          value={`${a.consistency90}%`}
          note="consistency"
          tone="info"
        />
        <StatTile
          label="Streak"
          value={`${a.streak.current}`}
          note={`best ${a.streak.longest}`}
          tone="magenta"
        />
        <StatTile
          label="Active days"
          value={a.activeDays}
          note="last 14 wks"
          tone="gold"
        />
      </div>

      {/* Contribution heatmap */}
      <Panel title="Activity · Last 14 Weeks" className="mb-6">
        <Heatmap grid={a.calendar.grid} />
      </Panel>

      {/* XP trend */}
      <Panel
        title="XP · Last 30 Days"
        action={
          <span className="text-sm text-muted tabular-nums">
            {a.windowXp} total
          </span>
        }
        className="mb-6"
      >
        <XpTrend data={a.xpTrend} />
      </Panel>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Category breakdown */}
        <Panel title="By Category">
          {a.categories.length === 0 ? (
            <p className="text-base text-muted">
              Log some quests to see your category split.
            </p>
          ) : (
            <ul className="space-y-3">
              {a.categories.map((c) => {
                const m = categoryMeta(c.category);
                return (
                  <li key={c.category}>
                    <StatBar
                      value={c.value}
                      max={maxCat}
                      color={m.color}
                      label={`${m.icon} ${m.label}`}
                      showValue={false}
                      note={`${c.value} · ${c.activeDays}d`}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* Personal bests */}
        <Panel title="Personal Bests">
          {a.personalBests.length === 0 ? (
            <p className="text-base text-muted">No records yet — go set one.</p>
          ) : (
            <ul className="space-y-2">
              {a.personalBests.slice(0, 8).map((p) => {
                const m = categoryMeta(p.category);
                return (
                  <li
                    key={p.habitId}
                    className="pixel-inset flex items-center gap-3 px-3 py-2"
                  >
                    <span aria-hidden className="text-lg">
                      {m.icon}
                    </span>
                    <span className="pixel-title min-w-0 flex-1 truncate text-[0.55rem] text-fg">
                      {p.name}
                    </span>
                    <span className="tabular-nums text-gold">
                      {p.best}
                      <span className="ml-1 text-sm text-muted">{p.unit}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </main>
  );
}
