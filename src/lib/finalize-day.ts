export type DailyFinalizeInput = {
  hitYesterday: boolean;
  restYesterday: boolean;
  freezes: number;
  currentStreak: number;
};

export type DailyFinalizeOutcome = "ok" | "freeze_used" | "protected" | "broken";

export type DailyFinalizeResult = {
  newStreak: number;
  newFreezes: number;
  outcome: DailyFinalizeOutcome;
};

/**
 * Decides what happens to a player's streak when the day that just ended
 * ("yesterday") is finalized by the daily cron.
 *
 * - hit a target yesterday → nothing to do (streak advanced at log time)
 * - planned rest day → streak protected
 * - a freeze available → consume one, streak protected
 * - otherwise → streak breaks to 0
 */
export function decideDailyFinalize(
  input: DailyFinalizeInput,
): DailyFinalizeResult {
  const { hitYesterday, restYesterday, freezes, currentStreak } = input;

  if (hitYesterday) {
    return { newStreak: currentStreak, newFreezes: freezes, outcome: "ok" };
  }
  if (restYesterday) {
    return {
      newStreak: currentStreak,
      newFreezes: freezes,
      outcome: "protected",
    };
  }
  if (freezes > 0) {
    return {
      newStreak: currentStreak,
      newFreezes: freezes - 1,
      outcome: "freeze_used",
    };
  }
  if (currentStreak > 0) {
    return { newStreak: 0, newFreezes: freezes, outcome: "broken" };
  }
  return { newStreak: currentStreak, newFreezes: freezes, outcome: "ok" };
}
