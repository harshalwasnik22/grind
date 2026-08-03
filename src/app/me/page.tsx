import Link from "next/link";
import { requirePlayer } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { levelProgress, MAX_LEVEL } from "@/lib/scoring";
import { localDate } from "@/lib/dates";
import { Panel } from "@/components/ui/panel";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelBadge } from "@/components/ui/pixel-badge";
import { StatBar } from "@/components/ui/stat-bar";
import { EnableNotifications } from "@/components/enable-notifications";
import { prestigeAction, toggleRestDay, equipTitle } from "@/app/me/actions";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const { user, profile } = await requirePlayer();
  const supabase = await createClient();
  const today = localDate(profile.timezone ?? "UTC");

  const [
    { data: badges },
    { data: userBadges },
    { data: titles },
    { data: userTitles },
    { data: restToday },
  ] = await Promise.all([
    supabase.from("badges").select("id, key, name, description, icon"),
    supabase.from("user_badges").select("badge_id").eq("user_id", user.id),
    supabase.from("titles").select("id, key, name, description").order("key"),
    supabase.from("user_titles").select("title_id").eq("user_id", user.id),
    supabase
      .from("rest_days")
      .select("id")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle(),
  ]);

  const earned = new Set((userBadges ?? []).map((b) => b.badge_id as string));
  const unlocked = new Set((userTitles ?? []).map((t) => t.title_id as string));
  const prog = levelProgress(profile.total_xp ?? 0);
  const isRest = Boolean(restToday);
  const canPrestige = (profile.current_level ?? 1) >= MAX_LEVEL;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="pixel-title text-xl text-gold">
            {profile.display_name ?? "You"}
          </h1>
          {profile.username && (
            <p className="mt-2 text-base text-muted">@{profile.username}</p>
          )}
        </div>
        <nav className="flex flex-wrap gap-2">
          <Link href="/">
            <PixelButton size="sm">Dashboard</PixelButton>
          </Link>
          <Link href="/habits">
            <PixelButton size="sm">Quests</PixelButton>
          </Link>
        </nav>
      </header>

      {/* Stats */}
      <Panel title="Player Stats" className="mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center border-[3px] border-line bg-surface-2 pixel-title text-xl text-gold">
            {prog.level}
          </div>
          <div className="min-w-[12rem] flex-1">
            <StatBar
              value={prog.intoLevel}
              max={prog.span || 1}
              color="gold"
              label="XP"
              showValue={false}
              note={prog.prestigeReady ? "MAX ★" : `→ Lv.${prog.level + 1}`}
            />
            <p className="mt-1 text-sm text-muted">
              {profile.total_xp ?? 0} total XP
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(profile.prestige_level ?? 0) > 0 && (
            <PixelBadge tone="gold">
              {"★".repeat(Math.min(profile.prestige_level, 5))} Prestige{" "}
              {profile.prestige_level}
            </PixelBadge>
          )}
          <PixelBadge tone="magenta" icon={<span aria-hidden>🔥</span>}>
            {profile.current_streak ?? 0}-day streak
          </PixelBadge>
          <PixelBadge tone="info">
            best {profile.longest_streak ?? 0}
          </PixelBadge>
          <PixelBadge tone="info" icon={<span aria-hidden>❄️</span>}>
            {profile.streak_freezes ?? 0} freezes
          </PixelBadge>
          {profile.equipped_title && (
            <PixelBadge tone="gold">{profile.equipped_title}</PixelBadge>
          )}
        </div>
      </Panel>

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        {/* Rest day */}
        <Panel title="Rest Day">
          <p className="mb-4 text-base text-muted">
            {isRest
              ? "Today is a rest day — your streak is protected."
              : "Mark today as a planned rest day so a missed target won't break your streak."}
          </p>
          <form action={toggleRestDay}>
            <PixelButton
              type="submit"
              size="sm"
              variant={isRest ? "danger" : "primary"}
            >
              {isRest ? "Cancel Rest Day" : "Take a Rest Day"}
            </PixelButton>
          </form>
        </Panel>

        {/* Prestige */}
        <Panel title="Prestige">
          {canPrestige ? (
            <>
              <p className="mb-4 text-base text-fg">
                You&apos;ve hit the level cap! Prestige to reset to level 1, earn
                a ★, and keep every badge.
              </p>
              <form action={prestigeAction}>
                <PixelButton type="submit" size="sm" variant="gold">
                  ★ Prestige Now
                </PixelButton>
              </form>
            </>
          ) : (
            <p className="text-base text-muted">
              Reach level {MAX_LEVEL} to prestige. You&apos;re level{" "}
              {profile.current_level ?? 1}.
            </p>
          )}
        </Panel>
      </div>

      {/* Reminders */}
      <Panel title="Reminders" className="mb-6">
        <p className="mb-4 text-base text-muted">
          Get a push nudge in the evening if you still have a quest to log, plus
          a weekly recap of where you finished.
        </p>
        <EnableNotifications />
      </Panel>

      {/* Titles */}
      <Panel title="Titles" className="mb-6">
        <ul className="grid gap-2 sm:grid-cols-2">
          {(titles ?? []).map((t) => {
            const has = unlocked.has(t.id as string);
            const equipped = profile.equipped_title === t.name;
            return (
              <li
                key={t.id}
                className={`pixel-inset flex items-center gap-3 px-3 py-2 ${
                  has ? "" : "opacity-40"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <span className="pixel-title text-[0.55rem] text-gold">
                    {t.name}
                  </span>
                  <p className="mt-1 truncate text-sm text-muted">
                    {t.description}
                  </p>
                </div>
                {has &&
                  (equipped ? (
                    <PixelBadge tone="gold">equipped</PixelBadge>
                  ) : (
                    <form action={equipTitle}>
                      <input type="hidden" name="title" value={t.name} />
                      <PixelButton size="sm" type="submit">
                        Equip
                      </PixelButton>
                    </form>
                  ))}
              </li>
            );
          })}
        </ul>
      </Panel>

      {/* Trophy case */}
      <Panel title={`Trophy Case · ${earned.size}/${(badges ?? []).length}`}>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(badges ?? []).map((b) => {
            const has = earned.has(b.id as string);
            return (
              <li
                key={b.id}
                className={`pixel-inset flex flex-col items-center gap-1 px-3 py-4 text-center ${
                  has ? "" : "opacity-35 grayscale"
                }`}
              >
                <span aria-hidden className="text-3xl">
                  {b.icon}
                </span>
                <span className="pixel-title text-[0.5rem] text-gold">
                  {b.name}
                </span>
                <span className="text-sm text-muted">{b.description}</span>
              </li>
            );
          })}
        </ul>
      </Panel>
    </main>
  );
}
