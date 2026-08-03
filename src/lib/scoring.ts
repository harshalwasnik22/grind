import { clamp } from "./utils";

/**
 * GRIND scoring & gamification engine.
 *
 * Pure functions only — no DB / network / React imports — so the correctness
 * of XP, levels, streaks and badge rules is trivially unit-testable. Server
 * actions call into this on every habit log; crons call it at day finalize.
 *
 * All constants live at the top so game balance can be tuned in one place.
 */

// --- Tunable constants ------------------------------------------------------
export const BASE_XP_DEFAULT = 100;
export const MAX_LEVEL = 50;
export const STREAK_STEP = 0.05; // +5% per streak day...
export const STREAK_CAP = 0.5; // ...up to +50%
export const OVERACHIEVER_BONUS = 0.1; // +10% base for hitting/beating target
export const LEVEL_DIVISOR = 250; // level curve: xp(L) = DIVISOR * (L-1)^2

// --- XP ---------------------------------------------------------------------

/**
 * XP earned for a single habit on a single day.
 *
 * Partial credit proportional to progress toward the target, plus a flat
 * overachiever bonus when the target is met or beaten (bonus is not stacked
 * for overshooting — beyond target earns no extra credit, preventing grinding).
 *
 * - value <= 0            → 0
 * - target <= 0 (binary)  → done? baseXp + bonus : 0
 */
export function computeHabitXp(
  value: number,
  target: number,
  baseXp: number = BASE_XP_DEFAULT,
): number {
  if (!Number.isFinite(value) || value <= 0) return 0;

  const bonus = Math.round(OVERACHIEVER_BONUS * baseXp);

  // Binary habit (no meaningful numeric target): treat as done/not-done.
  if (!Number.isFinite(target) || target <= 0) {
    return value >= 1 ? baseXp + bonus : 0;
  }

  const hitRatio = clamp(Math.min(value, target) / target, 0, 1);
  const base = Math.round(hitRatio * baseXp);
  return base + (value >= target ? bonus : 0);
}

/** Streak multiplier applied to the day's total XP: 1 + 5%/day, capped +50%. */
export function streakMultiplier(streak: number): number {
  const s = Math.max(streak, 0);
  return 1 + Math.min(s * STREAK_STEP, STREAK_CAP);
}

export type HabitEntry = { value: number; target: number; baseXp?: number };

/** Total XP for a day: sum of habit XP, scaled by the streak multiplier. */
export function computeDailyXp(entries: HabitEntry[], streak: number): number {
  const raw = entries.reduce(
    (sum, e) => sum + computeHabitXp(e.value, e.target, e.baseXp),
    0,
  );
  return Math.round(raw * streakMultiplier(streak));
}

// --- Levels & prestige ------------------------------------------------------

/** Level for a given cumulative XP. Inverse of {@link xpForLevel}. Capped. */
export function levelForXp(totalXp: number): number {
  const xp = Math.max(totalXp, 0);
  const level = Math.floor(Math.sqrt(xp / LEVEL_DIVISOR)) + 1;
  return Math.min(level, MAX_LEVEL);
}

/** Cumulative XP required to *reach* a level. level <= 1 → 0. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return LEVEL_DIVISOR * (level - 1) ** 2;
}

export type LevelProgress = {
  level: number;
  prestigeReady: boolean;
  currentLevelStart: number;
  nextLevelAt: number | null;
  intoLevel: number;
  span: number;
  pct: number; // 0..100 toward next level
};

/** Rich progress info for rendering the XP bar. */
export function levelProgress(totalXp: number): LevelProgress {
  const xp = Math.max(totalXp, 0);
  const level = levelForXp(xp);
  const currentLevelStart = xpForLevel(level);
  const intoLevel = xp - currentLevelStart;

  if (level >= MAX_LEVEL) {
    return {
      level,
      prestigeReady: true,
      currentLevelStart,
      nextLevelAt: null,
      intoLevel,
      span: 0,
      pct: 100,
    };
  }

  const nextLevelAt = xpForLevel(level + 1);
  const span = nextLevelAt - currentLevelStart;
  const pct = clamp((intoLevel / span) * 100, 0, 100);
  return {
    level,
    prestigeReady: false,
    currentLevelStart,
    nextLevelAt,
    intoLevel,
    span,
    pct,
  };
}

