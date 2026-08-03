import { createClient } from "@/lib/supabase/server";
import { localDate } from "@/lib/dates";
import {
  buildContributionCalendar,
  consistencyPct,
  streakFromDates,
  categoryTotals,
  categoryActiveDays,
  personalBests,
  dailyXpTrend,
  type ContributionCalendar,
} from "@/lib/analytics";

/** Heatmap window (weeks). ~14 weeks ≈ a season's worth of activity. */
const HEATMAP_WEEKS = 14;
const XP_TREND_DAYS = 30;

function daysBack(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export type CategoryStat = {
  category: string;
  value: number;
  activeDays: number;
};

export type PersonalBest = {
  habitId: string;
  name: string;
  unit: string;
  category: string;
  best: number;
};

export type PlayerAnalytics = {
  today: string;
  calendar: ContributionCalendar;
  consistency30: number;
  consistency90: number;
  activeDays: number;
  streak: { current: number; longest: number };
  categories: CategoryStat[];
  personalBests: PersonalBest[];
  xpTrend: { date: string; xp: number }[];
  windowXp: number;
};

/**
 * Loads and shapes a single player's activity into the pure analytics
 * transforms in `analytics.ts`. Reusable for the owner's `/analytics` page and
 * public friend profiles (RLS lets group-mates read each other's logs).
 */
export async function getPlayerAnalytics(
  userId: string,
  tz: string,
): Promise<PlayerAnalytics> {
  const supabase = await createClient();
  const today = localDate(tz);
  // A little extra range so the Sunday-aligned heatmap grid is fully covered.
  const logStart = daysBack(today, HEATMAP_WEEKS * 7);
  const scoreStart = daysBack(today, 90);

  const [{ data: habits }, { data: logs }, { data: scores }] =
    await Promise.all([
      supabase
        .from("habits")
        .select("id, name, unit, category")
        .eq("user_id", userId),
      supabase
        .from("habit_logs")
        .select("habit_id, log_date, value")
        .eq("user_id", userId)
        .gte("log_date", logStart)
        .lte("log_date", today),
      supabase
        .from("daily_scores")
        .select("date, xp_earned")
        .eq("user_id", userId)
        .gte("date", scoreStart)
        .lte("date", today),
    ]);

  const meta = new Map<
    string,
    { name: string; unit: string; category: string }
  >();
  for (const h of habits ?? []) {
    meta.set(h.id as string, {
      name: h.name as string,
      unit: h.unit as string,
      category: h.category as string,
    });
  }

  const rows = (logs ?? []).map((l) => ({
    habitId: l.habit_id as string,
    date: l.log_date as string,
    value: Number(l.value) || 0,
  }));

  const calendar = buildContributionCalendar(
    rows.map((l) => ({ date: l.date, value: l.value })),
    { endDate: today, weeks: HEATMAP_WEEKS },
  );

  const activeDates = Array.from(
    new Set(rows.filter((l) => l.value > 0).map((l) => l.date)),
  );

  const catEntries = rows.map((l) => ({
    category: meta.get(l.habitId)?.category ?? "custom",
    date: l.date,
    value: l.value,
  }));
  const totals = categoryTotals(catEntries);
  const activeByCat = categoryActiveDays(catEntries);

  const bests = personalBests(
    rows.map((l) => ({ habitId: l.habitId, value: l.value })),
  );

  const xpRows = (scores ?? []).map((s) => ({
    date: s.date as string,
    xp: Number(s.xp_earned) || 0,
  }));

  return {
    today,
    calendar,
    consistency30: consistencyPct(activeDates, {
      endDate: today,
      windowDays: 30,
    }),
    consistency90: consistencyPct(activeDates, {
      endDate: today,
      windowDays: 90,
    }),
    activeDays: activeDates.length,
    streak: streakFromDates(activeDates, today),
    categories: Object.entries(totals)
      .map(([category, value]) => ({
        category,
        value,
        activeDays: activeByCat[category] ?? 0,
      }))
      .sort((a, b) => b.value - a.value),
    personalBests: Object.entries(bests)
      .map(([habitId, best]) => ({
        habitId,
        best,
        name: meta.get(habitId)?.name ?? "Quest",
        unit: meta.get(habitId)?.unit ?? "",
        category: meta.get(habitId)?.category ?? "custom",
      }))
      .filter((p) => p.best > 0)
      .sort((a, b) => b.best - a.best),
    xpTrend: dailyXpTrend(xpRows, { endDate: today, days: XP_TREND_DAYS }),
    windowXp: xpRows.reduce((s, r) => s + r.xp, 0),
  };
}
