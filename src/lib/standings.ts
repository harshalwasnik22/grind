import { createClient } from "@/lib/supabase/server";
import { localDate } from "@/lib/dates";
import type { Member } from "@/lib/groups";

/** A single ranked row. `score` is whichever metric the view ranks by. */
export type RankRow = {
  userId: string;
  name: string;
  username: string | null;
  level: number;
  streak: number;
  prestige: number;
  title: string | null;
  score: number;
};

function baseRow(m: Member): Omit<RankRow, "score"> {
  return {
    userId: m.user_id,
    name: m.profiles?.display_name ?? "New Player",
    username: m.profiles?.username ?? null,
    level: m.profiles?.current_level ?? 1,
    streak: m.profiles?.current_streak ?? 0,
    prestige: m.profiles?.prestige_level ?? 0,
    title: m.profiles?.equipped_title ?? null,
  };
}

function rank(rows: RankRow[]): RankRow[] {
  return rows.sort((a, b) => b.score - a.score || b.level - a.level);
}

/** All-time XP standings: every recorded daily score summed per member. */
export async function getAllTimeStandings(
  groupId: string,
  members: Member[],
): Promise<RankRow[]> {
  const supabase = await createClient();
  const { data: scores } = await supabase
    .from("daily_scores")
    .select("user_id, xp_earned")
    .eq("group_id", groupId);

  const sums = new Map<string, number>();
  for (const s of scores ?? []) {
    const id = s.user_id as string;
    sums.set(id, (sums.get(id) ?? 0) + (Number(s.xp_earned) || 0));
  }

  return rank(
    members.map((m) => ({ ...baseRow(m), score: sums.get(m.user_id) ?? 0 })),
  );
}

/**
 * Per-category grind volume over the active window: total logged `value` across
 * a member's habits in `category`, summed over the last `windowDays` days.
 * (Group-mates can read each other's group habits + logs under RLS.)
 */
export async function getCategoryStandings(
  groupId: string,
  members: Member[],
  category: string,
  tz: string,
  windowDays = 30,
): Promise<RankRow[]> {
  const supabase = await createClient();
  const today = localDate(tz);
  const start = (() => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (windowDays - 1));
    return d.toISOString().slice(0, 10);
  })();

  const { data: habits } = await supabase
    .from("habits")
    .select("id, user_id")
    .eq("group_id", groupId)
    .eq("category", category);

  const owner = new Map<string, string>();
  for (const h of habits ?? []) owner.set(h.id as string, h.user_id as string);

  const habitIds = Array.from(owner.keys());
  const sums = new Map<string, number>();
  if (habitIds.length > 0) {
    const { data: logs } = await supabase
      .from("habit_logs")
      .select("habit_id, value")
      .in("habit_id", habitIds)
      .gte("log_date", start)
      .lte("log_date", today);
    for (const l of logs ?? []) {
      const uid = owner.get(l.habit_id as string);
      if (!uid) continue;
      sums.set(uid, (sums.get(uid) ?? 0) + (Number(l.value) || 0));
    }
  }

  return rank(
    members.map((m) => ({ ...baseRow(m), score: sums.get(m.user_id) ?? 0 })),
  );
}
