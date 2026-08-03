import { describe, it, expect } from "vitest";
import { rankScores, pickWagerLoser, resolveStreakForCron } from "./finalize";

describe("rankScores", () => {
  it("ranks highest score first", () => {
    const ranked = rankScores([
      { userId: "a", score: 300 },
      { userId: "b", score: 100 },
      { userId: "c", score: 200 },
    ]);
    expect(ranked.map((r) => [r.userId, r.rank])).toEqual([
      ["a", 1],
      ["c", 2],
      ["b", 3],
    ]);
  });

  it("gives tied scores the same rank and skips the next", () => {
    const ranked = rankScores([
      { userId: "a", score: 100 },
      { userId: "b", score: 100 },
      { userId: "c", score: 50 },
    ]);
    const byUser = Object.fromEntries(ranked.map((r) => [r.userId, r.rank]));
    expect(byUser).toEqual({ a: 1, b: 1, c: 3 });
  });

  it("handles an empty list", () => {
    expect(rankScores([])).toEqual([]);
  });
});

describe("pickWagerLoser", () => {
  it("returns null for an empty list", () => {
    expect(pickWagerLoser([])).toBeNull();
  });

  it("returns the strictly-lowest scorer", () => {
    const ranked = rankScores([
      { userId: "a", score: 300 },
      { userId: "b", score: 100 },
    ]);
    expect(pickWagerLoser(ranked)).toBe("b");
  });

  it("returns null when everyone is tied", () => {
    const ranked = rankScores([
      { userId: "a", score: 100 },
      { userId: "b", score: 100 },
    ]);
    expect(pickWagerLoser(ranked)).toBeNull();
  });

  it("returns null on a tie for last place", () => {
    const ranked = rankScores([
      { userId: "a", score: 300 },
      { userId: "b", score: 50 },
      { userId: "c", score: 50 },
    ]);
    expect(pickWagerLoser(ranked)).toBeNull();
  });
});

describe("resolveStreakForCron", () => {
  const base = { wasRestDay: false, freezeAvailable: false, currentStreak: 5 };

  it("extends the streak on a hit", () => {
    expect(resolveStreakForCron({ ...base, hitOnDay: true })).toEqual({
      streak: 6,
      freezeUsed: false,
      broke: false,
    });
  });

  it("preserves the streak on a rest day", () => {
    expect(
      resolveStreakForCron({ ...base, hitOnDay: false, wasRestDay: true }),
    ).toEqual({ streak: 5, freezeUsed: false, broke: false });
  });

  it("consumes a freeze when no hit and not a rest day", () => {
    expect(
      resolveStreakForCron({ ...base, hitOnDay: false, freezeAvailable: true }),
    ).toEqual({ streak: 5, freezeUsed: true, broke: false });
  });

  it("breaks the streak when nothing protects it", () => {
    expect(resolveStreakForCron({ ...base, hitOnDay: false })).toEqual({
      streak: 0,
      freezeUsed: false,
      broke: true,
    });
  });
});
