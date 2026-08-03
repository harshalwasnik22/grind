import type { SupabaseClient } from "@supabase/supabase-js";
import { previousDate } from "@/lib/dates";
import {
  evaluateBadgeKeys,
  evaluateTitleKeys,
  pickEquippableTitle,
  type AwardContext,
  type BadgeCriteria,
  type TitleRule,
} from "@/lib/awards";

type SyncOpts = {
  level: number;
  currentStreak: number;
  prestige: number;
  groupId: string | null;
  today: string;
  seasonRank?: number | null;
};

async function countLogs(supabase: SupabaseClient, userId: string) {
  const { count } = await supabase
    .from("habit_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return count ?? 0;
}

async function categoryStats(supabase: SupabaseClient, userId: string) {
  const { data: habits } = await supabase
    .from("habits")
    .select("id, category")
    .eq("user_id", userId);
  const catOf = new Map<string, string>(
    (habits ?? []).map((h) => [h.id as string, h.category as string]),
  );

  const { data: logs } = await supabase
    .from("habit_logs")
    .select("habit_id, log_date, value")
    .eq("user_id", userId);

  const categoryTotals: Record<string, number> = {};
  const daysByCat: Record<string, Set<string>> = {};
  for (const l of logs ?? []) {
    const cat = catOf.get(l.habit_id as string);
    if (!cat) continue;
    const v = Number(l.value) || 0;
    categoryTotals[cat] = (categoryTotals[cat] ?? 0) + v;
    if (v > 0) (daysByCat[cat] ??= new Set()).add(l.log_date as string);
  }
  const categoryDays: Record<string, number> = {};
  for (const [cat, set] of Object.entries(daysByCat)) categoryDays[cat] = set.size;
  return { categoryTotals, categoryDays };
}

async function computePerfectWeek(
  supabase: SupabaseClient,
  userId: string,
  today: string,
) {
  const need: string[] = [];
  let cursor = today;
  for (let i = 0; i < 7; i++) {
    need.push(cursor);
    cursor = previousDate(cursor);
  }
  const start = need[need.length - 1];

  const { data: scores } = await supabase
    .from("daily_scores")
    .select("date, targets_hit, habits_total")
    .eq("user_id", userId)
    .gte("date", start)
    .lte("date", today);

  const byDate = new Map(
    (scores ?? []).map((s) => [s.date as string, s]),
  );
  for (const d of need) {
    const s = byDate.get(d);
    if (
      !s ||
      (s.habits_total ?? 0) <= 0 ||
      (s.targets_hit ?? 0) < (s.habits_total ?? 0)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Evaluates and grants any newly-earned badges/titles for a player, then
 * auto-equips their highest-priority title. Safe to call after each log and
 * after a prestige. Returns the newly-earned badge keys for optional feedback.
 */
export async function syncAwards(
  supabase: SupabaseClient,
  userId: string,
  opts: SyncOpts,
): Promise<{ newBadges: string[]; equippedTitle: string | null }> {
  const [{ data: badges }, { data: titles }] = await Promise.all([
    supabase.from("badges").select("id, key, criteria"),
    supabase.from("titles").select("id, key, name, unlock_rule"),
  ]);
  const [{ data: ub }, { data: ut }] = await Promise.all([
    supabase.from("user_badges").select("badge_id").eq("user_id", userId),
    supabase.from("user_titles").select("title_id").eq("user_id", userId),
  ]);

  const badgeById = new Map((badges ?? []).map((b) => [b.id as string, b]));
  const titleById = new Map((titles ?? []).map((t) => [t.id as string, t]));
  const alreadyBadgeKeys = new Set(
    (ub ?? [])
      .map((r) => badgeById.get(r.badge_id as string)?.key as string | undefined)
      .filter((k): k is string => Boolean(k)),
  );
  const alreadyTitleKeys = new Set(
    (ut ?? [])
      .map((r) => titleById.get(r.title_id as string)?.key as string | undefined)
      .filter((k): k is string => Boolean(k)),
  );

  const totalLogs = await countLogs(supabase, userId);
  const { categoryTotals, categoryDays } = await categoryStats(supabase, userId);
  const perfectWeek = await computePerfectWeek(supabase, userId, opts.today);

  const ctx: AwardContext = {
    totalLogs,
    currentStreak: opts.currentStreak,
    level: opts.level,
    prestige: opts.prestige,
    perfectWeek,
    categoryTotals,
    categoryDays,
    seasonRank: opts.seasonRank ?? null,
  };

  // Badges
  const badgeDefs = (badges ?? []).map((b) => ({
    key: b.key as string,
    criteria: b.criteria as BadgeCriteria,
  }));
  const newBadgeKeys = evaluateBadgeKeys(badgeDefs, ctx, alreadyBadgeKeys);
  if (newBadgeKeys.length > 0) {
    const keyToId = new Map((badges ?? []).map((b) => [b.key as string, b.id]));
    const rows = newBadgeKeys.map((k) => ({
      user_id: userId,
      badge_id: keyToId.get(k),
      group_id: opts.groupId,
    }));
    await supabase
      .from("user_badges")
      .upsert(rows, { onConflict: "user_id,badge_id", ignoreDuplicates: true });
  }

  // Titles
  const titleDefs = (titles ?? []).map((t) => ({
    key: t.key as string,
    unlock_rule: t.unlock_rule as TitleRule,
  }));
  const newTitleKeys = evaluateTitleKeys(titleDefs, ctx, alreadyTitleKeys);
  if (newTitleKeys.length > 0) {
    const keyToId = new Map((titles ?? []).map((t) => [t.key as string, t.id]));
    const rows = newTitleKeys.map((k) => ({
      user_id: userId,
      title_id: keyToId.get(k),
    }));
    await supabase
      .from("user_titles")
      .upsert(rows, { onConflict: "user_id,title_id", ignoreDuplicates: true });
  }

  // Auto-equip the best unlocked title.
  const unlockedKeys = new Set([...alreadyTitleKeys, ...newTitleKeys]);
  const unlocked = (titles ?? [])
    .filter((t) => unlockedKeys.has(t.key as string))
    .map((t) => ({ name: t.name as string, unlock_rule: t.unlock_rule as TitleRule }));
  const best = pickEquippableTitle(unlocked);
  if (best) {
    await supabase.from("profiles").update({ equipped_title: best }).eq("id", userId);
  }

  return { newBadges: newBadgeKeys, equippedTitle: best };
}
