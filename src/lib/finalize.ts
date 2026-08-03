import { nextStreak, type StreakResult } from "./scoring";

/**
 * Cron-time helpers for closing out days and seasons. Pure functions mirroring
 * the SQL in 0008_seasons.sql, so ranking/wager logic is unit-testable and the
 * daily-finalize route can decide streaks without duplicating scoring rules.
 */

export type ScoreEntry = { userId: string; score: number };
export type RankedEntry = { userId: string; score: number; rank: number };

/** Standard competition ranking: highest score = rank 1; ties share a rank. */
export function rankScores(entries: ScoreEntry[]): RankedEntry[] {
  const sorted = [...entries].sort((a, b) => b.score - a.score);
  return sorted.map((e) => ({
    userId: e.userId,
    score: e.score,
    rank: 1 + sorted.filter((o) => o.score > e.score).length,
  }));
}

/**
 * The player on the hook for the wager: the strictly-lowest scorer. Returns
 * null when the minimum score is shared (tie for last) or the list is empty.
 */
export function pickWagerLoser(ranked: RankedEntry[]): string | null {
  if (ranked.length === 0) return null;
  const min = Math.min(...ranked.map((r) => r.score));
  const atMin = ranked.filter((r) => r.score === min);
  return atMin.length === 1 ? atMin[0].userId : null;
}

/** Daily-finalize streak decision (thin wrapper over scoring.nextStreak). */
export function resolveStreakForCron(input: {
  hitOnDay: boolean;
  wasRestDay: boolean;
  freezeAvailable: boolean;
  currentStreak: number;
}): StreakResult {
  return nextStreak({
    currentStreak: input.currentStreak,
    hitToday: input.hitOnDay,
    wasRestDay: input.wasRestDay,
    freezeAvailable: input.freezeAvailable,
  });
}
