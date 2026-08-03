import { NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { authorizeCron, cronUnauthorized } from "@/lib/cron";
import { createServiceClient } from "@/lib/supabase/service";
import { sendPushToUser, pushConfigured } from "@/lib/push";
import { localDate, weekdayOf } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** Local hour (0–23) at which the evening nudge fires. */
const REMINDER_HOUR = 19;

function localHour(tz: string): number {
  try {
    return Number(formatInTimeZone(new Date(), tz, "H"));
  } catch {
    return Number(formatInTimeZone(new Date(), "UTC", "H"));
  }
}

/**
 * Hourly cron. Nudges players in their local 7pm hour who have a quest due
 * today but haven't hit any target yet. Timezone-correct because it only acts
 * on profiles whose local hour matches.
 */
async function handler(request: Request) {
  if (!authorizeCron(request)) return cronUnauthorized();
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "service role not configured" },
      { status: 500 },
    );
  }
  if (!pushConfigured()) {
    return NextResponse.json({ sent: 0, skipped: "push not configured" });
  }

  const supabase = createServiceClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, timezone");

  let sent = 0;
  let checked = 0;
  for (const p of profiles ?? []) {
    const tz = (p.timezone as string) || "UTC";
    if (localHour(tz) !== REMINDER_HOUR) continue;
    checked++;

    const today = localDate(tz);
    const weekday = weekdayOf(today);

    // Only nudge if a quest is actually scheduled for today.
    const { data: habits } = await supabase
      .from("habits")
      .select("schedule")
      .eq("user_id", p.id)
      .is("archived_at", null)
      .eq("is_active", true);
    const dueToday = (habits ?? []).some(
      (h) => Array.isArray(h.schedule) && h.schedule.includes(weekday),
    );
    if (!dueToday) continue;

    const { data: score } = await supabase
      .from("daily_scores")
      .select("targets_hit")
      .eq("user_id", p.id)
      .eq("date", today)
      .maybeSingle();
    if (score && Number(score.targets_hit) > 0) continue; // already made progress

    sent += await sendPushToUser(supabase, p.id as string, {
      title: "GRIND",
      body: "You haven't logged today — keep your streak alive! 🔥",
      url: "/",
    });
  }

  return NextResponse.json({ sent, checked });
}

export const GET = handler;
export const POST = handler;
