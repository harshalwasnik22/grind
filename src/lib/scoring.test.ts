import { describe, it, expect } from "vitest";
import {
  BASE_XP_DEFAULT,
  MAX_LEVEL,
  computeHabitXp,
  streakMultiplier,
  computeDailyXp,
  levelForXp,
  xpForLevel,
  levelProgress,
  applyPrestige,
  nextStreak,
  ruleSatisfied,
  evaluateBadges,
  titleForLevel,
  type BadgeContext,
  type BadgeRule,
} from "./scoring";

describe("computeHabitXp", () => {
  it("gives partial credit proportional to progress", () => {
    expect(computeHabitXp(1, 2)).toBe(50); // 0.5 * 100, no bonus
  });

  it("adds the overachiever bonus when the target is met exactly", () => {
    expect(computeHabitXp(2, 2)).toBe(110); // 100 + 10
  });

  it("caps credit at the target when overshooting", () => {
    expect(computeHabitXp(4, 2)).toBe(110); // capped base 100 + 10 bonus
    expect(computeHabitXp(100, 2)).toBe(110);
  });

  it("returns 0 for zero or negative progress", () => {
    expect(computeHabitXp(0, 2)).toBe(0);
    expect(computeHabitXp(-5, 2)).toBe(0);
  });

  it("treats a non-positive target as a binary done/not-done habit", () => {
    expect(computeHabitXp(1, 0)).toBe(110); // done → base + bonus
    expect(computeHabitXp(3, 0)).toBe(110);
    expect(computeHabitXp(0.5, 0)).toBe(0); // <1 → not done
  });

  it("rounds fractional XP", () => {
    expect(computeHabitXp(1, 3)).toBe(33); // 33.33 → 33
    expect(computeHabitXp(2, 3)).toBe(67); // 66.67 → 67
  });

  it("honours a custom baseXp", () => {
    expect(computeHabitXp(1, 2, 200)).toBe(100); // 0.5 * 200
    expect(computeHabitXp(2, 2, 200)).toBe(220); // 200 + 20
  });

  it("never returns a negative number", () => {
    expect(computeHabitXp(-100, 2, 100)).toBeGreaterThanOrEqual(0);
  });
});

describe("streakMultiplier", () => {
  it("is 1x with no streak", () => {
    expect(streakMultiplier(0)).toBe(1);
  });

  it("grows 5% per day", () => {
    expect(streakMultiplier(5)).toBeCloseTo(1.25);
  });

  it("caps at +50%", () => {
    expect(streakMultiplier(10)).toBeCloseTo(1.5);
    expect(streakMultiplier(20)).toBeCloseTo(1.5);
    expect(streakMultiplier(999)).toBeCloseTo(1.5);
  });

  it("treats negative streaks as zero", () => {
    expect(streakMultiplier(-3)).toBe(1);
  });
});

describe("computeDailyXp", () => {
  it("sums habit XP and applies the streak multiplier", () => {
    // DSA 2/2 (110) + Gym 1/1 (110) = 220, * 1.25 (streak 5) = 275
    const entries = [
      { value: 2, target: 2 },
      { value: 1, target: 1 },
    ];
    expect(computeDailyXp(entries, 5)).toBe(275);
  });

  it("returns 0 for an empty day", () => {
    expect(computeDailyXp([], 10)).toBe(0);
  });

  it("respects per-entry baseXp", () => {
    expect(computeDailyXp([{ value: 1, target: 2, baseXp: 200 }], 0)).toBe(100);
  });
});

describe("levelForXp / xpForLevel", () => {
  it("starts everyone at level 1", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(-100)).toBe(1);
  });

  it("crosses thresholds at the documented points", () => {
    expect(levelForXp(249)).toBe(1);
    expect(levelForXp(250)).toBe(2);
    expect(levelForXp(999)).toBe(2);
    expect(levelForXp(1000)).toBe(3);
  });

  it("xpForLevel is 0 for level <= 1", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(0)).toBe(0);
    expect(xpForLevel(-4)).toBe(0);
  });

  it("round-trips levelForXp(xpForLevel(L)) === L for all levels", () => {
    for (let L = 1; L <= MAX_LEVEL; L++) {
      expect(levelForXp(xpForLevel(L))).toBe(L);
    }
  });

  it("caps at MAX_LEVEL", () => {
    expect(levelForXp(xpForLevel(MAX_LEVEL) * 100)).toBe(MAX_LEVEL);
    expect(levelForXp(Number.MAX_SAFE_INTEGER)).toBe(MAX_LEVEL);
  });
});

describe("levelProgress", () => {
  it("reports 0% at the exact start of a level", () => {
    const p = levelProgress(250); // exactly level 2
    expect(p.level).toBe(2);
    expect(p.intoLevel).toBe(0);
    expect(p.pct).toBe(0);
    expect(p.nextLevelAt).toBe(1000);
    expect(p.prestigeReady).toBe(false);
  });

  it("keeps pct within [0, 100]", () => {
    for (const xp of [0, 1, 249, 250, 700, 1000, 5000, 100000]) {
      const p = levelProgress(xp);
      expect(p.pct).toBeGreaterThanOrEqual(0);
      expect(p.pct).toBeLessThanOrEqual(100);
    }
  });

  it("flags prestige readiness and null next level at MAX_LEVEL", () => {
    const p = levelProgress(xpForLevel(MAX_LEVEL));
    expect(p.level).toBe(MAX_LEVEL);
    expect(p.nextLevelAt).toBeNull();
    expect(p.pct).toBe(100);
    expect(p.prestigeReady).toBe(true);
  });

  it("reports ~50% halfway through a level span", () => {
    // level 2 span is [250, 1000), midpoint 625
    const p = levelProgress(625);
    expect(p.level).toBe(2);
    expect(p.pct).toBeCloseTo(50, 0);
  });
});

