import { describe, it, expect } from "vitest";
import {
  buildContributionCalendar,
  consistencyPct,
  streakFromDates,
  categoryTotals,
  categoryActiveDays,
  personalBests,
  dailyXpTrend,
  type HeatCell,
} from "./analytics";

// local date helper for building fixtures
const D = (base: string, n: number): string => {
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const utcDay = (s: string) => new Date(`${s}T00:00:00Z`).getUTCDay();

const END = "2026-08-05";

describe("buildContributionCalendar", () => {
  it("is a rectangular Sunday-aligned grid of the requested width", () => {
    const { grid } = buildContributionCalendar([], { endDate: END, weeks: 13 });
    expect(grid).toHaveLength(13);
    for (const week of grid) {
      expect(week).toHaveLength(7);
      expect(utcDay(week[0].date)).toBe(0); // Sunday
      expect(utcDay(week[6].date)).toBe(6); // Saturday
    }
  });

  it("defaults to 13 weeks and includes the end date in the last week", () => {
    const { grid } = buildContributionCalendar([], { endDate: END });
    expect(grid).toHaveLength(13);
    const lastWeek = grid[grid.length - 1];
    expect(lastWeek.some((c) => c.date === END)).toBe(true);
  });

  it("sums per-day totals and quantizes levels against the busiest day", () => {
    const logs = [
      { date: END, value: 3 },
      { date: END, value: 1 }, // total 4 → max → level 4
      { date: D(END, -1), value: 3 }, // 0.75 → level 3
      { date: D(END, -2), value: 2 }, // 0.5 → level 2
      { date: D(END, -3), value: 1 }, // 0.25 → level 1
    ];
    const { grid, maxTotal } = buildContributionCalendar(logs, { endDate: END });
    expect(maxTotal).toBe(4);
    const cells = new Map<string, HeatCell>();
    for (const week of grid) for (const c of week) cells.set(c.date, c);
    expect(cells.get(END)).toMatchObject({ total: 4, level: 4 });
    expect(cells.get(D(END, -1))).toMatchObject({ total: 3, level: 3 });
    expect(cells.get(D(END, -2))).toMatchObject({ total: 2, level: 2 });
    expect(cells.get(D(END, -3))).toMatchObject({ total: 1, level: 1 });
  });

  it("renders days after the end date as empty regardless of logs", () => {
    const logs = [{ date: D(END, 1), value: 99 }];
    const { grid } = buildContributionCalendar(logs, { endDate: END });
    for (const week of grid) {
      for (const c of week) {
        if (c.date > END) expect(c.total).toBe(0);
      }
    }
  });

  it("keeps maxTotal at least 1 with no logs (all level 0)", () => {
    const { grid, maxTotal } = buildContributionCalendar([], { endDate: END });
    expect(maxTotal).toBe(1);
    expect(grid.every((w) => w.every((c) => c.level === 0))).toBe(true);
  });
});

describe("consistencyPct", () => {
  it("computes the share of active days in the window", () => {
    const active = [END, D(END, -1), D(END, -3), D(END, -9)];
    // last 10 days ending END → 4 active → 40%
    expect(consistencyPct(active, { endDate: END, windowDays: 10 })).toBe(40);
  });

  it("ignores active days outside the window and dedupes", () => {
    const active = [END, END, D(END, -20)];
    expect(consistencyPct(active, { endDate: END, windowDays: 7 })).toBe(
      Math.round((1 / 7) * 100),
    );
  });

  it("returns 0 for a non-positive window", () => {
    expect(consistencyPct([END], { endDate: END, windowDays: 0 })).toBe(0);
  });
});

describe("streakFromDates", () => {
  it("counts consecutive days ending today", () => {
    const active = [END, D(END, -1), D(END, -2), D(END, -4)];
    expect(streakFromDates(active, END)).toEqual({ current: 3, longest: 3 });
  });

  it("keeps the streak alive when today is not yet logged but yesterday is", () => {
    const active = [D(END, -1), D(END, -2)];
    expect(streakFromDates(active, END).current).toBe(2);
  });

  it("is zero when neither today nor yesterday is active", () => {
    const active = [D(END, -3), D(END, -4)];
    expect(streakFromDates(active, END).current).toBe(0);
  });

  it("finds the longest run across gaps", () => {
    const active = [D(END, -10), D(END, -9), D(END, -8), D(END, -8), END];
    expect(streakFromDates(active, END).longest).toBe(3);
  });

  it("handles empty history", () => {
    expect(streakFromDates([], END)).toEqual({ current: 0, longest: 0 });
  });
});

describe("categoryTotals", () => {
  it("sums values per category", () => {
    expect(
      categoryTotals([
        { category: "dsa", value: 2 },
        { category: "dsa", value: 3 },
        { category: "gym", value: 1 },
      ]),
    ).toEqual({ dsa: 5, gym: 1 });
  });

  it("returns an empty object for no entries", () => {
    expect(categoryTotals([])).toEqual({});
  });
});

describe("categoryActiveDays", () => {
  it("counts distinct dates with value > 0 per category", () => {
    const entries = [
      { category: "learning", date: "2026-08-01", value: 30 },
      { category: "learning", date: "2026-08-01", value: 10 }, // same day
      { category: "learning", date: "2026-08-02", value: 5 },
      { category: "learning", date: "2026-08-03", value: 0 }, // ignored
      { category: "dsa", date: "2026-08-02", value: 2 },
    ];
    expect(categoryActiveDays(entries)).toEqual({ learning: 2, dsa: 1 });
  });
});

describe("personalBests", () => {
  it("keeps the max value per habit", () => {
    expect(
      personalBests([
        { habitId: "a", value: 2 },
        { habitId: "a", value: 5 },
        { habitId: "a", value: 3 },
        { habitId: "b", value: 1 },
      ]),
    ).toEqual({ a: 5, b: 1 });
  });
});

describe("dailyXpTrend", () => {
  it("gap-fills a range ascending by date and sums duplicates", () => {
    const scores = [
      { date: END, xp: 100 },
      { date: END, xp: 50 }, // dup → summed
      { date: D(END, -2), xp: 30 },
    ];
    const series = dailyXpTrend(scores, { endDate: END, days: 4 });
    expect(series.map((s) => s.date)).toEqual([
      D(END, -3),
      D(END, -2),
      D(END, -1),
      END,
    ]);
    expect(series.map((s) => s.xp)).toEqual([0, 30, 0, 150]);
  });

  it("returns empty for non-positive days", () => {
    expect(dailyXpTrend([], { endDate: END, days: 0 })).toEqual([]);
  });
});
