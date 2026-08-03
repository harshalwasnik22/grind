import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { authorizeCron, cronUnauthorized } from "@/lib/cron";

export const dynamic = "force-dynamic";

/**
 * Runs daily/weekly. Closes any active season whose end date has passed:
 * snapshots standings, settles the wager, awards the champion badge, replenishes
 * freezes, and opens the next season (via the close_and_rollover_season RPC).
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

  const today = new Date().toISOString().slice(0, 10);
  const { data: seasons, error } = await supabase
    .from("seasons")
    .select("id, group_id, ends_on")
    .eq("is_active", true)
    .lt("ends_on", today);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rolled = 0;
  const errors: string[] = [];
  for (const s of seasons ?? []) {
    const { error: rpcErr } = await supabase.rpc("close_and_rollover_season", {
      p_group: s.group_id,
    });
    if (rpcErr) errors.push(`${s.group_id}: ${rpcErr.message}`);
    else rolled++;
  }

  return NextResponse.json({ rolled, errors });
}

export const POST = GET;
