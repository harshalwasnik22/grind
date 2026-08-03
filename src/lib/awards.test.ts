import { describe, it, expect } from "vitest";
import {
  badgeSatisfied,
  titleSatisfied,
  evaluateBadgeKeys,
  evaluateTitleKeys,
  pickEquippableTitle,
  type AwardContext,
} from "./awards";

const base: AwardContext = {
  totalLogs: 0,
  currentStreak: 0,
  level: 1,
  prestige: 0,
  perfectWeek: false,
  categoryTotals: {},
  categoryDays: {},
  seasonRank: null,
};

describe("badgeSatisfied", () => {
  it("first_log needs at least one log", () => {
    expect(badgeSatisfied({ type: "first_log" }, base)).toBe(false);
    expect(badgeSatisfied({ type: "first_log" }, { ...base, totalLogs: 1 })).toBe(
      true,
    );
  });

  it("streak_at_least compares the current streak", () => {
    const c = { type: "streak_at_least", days: 7 } as const;
    expect(badgeSatisfied(c, { ...base, currentStreak: 6 })).toBe(false);
    expect(badgeSatisfied(c, { ...base, currentStreak: 7 })).toBe(true);
  });

  it("category_total_at_least sums by category", () => {
    const c = {
      type: "category_total_at_least",
      category: "dsa",
      count: 100,
    } as const;
    expect(badgeSatisfied(c, { ...base, categoryTotals: { dsa: 99 } })).toBe(
      false,
    );
    expect(badgeSatisfied(c, { ...base, categoryTotals: { dsa: 100 } })).toBe(
      true,
    );
  });

  it("category_days_at_least counts distinct days", () => {
    const c = {
      type: "category_days_at_least",
      category: "learning",
      days: 30,
    } as const;
    expect(
      badgeSatisfied(c, { ...base, categoryDays: { learning: 30 } }),
    ).toBe(true);
    expect(
      badgeSatisfied(c, { ...base, categoryDays: { learning: 29 } }),
    ).toBe(false);
  });

  it("level_at_least and perfect_week", () => {
    expect(badgeSatisfied({ type: "level_at_least", level: 10 }, { ...base, level: 10 })).toBe(true);
    expect(badgeSatisfied({ type: "perfect_week" }, { ...base, perfectWeek: true })).toBe(true);
  });

  it("season_rank requires a known rank at or above the threshold", () => {
    const c = { type: "season_rank", rank: 1 } as const;
    expect(badgeSatisfied(c, base)).toBe(false); // null rank
    expect(badgeSatisfied(c, { ...base, seasonRank: 1 })).toBe(true);
    expect(badgeSatisfied(c, { ...base, seasonRank: 2 })).toBe(false);
  });
});

describe("titleSatisfied", () => {
  it("handles level, prestige and season rank", () => {
    expect(titleSatisfied({ type: "level_at_least", level: 5 }, { ...base, level: 5 })).toBe(true);
    expect(titleSatisfied({ type: "prestige_at_least", prestige: 1 }, { ...base, prestige: 1 })).toBe(true);
    expect(titleSatisfied({ type: "prestige_at_least", prestige: 1 }, base)).toBe(false);
  });
});

describe("evaluateBadgeKeys / evaluateTitleKeys", () => {
  it("returns only newly-satisfied keys", () => {
    const badges = [
      { key: "first-blood", criteria: { type: "first_log" } as const },
      { key: "week-streak", criteria: { type: "streak_at_least", days: 7 } as const },
    ];
    const ctx = { ...base, totalLogs: 3, currentStreak: 7 };
    expect(evaluateBadgeKeys(badges, ctx, new Set())).toEqual([
      "first-blood",
      "week-streak",
    ]);
    expect(evaluateBadgeKeys(badges, ctx, new Set(["first-blood"]))).toEqual([
      "week-streak",
    ]);
  });

  it("titles respect already-unlocked", () => {
    const titles = [
      { key: "grindling", unlock_rule: { type: "level_at_least", level: 1 } as const },
      { key: "grinder", unlock_rule: { type: "level_at_least", level: 5 } as const },
    ];
    expect(
      evaluateTitleKeys(titles, { ...base, level: 6 }, new Set(["grindling"])),
    ).toEqual(["grinder"]);
  });
});

describe("pickEquippableTitle", () => {
  it("prefers season > prestige > level", () => {
    const unlocked = [
      { name: "Grinder", unlock_rule: { type: "level_at_least", level: 5 } as const },
      { name: "Grindlord", unlock_rule: { type: "level_at_least", level: 10 } as const },
      { name: "Ascended", unlock_rule: { type: "prestige_at_least", prestige: 1 } as const },
    ];
    expect(pickEquippableTitle(unlocked)).toBe("Ascended");
  });

  it("falls back to the highest level title", () => {
    const unlocked = [
      { name: "Grindling", unlock_rule: { type: "level_at_least", level: 1 } as const },
      { name: "Grindlord", unlock_rule: { type: "level_at_least", level: 10 } as const },
    ];
    expect(pickEquippableTitle(unlocked)).toBe("Grindlord");
  });

  it("returns null when nothing is unlocked", () => {
    expect(pickEquippableTitle([])).toBeNull();
  });
});