export type PrestigeState = {
  totalXp: number;
  currentLevel: number;
  prestigeLevel: number;
};

/**
 * Prestige: reset to level 1 / 0 XP and bump prestige rank. Badges/titles are
 * kept by the caller. Throws if not yet at MAX_LEVEL (callers should gate on
 * {@link LevelProgress.prestigeReady}).
 */
export function applyPrestige(profile: PrestigeState): PrestigeState {
  if (profile.currentLevel < MAX_LEVEL) {
    throw new Error(
      `Cannot prestige below max level (${profile.currentLevel} < ${MAX_LEVEL})`,
    );
  }
  return {
    totalXp: 0,
    currentLevel: 1,
    prestigeLevel: profile.prestigeLevel + 1,
  };
}

// --- Streaks ----------------------------------------------------------------

export type StreakInput = {
  currentStreak: number;
  hitToday: boolean;
  wasRestDay: boolean;
  freezeAvailable: boolean;
};

export type StreakResult = {
  streak: number;
  freezeUsed: boolean;
  broke: boolean;
};

/**
 * Advance a streak for one finalized day. Priority: a hit extends the streak;
 * a planned rest day preserves it for free; otherwise a freeze (if available)
 * preserves it; else the streak breaks.
 */
export function nextStreak({
  currentStreak,
  hitToday,
  wasRestDay,
  freezeAvailable,
}: StreakInput): StreakResult {
  if (hitToday) {
    return { streak: currentStreak + 1, freezeUsed: false, broke: false };
  }
  if (wasRestDay) {
    return { streak: currentStreak, freezeUsed: false, broke: false };
  }
  if (freezeAvailable) {
    return { streak: currentStreak, freezeUsed: true, broke: false };
  }
  return { streak: 0, freezeUsed: false, broke: true };
}

// --- Badges & titles --------------------------------------------------------

export type BadgeRule =
  | { type: "streak_at_least"; days: number }
  | { type: "perfect_week" }
  | { type: "category_total_at_least"; category: string; count: number }
  | { type: "level_at_least"; level: number }
  | { type: "season_rank"; rank: number }
  | { type: "first_log" };

export type BadgeContext = {
  currentStreak: number;
  level: number;
  perfectWeek: boolean;
  categoryTotals: Record<string, number>;
  seasonRank: number | null;
  totalLogs: number;
  alreadyEarned: Set<string>;
};

/** Whether a single rule is satisfied by the current context. */
export function ruleSatisfied(rule: BadgeRule, ctx: BadgeContext): boolean {
  switch (rule.type) {
    case "streak_at_least":
      return ctx.currentStreak >= rule.days;
    case "perfect_week":
      return ctx.perfectWeek;
    case "category_total_at_least":
      return (ctx.categoryTotals[rule.category] ?? 0) >= rule.count;
    case "level_at_least":
      return ctx.level >= rule.level;
    case "season_rank":
      return ctx.seasonRank !== null && ctx.seasonRank <= rule.rank;
    case "first_log":
      return ctx.totalLogs >= 1;
  }
}

/** Keys of badges/titles newly satisfied and not yet earned. */
export function evaluateBadges(
  rules: Array<{ key: string; rule: BadgeRule }>,
  ctx: BadgeContext,
): string[] {
  return rules
    .filter(
      ({ key, rule }) => !ctx.alreadyEarned.has(key) && ruleSatisfied(rule, ctx),
    )
    .map(({ key }) => key);
}

/**
 * Default equippable title for a player's standing. Prestige rank always wins;
 * otherwise a level tier. Purely cosmetic — unlockable titles from badges are
 * layered on top by the caller.
 */
export function titleForLevel(level: number, prestigeLevel = 0): string {
  if (prestigeLevel > 0) return `PRESTIGE ★${prestigeLevel}`;
  if (level >= 40) return "GRINDLORD";
  if (level >= 25) return "VETERAN";
  if (level >= 10) return "ADEPT";
  if (level >= 5) return "APPRENTICE";
  return "ROOKIE";
}
