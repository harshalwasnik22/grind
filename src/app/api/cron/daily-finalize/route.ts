import { NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { createServiceClient } from "@/lib/supabase/service";
import { authorizeCron, cronUnauthorized } from "@/lib/cron";
import { localDate, previousDate } from "@/lib/dates";
import { decideDailyFinalize } from "@/lib/finalize-day";

export const dynamic = "force-dynamic";

/**
 * Runs hourly. For each player whose LOCAL midnight just passed, finalizes the
 * day that just ended: breaks the streak unless they hit a target, took a rest
 * day, or have a freeze to spend.
 */
export async function GET(request: Request) {
  if (!authorizeCron(request)) return cronUnauthorized();

  let supabase: ReturnType<typeof createServiceClient>;
  try {
    supabase = createServiceClient();
  } catch {
    return NextResponse.json(
      { error: "service client unavailable" },
      { status: 500 },
    );
  }

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, timezone, current_streak, streak_freezes, last_active_date");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = new Date();
  let checked = 0;
  let finalized = 0;

  for (const p of profiles ?? []) {
    const tz = p.timezone || "UTC";
    let localHour: number;
    try {
      localHour = Number(formatInTimeZone(now, tz, "H"));
    } catch {
      localHour = Number(formatInTimeZone(now, "UTC", "H"));
    }
    if (localHour !== 0) continue; // only at local midnight
    checked++;

    const yesterday = previousDate(localDate(tz, now));
    const hitYesterday = p.last_active_date === yesterday;

    let restYesterday = false;
    if (!hitYesterday) {
      const { data: rest } = await supabase
        .from("rest_days")
        .select("id")
        .eq("user_id", p.id)
        .eq("date", yesterday)
        .maybeSingle();
      restYesterday = Boolean(rest);
    }

    const d = decideDailyFinalize({
      hitYesterday,
      restYesterday,
      freezes: p.streak_freezes ?? 0,
      currentStreak: p.current_streak ?? 0,
    });

    if (d.outcome === "freeze_used" || d.outcome === "broken") {
      await supabase
        .from("profiles")
        .update({ current_streak: d.newStreak, streak_freezes: d.newFreezes })
        .eq("id", p.id);
      finalized++;
    }
  }

  return NextResponse.json({ finalized, checked });
}

export const POST = GET;
