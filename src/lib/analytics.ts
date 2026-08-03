// ===========================================================================
// analytics.ts — pure transforms for the contribution heatmap & profile stats.
// No DB / React imports. Dates are 'yyyy-MM-dd' strings; weeks are Sunday-first
// (0=Sun .. 6=Sat), matching the rest of the app.
// ===========================================================================

// --- internal date helpers (UTC-based, no deps) ---------------------------

function toUTC(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, n: number): string {
  const d = toUTC(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}

/** Weekday for a date: 0=Sun .. 6=Sat. */
function weekday(dateStr: string): number {
  return toUTC(dateStr).getUTCDay();
}

// --- contribution calendar -------------------------------------------------

export type HeatCell = { date: string; total: number; level: 0 | 1 | 2 | 3 | 4 };

export type ContributionCalendar = {
  /** Columns of weeks; each week is 7 cells (Sun..Sat). Rectangular. */
  grid: HeatCell[][];
  /** Max daily total observed in range (>= 1). */
  maxTotal: number;
};

function quantize(total: number, maxTotal: number): HeatCell["level"] {
  if (total <= 0) return 0;
  const ratio = total / maxTotal;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

/**
 * Builds a GitHub-style contribution grid: `weeks` Sunday-aligned columns
 * ending at the week containing `endDate`. Days after `endDate` render as
 * empty (total 0). Level is quantized against the busiest day in range.
 */
export function buildContributionCalendar(
  logs: { date: string; value: number }[],
  opts: { endDate: string; weeks?: number },
): ContributionCalendar {
  const weeks = Math.max(1, opts.weeks ?? 13);
  const endDate = opts.endDate;

  const totals = new Map<string, number>();
  for (const l of logs) {
    totals.set(l.date, (totals.get(l.date) ?? 0) + (Number(l.value) || 0));
  }

  // Sunday of the end week, then step back to the first column's Sunday.
  const endSunday = addDays(endDate, -weekday(endDate));
  const gridStart = addDays(endSunday, -(weeks - 1) * 7);

  // Pass 1: build cell totals + find the max within range (<= endDate).
  const cellTotals: { date: string; total: number }[][] = [];
  let maxTotal = 0;
  for (let col = 0; col < weeks; col++) {
    const week: { date: string; total: number }[] = [];
    for (let row = 0; row < 7; row++) {
      const date = addDays(gridStart, col * 7 + row);
      const total = date <= endDate ? (totals.get(date) ?? 0) : 0;
      if (date <= endDate && total > maxTotal) maxTotal = total;
      week.push({ date, total });
    }
    cellTotals.push(week);
  }
  const safeMax = Math.max(1, maxTotal);

  // Pass 2: quantize levels.
  const grid: HeatCell[][] = cellTotals.map((week) =>
    week.map((c) => ({
      date: c.date,
      total: c.total,
      level: quantize(c.total, safeMax),
    })),
  );

  return { grid, maxTotal: safeMax };
}

// --- consistency -----------------------------------------------------------

/**
 * Percentage (0..100, rounded) of the last `windowDays` calendar days ending
 * `endDate` on which the player was active.
 */
export function consistencyPct(
  activeDates: string[],
  opts: { endDate: string; windowDays: number },
): number {
  const { endDate, windowDays } = opts;
  if (windowDays <= 0) return 0;
  const active = new Set(activeDates);
  let count = 0;
  for (let i = 0; i < windowDays; i++) {
    if (active.has(addDays(endDate, -i))) count++;
  }
  return Math.round((count / windowDays) * 100);
}

// --- streaks ---------------------------------------------------------------

/**
 * Current & longest streak from a set of active dates.
 * Rule: `current` counts consecutive active days ending at `today`; if `today`
 * itself is not active but `yesterday` is, the streak is considered still alive
 * and counts back from yesterday. `longest` is the longest consecutive run
 * anywhere in the history.
 */
export function streakFromDates(
  activeDates: string[],
  today: string,
): { current: number; longest: number } {
  const active = new Set(activeDates);

  // current
  let cursor: string | null = null;
  if (active.has(today)) cursor = today;
  else if (active.has(addDays(today, -1))) cursor = addDays(today, -1);

  let current = 0;
  while (cursor && active.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  // longest
  const sorted = Array.from(active).sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    if (prev !== null && addDays(prev, 1) === d) run++;
    else run = 1;
    if (run > longest) longest = run;
    prev = d;
  }

  return { current, longest };
}

// --- category / record aggregates -----------------------------------------

export function categoryTotals(
  entries: { category: string; value: number }[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) {
    out[e.category] = (out[e.category] ?? 0) + (Number(e.value) || 0);
  }
  return out;
}

/** Distinct dates with value > 0 per category (e.g. the polyglot metric). */
export function categoryActiveDays(
  entries: { category: string; date: string; value: number }[],
): Record<string, number> {
  const sets = new Map<string, Set<string>>();
  for (const e of entries) {
    if ((Number(e.value) || 0) <= 0) continue;
    let s = sets.get(e.category);
    if (!s) {
      s = new Set<string>();
      sets.set(e.category, s);
    }
    s.add(e.date);
  }
  const out: Record<string, number> = {};
  for (const [cat, s] of sets) out[cat] = s.size;
  return out;
}

export function personalBests(
  entries: { habitId: string; value: number }[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) {
    const v = Number(e.value) || 0;
    if (!(e.habitId in out) || v > out[e.habitId]) out[e.habitId] = v;
  }
  return out;
}

// --- trend -----------------------------------------------------------------

/**
 * Gap-filled daily XP series for the last `days` days ending `endDate`,
 * ascending by date (missing days → xp 0). Duplicate dates are summed.
 */
export function dailyXpTrend(
  scores: { date: string; xp: number }[],
  opts: { endDate: string; days: number },
): { date: string; xp: number }[] {
  const { endDate, days } = opts;
  if (days <= 0) return [];
  const map = new Map<string, number>();
  for (const s of scores) {
    map.set(s.date, (map.get(s.date) ?? 0) + (Number(s.xp) || 0));
  }
  const out: { date: string; xp: number }[] = [];
  const start = addDays(endDate, -(days - 1));
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    out.push({ date, xp: map.get(date) ?? 0 });
  }
  return out;
}
