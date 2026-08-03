import { Panel } from "@/components/ui/panel";
import { PixelButton } from "@/components/ui/pixel-button";
import { StatBar } from "@/components/ui/stat-bar";
import { PixelBadge } from "@/components/ui/pixel-badge";

// Static design-system showcase with sample data — a public reference for the
// dashboard look that renders without Supabase configured.
const habitsToday = [
  { label: "DSA", value: 2, max: 2, color: "info" as const, note: "+120xp" },
  { label: "System Design", value: 0, max: 1, color: "magenta" as const },
  { label: "Gym", value: 1, max: 1, color: "xp" as const, note: "+100xp" },
  { label: "Learn Tech", value: 15, max: 30, color: "gold" as const },
];

const party = [
  { rank: 1, name: "YOU", level: 12, score: 940, streak: 8 },
  { rank: 2, name: "ALEX", level: 11, score: 880, streak: 5 },
  { rank: 3, name: "SAM", level: 9, score: 610, streak: 2 },
];

const rankTone = ["gold", "info", "magenta"] as const;

export default function ShowcasePage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <header className="mb-8 text-center">
        <h1 className="pixel-title text-2xl text-gold sm:text-3xl">GRIND</h1>
        <p className="mt-3 text-lg text-muted">
          Level up your grind. Out-grind your friends.
        </p>
      </header>

      <Panel title="Player · You" className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center border-[3px] border-line bg-surface-2 pixel-title text-gold">
            12
          </div>
          <div className="min-w-[12rem] flex-1">
            <StatBar
              value={640}
              max={1000}
              color="gold"
              label="XP → Lv.13"
              note="prestige ★1"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <PixelBadge tone="magenta" icon={<span aria-hidden>🔥</span>}>
              8-day
            </PixelBadge>
            <PixelBadge tone="info" icon={<span aria-hidden>❄️</span>}>
              2 freeze
            </PixelBadge>
            <PixelBadge tone="gold">GRINDLORD</PixelBadge>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Today's Quests">
          <div className="space-y-4">
            {habitsToday.map((h) => (
              <StatBar key={h.label} {...h} />
            ))}
          </div>
          <div className="mt-5 flex gap-3">
            <PixelButton variant="primary" size="sm">
              Log Progress
            </PixelButton>
            <PixelButton size="sm">Edit Quests</PixelButton>
          </div>
        </Panel>

        <Panel title="Party Ranking · Week">
          <ol className="space-y-2">
            {party.map((p, i) => (
              <li
                key={p.name}
                className="pixel-inset flex items-center gap-3 px-3 py-2"
              >
                <span className="pixel-title w-6 text-center text-sm text-gold">
                  {p.rank}
                </span>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="pixel-title text-[0.6rem] text-fg">
                      {p.name}
                    </span>
                    <span className="tabular-nums text-info">{p.score}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-muted">
                    <span>Lv.{p.level}</span>
                    <PixelBadge tone={rankTone[i]}>🔥 {p.streak}</PixelBadge>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <div className="mt-6 border-[3px] border-hp bg-hp/10 p-4">
        <p className="pixel-title text-[0.6rem] text-hp">
          ⚔ This Week&apos;s Wager
        </p>
        <p className="mt-2 text-lg text-fg">
          Last place buys the group coffee. Currently on the hook:{" "}
          <span className="text-hp">SAM</span>.
        </p>
      </div>
    </main>
  );
}
