"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeDailyXp, levelForXp } from "@/lib/scoring";
import { localDate, previousDate, weekdayOf } from "@/lib/dates";
import { syncAwards } from "@/lib/awards-server";

export type LogResult =
  | { ok: true; xp: number; level: number; streak: number; newBadges: string[] }
  | { ok: false; error: string };

/**
 * Logs progress on a habit for today, recomputes the day score, and updates the
 * player's XP / level / streak plus any newly-earned badges & titles.
 *
 * - habit_logs: one accumulating row per (habit, day)
 * - daily_scores: recomputed for the day from all scheduled habits
 * - profiles.total_xp: adjusted by the day's XP delta (prestige-safe, since
 *   prestige resets total_xp to 0 without a full re-sum undoing it)
 * - streak: increments on the first target hit of the day (breaks via cron)
 */
export async function logHabit(
  habitId: string,
  value: number,
): Promise<LogResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const userId = user.id;

  const { data: habit } = await supabase
    .from("habits")
    .select("id, group_id")
    .eq("id", habitId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!habit) return { ok: false, error: "Quest not found." };
  const groupId = habit.group_id as string | null;
  if (!groupId) return { ok: false, error: "Join a squad first." };

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "timezone, current_streak, longest_streak, last_active_date, total_xp, prestige_level",
    )
    .eq("id", userId)
    .single();

  const tz = profile?.timezone ?? "UTC";
  const today = localDate(tz);
  const yesterday = previousDate(today);
  const weekday = weekdayOf(today);

  // Upsert today's log for this habit.
  const v = Math.max(0, Number(value) || 0);
  const { error: logErr } = await supabase
    .from("habit_logs")
    .upsert(
      { habit_id: habitId, user_id: userId, log_date: today, value: v },
      { onConflict: "habit_id,log_date" },
    );
  if (logErr) return { ok: false, error: logErr.message };

  // Gather habits scheduled today and their current values.
  const { data: habits } = await supabase
    .from("habits")
    .select("id, daily_target, base_xp, schedule")
    .eq("user_id", userId)
    .is("archived_at", null);

  const scheduled = (habits ?? []).filter(
    (h) => Array.isArray(h.schedule) && h.schedule.includes(weekday),
  );
  const ids = scheduled.map((h) => h.id);

  const logMap = new Map<string, number>();
  if (ids.length > 0) {
    const { data: logs } = await supabase
      .from("habit_logs")
      .select("habit_id, value")
      .eq("user_id", userId)
      .eq("log_date", today)
      .in("habit_id", ids);
    for (const l of logs ?? []) logMap.set(l.habit_id as string, Number(l.value));
  }

  const entries = scheduled.map((h) => ({
    value: logMap.get(h.id) ?? 0,
    target: Number(h.daily_target),
    baseXp: h.base_xp as number,
  }));
  const targetsHit = entries.filter(
    (e) => e.target > 0 && e.value >= e.target,
  ).length;
  const hitToday = targetsHit >= 1;

  // Streak: bump once on the first target hit of the day.
  let currentStreak = profile?.current_streak ?? 0;
  let longestStreak = profile?.longest_streak ?? 0;
  let lastActive = (profile?.last_active_date as string | null) ?? null;
  if (hitToday && lastActive !== today) {
    currentStreak = lastActive === yesterday ? currentStreak + 1 : 1;
    lastActive = today;
    longestStreak = Math.max(longestStreak, currentStreak);
  }

  // Previous day XP (for the incremental total adjustment).
  const { data: prevScore } = await supabase
    .from("daily_scores")
    .select("xp_earned")
    .eq("user_id", userId)
    .eq("group_id", groupId)
    .eq("date", today)
    .maybeSingle();
  const prevXp = prevScore?.xp_earned ?? 0;

  const xp = computeDailyXp(entries, currentStreak);

  const { data: rest } = await supabase
    .from("rest_days")
    .select("date")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();

  const { error: dsErr } = await supabase.from("daily_scores").upsert(
    {
      user_id: userId,
      group_id: groupId,
      date: today,
      xp_earned: xp,
      targets_hit: targetsHit,
      habits_total: scheduled.length,
      was_rest_day: Boolean(rest),
    },
    { onConflict: "user_id,group_id,date" },
  );
  if (dsErr) return { ok: false, error: dsErr.message };

  const totalXp = Math.max(0, (profile?.total_xp ?? 0) + (xp - prevXp));
  const level = levelForXp(totalXp);

  await supabase
    .from("profiles")
    .update({
      total_xp: totalXp,
      current_level: level,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      last_active_date: lastActive,
    })
    .eq("id", userId);

  const { newBadges } = await syncAwards(supabase, userId, {
    level,
    currentStreak,
    prestige: profile?.prestige_level ?? 0,
    groupId,
    today,
  });

  revalidatePath("/");
  return { ok: true, xp, level, streak: currentStreak, newBadges };
}
