import { createClient } from "@/lib/supabase/server";
import { localDate } from "@/lib/dates";
import type { Member } from "@/lib/groups";

export type Standing = {
  userId: string;
  name: string;
  level: number;
  streak: number;
  prestige: number;
  title: string | null;
  weeklyXp: number;
};

function weekStart(today: string): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 6);
  return d.toISOString().slice(0, 10);
}

/**
 * Weekly standings for a group: each member's XP summed over the active season
 * window (falling back to the trailing 7 days), sorted highest-first.
 */
export async function getWeeklyStandings(
  groupId: string,
  members: Member[],
  seasonStart: string | null,
  tz: string,
): Promise<Standing[]> {
  const supabase = await createClient();
  const today = localDate(tz);
  const start = seasonStart ?? weekStart(today);

  const { data: scores } = await supabase
    .from("daily_scores")
    .select("user_id, xp_earned, date")
    .eq("group_id", groupId)
    .gte("date", start)
    .lte("date", today);

  const sums = new Map<string, number>();
  for (const s of scores ?? []) {
    sums.set(
      s.user_id as string,
      (sums.get(s.user_id as string) ?? 0) + (s.xp_earned ?? 0),
    );
  }

  const standings: Standing[] = members.map((m) => ({
    userId: m.user_id,
    name: m.profiles?.display_name ?? "New Player",
    level: m.profiles?.current_level ?? 1,
    streak: m.profiles?.current_streak ?? 0,
    prestige: m.profiles?.prestige_level ?? 0,
    title: m.profiles?.equipped_title ?? null,
    weeklyXp: sums.get(m.user_id) ?? 0,
  }));

  standings.sort((a, b) => b.weeklyXp - a.weeklyXp || b.level - a.level);
  return standings;
}
