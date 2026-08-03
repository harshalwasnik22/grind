import { describe, it, expect } from "vitest";
import { decideDailyFinalize } from "./finalize-day";

describe("decideDailyFinalize", () => {
  it("does nothing when the player hit a target yesterday", () => {
    expect(
      decideDailyFinalize({
        hitYesterday: true,
        restYesterday: false,
        freezes: 2,
        currentStreak: 5,
      }),
    ).toEqual({ newStreak: 5, newFreezes: 2, outcome: "ok" });
  });

  it("protects the streak on a rest day (no freeze spent)", () => {
    expect(
      decideDailyFinalize({
        hitYesterday: false,
        restYesterday: true,
        freezes: 2,
        currentStreak: 5,
      }),
    ).toEqual({ newStreak: 5, newFreezes: 2, outcome: "protected" });
  });

  it("consumes a freeze when available", () => {
    expect(
      decideDailyFinalize({
        hitYesterday: false,
        restYesterday: false,
        freezes: 2,
        currentStreak: 5,
      }),
    ).toEqual({ newStreak: 5, newFreezes: 1, outcome: "freeze_used" });
  });

  it("breaks the streak when nothing protects it", () => {
    expect(
      decideDailyFinalize({
        hitYesterday: false,
        restYesterday: false,
        freezes: 0,
        currentStreak: 5,
      }),
    ).toEqual({ newStreak: 0, newFreezes: 0, outcome: "broken" });
  });

  it("is a no-op when the streak is already 0", () => {
    expect(
      decideDailyFinalize({
        hitYesterday: false,
        restYesterday: false,
        freezes: 0,
        currentStreak: 0,
      }),
    ).toEqual({ newStreak: 0, newFreezes: 0, outcome: "ok" });
  });
});
