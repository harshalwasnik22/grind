import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePlayer } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { getPlayerAnalytics } from "@/lib/analytics-data";
import { levelProgress } from "@/lib/scoring";
import { categoryMeta } from "@/lib/habit-meta";
import { Panel } from "@/components/ui/panel";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelBadge } from "@/components/ui/pixel-badge";
import { StatBar } from "@/components/ui/stat-bar";
import { StatTile } from "@/components/ui/stat-tile";
import { Heatmap } from "@/components/heatmap";

export const dynamic = "force-dynamic";

/** One head-to-head metric: you vs them, bars scaled to the larger value. */
function VsRow({
  label,
  you,
  them,
  suffix = "",
}: {
  label: string;
  you: number;
  them: number;
  suffix?: string;
}) {
  const max = Math.max(1, you, them);
  return (
    <li className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="pixel-title text-[0.5rem] uppercase text-muted">
          {label}
        </span>
        <span className="text-sm tabular-nums text-muted">
          <span className="text-info">
            {you}
            {suffix}
          </span>{" "}
          vs{" "}
          <span className="text-magenta">
            {them}
            {suffix}
          </span>
        </span>
      </div>
      <StatBar value={you} max={max} color="info" showValue={false} />
      <StatBar value={them} max={max} color="magenta" showValue={false} />
    </li>
  );
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const { user, profile: me } = await requirePlayer();

  // RLS (profiles_select uses shares_group_with) means this only resolves for
  // the viewer's group-mates or themselves; otherwise it's a 404.
  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle();

  if (!target) notFound();
  // Your own profile lives at /me — send you there.
  if (target.id === user.id) redirect("/me");

  const [them, mine] = await Promise.all([
    getPlayerAnalytics(target.id, target.timezone ?? "UTC"),
    getPlayerAnalytics(user.id, me.timezone ?? "UTC"),
  ]);
  const prog = levelProgress(target.total_xp ?? 0);
  const maxCat = Math.max(1, ...them.categories.map((c) => c.value));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="pixel-title text-xl text-gold">
            {target.display_name ?? "Player"}
          </h1>
          <p className="mt-2 text-base text-muted">@{target.username}</p>
        </div>
        <nav className="flex flex-wrap gap-2">
          <Link href="/leaderboard">
            <PixelButton size="sm">Ranks</PixelButton>
          </Link>
          <Link href="/">
            <PixelButton size="sm">Dashboard</PixelButton>
          </Link>
        </nav>
      </header>

      {/* HUD */}
      <Panel title="Player" className="mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center border-[3px] border-line bg-surface-2 pixel-title text-gold">
            {prog.level}
          </div>
          <div className="min-w-[12rem] flex-1">
            <StatBar
              value={prog.intoLevel}
              max={prog.span || 1}
              color="gold"
              label="XP"
              showValue={false}
              note={`${target.total_xp ?? 0} total`}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(target.prestige_level ?? 0) > 0 && (
              <PixelBadge tone="gold">★{target.prestige_level}</PixelBadge>
            )}
            <PixelBadge tone="magenta" icon={<span aria-hidden>🔥</span>}>
              {target.current_streak ?? 0}-day
            </PixelBadge>
            <PixelBadge tone="info">best {target.longest_streak ?? 0}</PixelBadge>
            {target.equipped_title && (
              <PixelBadge tone="gold">{target.equipped_title}</PixelBadge>
            )}
          </div>
        </div>
      </Panel>

      {/* Headline stats */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatTile
          label="30-day"
          value={`${them.consistency30}%`}
          note="consistency"
          tone="xp"
        />
        <StatTile
          label="Active days"
          value={them.activeDays}
          note="last 14 wks"
          tone="info"
        />
        <StatTile
          label="Best streak"
          value={them.streak.longest}
          note="days"
          tone="magenta"
        />
      </div>

      {/* Heatmap */}
      <Panel title="Activity · Last 14 Weeks" className="mb-6">
        <Heatmap grid={them.calendar.grid} />
      </Panel>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Head-to-head */}
        <Panel title="You vs Them">
          <ul className="space-y-4">
            <VsRow
              label="30-day consistency"
              you={mine.consistency30}
              them={them.consistency30}
              suffix="%"
            />
            <VsRow
              label="Active days (14wk)"
              you={mine.activeDays}
              them={them.activeDays}
            />
            <VsRow
              label="Longest streak"
              you={mine.streak.longest}
              them={them.streak.longest}
            />
          </ul>
          <p className="mt-4 flex items-center gap-3 text-sm text-muted">
            <span className="text-info">■ you</span>
            <span className="text-magenta">■ {target.display_name}</span>
          </p>
        </Panel>

        {/* Their categories */}
        <Panel title="By Category">
          {them.categories.length === 0 ? (
            <p className="text-base text-muted">No activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {them.categories.map((c) => {
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
      </div>
    </main>
  );
}
