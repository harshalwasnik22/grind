import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePlayer } from "@/lib/current-user";
import { getMyGroup } from "@/lib/groups";
import { getMyHabits } from "@/lib/habits";
import { getWeeklyStandings } from "@/lib/leaderboard";
import { createClient } from "@/lib/supabase/server";
import { localDate, weekdayOf } from "@/lib/dates";
import { levelProgress } from "@/lib/scoring";
import { Panel } from "@/components/ui/panel";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelBadge } from "@/components/ui/pixel-badge";
import { StatBar } from "@/components/ui/stat-bar";
import { SignOutButton } from "@/components/sign-out-button";
import { QuickLog, type QuickLogEntry } from "@/components/quick-log";

export const dynamic = "force-dynamic";

const rankTone = ["gold", "info", "magenta"] as const;

export default async function Dashboard() {
  const { user, profile } = await requirePlayer();
  const squad = await getMyGroup(user.id);
  if (!squad) redirect("/groups/new");

  const tz = profile.timezone ?? "UTC";
  const today = localDate(tz);
  const weekday = weekdayOf(today);

  const habits = await getMyHabits(user.id);
  const scheduled = habits.filter(
    (h) => Array.isArray(h.schedule) && h.schedule.includes(weekday),
  );

  const supabase = await createClient();
  const ids = scheduled.map((h) => h.id);
  const valueMap = new Map<string, number>();
  if (ids.length > 0) {
    const { data: logs } = await supabase
      .from("habit_logs")
      .select("habit_id, value")
      .eq("user_id", user.id)
      .eq("log_date", today)
      .in("habit_id", ids);
    for (const l of logs ?? []) {
      valueMap.set(l.habit_id as string, Number(l.value));
    }
  }
  const entries: QuickLogEntry[] = scheduled.map((h) => ({
    habit: h,
    value: valueMap.get(h.id) ?? 0,
  }));
  const doneToday = entries.filter(
    (e) => e.habit.daily_target > 0 && e.value >= e.habit.daily_target,
  ).length;

  const { data: season } = await supabase
    .from("seasons")
    .select("name, starts_on, ends_on")
    .eq("group_id", squad.group.id)
    .eq("is_active", true)
    .order("starts_on", { ascending: false })
    .limit(1)
    .maybeSingle();

  const standings = await getWeeklyStandings(
    squad.group.id,
    squad.members,
    season?.starts_on ?? null,
    tz,
  );

  const prog = levelProgress(profile.total_xp ?? 0);
  const daysLeft = season?.ends_on
    ? Math.max(
        0,
        Math.round(
          (new Date(`${season.ends_on}T00:00:00Z`).getTime() -
            new Date(`${today}T00:00:00Z`).getTime()) /
            86400000,
        ),
      )
    : null;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      {/* Top bar */}
      <header className="mb-6 flex items-center justify-between gap-3">
        <h1 className="pixel-title text-xl text-gold">GRIND</h1>
        <nav className="flex flex-wrap gap-2">
          <Link href="/habits">
            <PixelButton size="sm">Quests</PixelButton>
          </Link>
          <Link href="/group">
            <PixelButton size="sm">Squad</PixelButton>
          </Link>
          <Link href="/leaderboard">
            <PixelButton size="sm">Ranks</PixelButton>
          </Link>
          <Link href="/analytics">
            <PixelButton size="sm">Stats</PixelButton>
          </Link>
          <Link href="/me">
            <PixelButton size="sm">You</PixelButton>
          </Link>
          <SignOutButton />
        </nav>
      </header>

      {/* Player HUD */}
      <Panel title={`Player · ${profile.display_name ?? "You"}`} className="mb-6">
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
              note={
                prog.prestigeReady ? "MAX ★ ready" : `→ Lv.${prog.level + 1}`
              }
            />
            <p className="mt-1 text-sm text-muted">
              {profile.total_xp ?? 0} total XP
              {profile.prestige_level > 0 && (
                <span className="text-gold"> · ★{profile.prestige_level}</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PixelBadge tone="magenta" icon={<span aria-hidden>🔥</span>}>
              {profile.current_streak ?? 0}-day
            </PixelBadge>
            <PixelBadge tone="info" icon={<span aria-hidden>❄️</span>}>
              {profile.streak_freezes ?? 0}
            </PixelBadge>
            {profile.equipped_title && (
              <PixelBadge tone="gold">{profile.equipped_title}</PixelBadge>
            )}
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Today's quests */}
        <Panel
          title={`Today's Quests · ${doneToday}/${scheduled.length}`}
          action={
            <Link
              href="/habits"
              className="text-sm text-info underline underline-offset-4"
            >
              edit
            </Link>
          }
        >
          <QuickLog entries={entries} />
        </Panel>

        {/* Party ranking */}
        <Panel
          title={`Party Ranking${season?.name ? ` · ${season.name}` : ""}`}
          action={
            <Link
              href="/leaderboard"
              className="text-sm text-info underline underline-offset-4"
            >
              full
            </Link>
          }
        >
          <ol className="space-y-2">
            {standings.map((s, i) => {
              const isYou = s.userId === user.id;
              return (
                <li
                  key={s.userId}
                  className={`pixel-inset flex items-center gap-3 px-3 py-2 ${
                    isYou ? "border-info" : ""
                  }`}
                >
                  <span className="pixel-title w-6 text-center text-sm text-gold">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="pixel-title truncate text-[0.6rem] text-fg">
                        {s.name}
                        {isYou && <span className="text-info"> (you)</span>}
                      </span>
                      <span className="tabular-nums text-info">
                        {s.weeklyXp}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-muted">
                      <span>Lv.{s.level}</span>
                      <PixelBadge tone={rankTone[i] ?? "muted"}>
                        🔥 {s.streak}
                      </PixelBadge>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </Panel>
      </div>

      {/* Season banner */}
      {season && daysLeft !== null && (
        <div className="mt-6 border-[3px] border-info bg-info/10 p-4">
          <p className="pixel-title text-[0.6rem] text-info">
            ⚔ {season.name}
          </p>
          <p className="mt-2 text-lg text-fg">
            {daysLeft === 0
              ? "Final day — the leaderboard locks tonight!"
              : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left this season. Keep grinding.`}
          </p>
        </div>
      )}
    </main>
  );
}