describe("applyPrestige", () => {
  it("resets XP/level and bumps prestige when at max level", () => {
    const out = applyPrestige({
      totalXp: 999999,
      currentLevel: MAX_LEVEL,
      prestigeLevel: 1,
    });
    expect(out).toEqual({ totalXp: 0, currentLevel: 1, prestigeLevel: 2 });
  });

  it("throws below max level", () => {
    expect(() =>
      applyPrestige({ totalXp: 100, currentLevel: 49, prestigeLevel: 0 }),
    ).toThrow();
  });
});

describe("nextStreak", () => {
  const base = {
    currentStreak: 7,
    hitToday: false,
    wasRestDay: false,
    freezeAvailable: false,
  };

  it("extends the streak on a hit", () => {
    expect(nextStreak({ ...base, hitToday: true })).toEqual({
      streak: 8,
      freezeUsed: false,
      broke: false,
    });
  });

  it("preserves the streak for free on a rest day", () => {
    expect(nextStreak({ ...base, wasRestDay: true })).toEqual({
      streak: 7,
      freezeUsed: false,
      broke: false,
    });
  });

  it("consumes a freeze to preserve the streak on a miss", () => {
    expect(nextStreak({ ...base, freezeAvailable: true })).toEqual({
      streak: 7,
      freezeUsed: true,
      broke: false,
    });
  });

  it("breaks the streak on a bare miss", () => {
    expect(nextStreak(base)).toEqual({
      streak: 0,
      freezeUsed: false,
      broke: true,
    });
  });

  it("prefers a hit over rest day / freeze", () => {
    const r = nextStreak({
      currentStreak: 3,
      hitToday: true,
      wasRestDay: true,
      freezeAvailable: true,
    });
    expect(r.streak).toBe(4);
    expect(r.freezeUsed).toBe(false);
  });
});

describe("ruleSatisfied / evaluateBadges", () => {
  const ctx: BadgeContext = {
    currentStreak: 7,
    level: 12,
    perfectWeek: true,
    categoryTotals: { dsa: 120, gym: 4 },
    seasonRank: 1,
    totalLogs: 30,
    alreadyEarned: new Set<string>(),
  };

  const cases: Array<[string, BadgeRule, boolean]> = [
    ["streak true", { type: "streak_at_least", days: 7 }, true],
    ["streak false", { type: "streak_at_least", days: 8 }, false],
    ["perfect_week true", { type: "perfect_week" }, true],
    ["level true", { type: "level_at_least", level: 10 }, true],
    ["level false", { type: "level_at_least", level: 20 }, false],
    [
      "category true",
      { type: "category_total_at_least", category: "dsa", count: 100 },
      true,
    ],
    [
      "category false (below)",
      { type: "category_total_at_least", category: "gym", count: 20 },
      false,
    ],
    [
      "category false (missing)",
      { type: "category_total_at_least", category: "yoga", count: 1 },
      false,
    ],
    ["season_rank true (champion)", { type: "season_rank", rank: 1 }, true],
    ["season_rank true (top 3)", { type: "season_rank", rank: 3 }, true],
    ["first_log true", { type: "first_log" }, true],
  ];

  for (const [name, rule, expected] of cases) {
    it(`ruleSatisfied: ${name}`, () => {
      expect(ruleSatisfied(rule, ctx)).toBe(expected);
    });
  }

  it("perfect_week false when not achieved", () => {
    expect(ruleSatisfied({ type: "perfect_week" }, { ...ctx, perfectWeek: false })).toBe(
      false,
    );
  });

  it("season_rank false when unranked", () => {
    expect(
      ruleSatisfied({ type: "season_rank", rank: 1 }, { ...ctx, seasonRank: null }),
    ).toBe(false);
  });

  it("first_log false with no logs", () => {
    expect(ruleSatisfied({ type: "first_log" }, { ...ctx, totalLogs: 0 })).toBe(false);
  });

  it("returns only newly-satisfied, not-yet-earned keys", () => {
    const rules = [
      { key: "streak-7", rule: { type: "streak_at_least", days: 7 } as BadgeRule },
      { key: "champion", rule: { type: "season_rank", rank: 1 } as BadgeRule },
      { key: "level-20", rule: { type: "level_at_least", level: 20 } as BadgeRule },
    ];
    const earned = evaluateBadges(rules, {
      ...ctx,
      alreadyEarned: new Set(["streak-7"]),
    });
    expect(earned).toEqual(["champion"]); // streak already earned, level-20 not met
  });
});

describe("titleForLevel", () => {
  it("prestige rank always wins", () => {
    expect(titleForLevel(3, 2)).toBe("PRESTIGE ★2");
  });

  it("tiers by level", () => {
    expect(titleForLevel(1)).toBe("ROOKIE");
    expect(titleForLevel(5)).toBe("APPRENTICE");
    expect(titleForLevel(10)).toBe("ADEPT");
    expect(titleForLevel(25)).toBe("VETERAN");
    expect(titleForLevel(40)).toBe("GRINDLORD");
  });
});

describe("exports sanity", () => {
  it("exposes the tunable base xp constant", () => {
    expect(BASE_XP_DEFAULT).toBe(100);
  });
});
