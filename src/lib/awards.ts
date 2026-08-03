/**
 * Pure badge/title award evaluation. Criteria/rules mirror the jsonb shapes
 * seeded in 0006_seed.sql. Kept dependency-free so it's unit-testable.
 */

export type BadgeCriteria =
  | { type: "first_log" }
  | { type: "streak_at_least"; days: number }
  | { type: "perfect_week" }
  | { type: "category_total_at_least"; category: string; count: number }
  | { type: "category_days_at_least"; category: string; days: number }
  | { type: "level_at_least"; level: number }
  | { type: "season_rank"; rank: number };

export type TitleRule =
  | { type: "level_at_least"; level: number }
  | { type: "prestige_at_least"; prestige: number }
  | { type: "season_rank"; rank: number };

export type AwardContext = {
  totalLogs: number;
  currentStreak: number;
  level: number;
  prestige: number;
  perfectWeek: boolean;
  categoryTotals: Record<string, number>;
  categoryDays: Record<string, number>;
  /** null when a season rank isn't being evaluated (e.g. at log time). */
  seasonRank: number | null;
};

export function badgeSatisfied(c: BadgeCriteria, ctx: AwardContext): boolean {
  switch (c.type) {
    case "first_log":
      return ctx.totalLogs >= 1;
    case "streak_at_least":
      return ctx.currentStreak >= c.days;
    case "perfect_week":
      return ctx.perfectWeek;
    case "category_total_at_least":
      return (ctx.categoryTotals[c.category] ?? 0) >= c.count;
    case "category_days_at_least":
      return (ctx.categoryDays[c.category] ?? 0) >= c.days;
    case "level_at_least":
      return ctx.level >= c.level;
    case "season_rank":
      return ctx.seasonRank != null && ctx.seasonRank <= c.rank;
    default:
      return false;
  }
}

export function titleSatisfied(r: TitleRule, ctx: AwardContext): boolean {
  switch (r.type) {
    case "level_at_least":
      return ctx.level >= r.level;
    case "prestige_at_least":
      return ctx.prestige >= r.prestige;
    case "season_rank":
      return ctx.seasonRank != null && ctx.seasonRank <= r.rank;
    default:
      return false;
  }
}

/** Badge keys newly satisfied (excluding already-earned). */
export function evaluateBadgeKeys(
  badges: { key: string; criteria: BadgeCriteria }[],
  ctx: AwardContext,
  already: Set<string>,
): string[] {
  return badges
    .filter((b) => !already.has(b.key) && badgeSatisfied(b.criteria, ctx))
    .map((b) => b.key);
}

/** Title keys newly satisfied (excluding already-unlocked). */
export function evaluateTitleKeys(
  titles: { key: string; unlock_rule: TitleRule }[],
  ctx: AwardContext,
  already: Set<string>,
): string[] {
  return titles
    .filter((t) => !already.has(t.key) && titleSatisfied(t.unlock_rule, ctx))
    .map((t) => t.key);
}

/** Priority of a title for auto-equipping the "best" one a player holds. */
export function titlePriority(rule: TitleRule): number {
  switch (rule.type) {
    case "season_rank":
      return 4000;
    case "prestige_at_least":
      return 3000 + rule.prestige;
    case "level_at_least":
      return rule.level;
    default:
      return 0;
  }
}

/** From the player's UNLOCKED titles, choose the highest-priority display name. */
export function pickEquippableTitle(
  unlocked: { name: string; unlock_rule: TitleRule }[],
): string | null {
  let best: { name: string; score: number } | null = null;
  for (const t of unlocked) {
    const score = titlePriority(t.unlock_rule);
    if (!best || score > best.score) best = { name: t.name, score };
  }
  return best?.name ?? null;
}
