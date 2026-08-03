import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePlayer } from "@/lib/current-user";
import { getMyGroup } from "@/lib/groups";
import { getWeeklyStandings } from "@/lib/leaderboard";
import {
  getAllTimeStandings,
  getCategoryStandings,
  type RankRow,
} from "@/lib/standings";
import { createClient } from "@/lib/supabase/server";
import { localDate } from "@/lib/dates";
import { CATEGORIES, categoryMeta } from "@/lib/habit-meta";
import { Panel } from "@/components/ui/panel";
import { PixelButton } from "@/components/ui/pixel-button";
import { PixelBadge } from "@/components/ui/pixel-badge";
import { RealtimeRefresh } from "@/components/realtime-refresh";

export const dynamic = "force-dynamic";

type View = "season" | "all-time" | "category";
const VIEWS: { key: View; label: string }[] = [
  { key: "season", label: "Season" },
  { key: "all-time", label: "All-Time" },
  { key: "category", label: "By Category" },
];
const rankTone = ["gold", "info", "magenta"] as const;

function scoreLabel(view: View): string {
  if (view === "all-time") return "XP";
  if (view === "category") return "logged";
  return "XP";
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; cat?: string }>;
}) {
  const { user, profile } = await requirePlayer();
  const squad = await getMyGroup(user.id);
  if (!squad) redirect("/groups/new");

  const sp = await searchParams;
  const view: View = VIEWS.some((v) => v.key === sp.view)
    ? (sp.view as View)
    : "season";
  const cat = CATEGORIES.some((c) => c.value === sp.cat) ? sp.cat! : "dsa";
  const tz = profile.timezone ?? "UTC";

  const supabase = await createClient();
  const { data: season } = await supabase
    .from("seasons")
    .select("name, starts_on")
    .eq("group_id", squad.group.id)
    .eq("is_active", true)
    .order("starts_on", { ascending: false })
    .limit(1)
    .maybeSingle();

  let rows: RankRow[];
  if (view === "all-time") {
    rows = await getAllTimeStandings(squad.group.id, squad.members);
  } else if (view === "category") {
    rows = await getCategoryStandings(squad.group.id, squad.members, cat, tz);
  } else {
    const weekly = await getWeeklyStandings(
      squad.group.id,
      squad.members,
      season?.starts_on ?? null,
      tz,
    );
    rows = weekly.map((s) => ({
      userId: s.userId,
      name: s.name,
      username: null,
      level: s.level,
      streak: s.streak,
      prestige: s.prestige,
      title: s.title,
      score: s.weeklyXp,
    }));
  }

  const title =
    view === "season"
      ? `Season${season?.name ? ` · ${season.name}` : ""}`
      : view === "all-time"
        ? "All-Time XP"
        : `${categoryMeta(cat).icon} ${categoryMeta(cat).label} · 30d`;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <RealtimeRefresh groupId={squad.group.id} />

      <header className="mb-6 flex items-center justify-between gap-3">
        <h1 className="pixel-title text-xl text-gold">Leaderboard</h1>
        <nav className="flex flex-wrap gap-2">
          <Link href="/">
            <PixelButton size="sm">Dashboard</PixelButton>
          </Link>
          <Link href="/analytics">
            <PixelButton size="sm">Stats</PixelButton>
          </Link>
        </nav>
      </header>

      {/* View tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={
              v.key === "category"
                ? `/leaderboard?view=category&cat=${cat}`
                : `/leaderboard?view=${v.key}`
            }
          >
            <PixelButton size="sm" variant={view === v.key ? "gold" : "default"}>
              {v.label}
            </PixelButton>
          </Link>
        ))}
      </div>

      {/* Category chips */}
      {view === "category" && (
        <div className="mb-4 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Link key={c.value} href={`/leaderboard?view=category&cat=${c.value}`}>
              <PixelBadge tone={c.value === cat ? c.color : "muted"}>
                {c.icon} {c.label}
              </PixelBadge>
            </Link>
          ))}
        </div>
      )}

      <Panel title={title}>
        <ol className="space-y-2">
          {rows.map((s, i) => {
            const isYou = s.userId === user.id;
            const nameEl = (
              <span className="pixel-title truncate text-[0.6rem] text-fg">
                {s.name}
                {isYou && <span className="text-info"> (you)</span>}
              </span>
            );
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
                    {s.username && !isYou ? (
                      <Link
                        href={`/profile/${s.username}`}
                        className="min-w-0 underline-offset-4 hover:underline"
                      >
                        {nameEl}
                      </Link>
                    ) : (
                      nameEl
                    )}
                    <span className="tabular-nums text-info">
                      {s.score}
                      <span className="ml-1 text-sm text-muted">
                        {scoreLabel(view)}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-muted">
                    <span>Lv.{s.level}</span>
                    {s.prestige > 0 && (
                      <span className="text-gold">★{s.prestige}</span>
                    )}
                    <PixelBadge tone={rankTone[i] ?? "muted"}>
                      🔥 {s.streak}
                    </PixelBadge>
                    {s.title && <span className="text-gold">{s.title}</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        {view === "category" && (
          <p className="mt-4 text-sm text-muted">
            Ranked by total {categoryMeta(cat).label} logged over the last 30
            days.
          </p>
        )}
      </Panel>
    </main>
  );
}
