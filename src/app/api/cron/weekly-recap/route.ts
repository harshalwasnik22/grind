import { NextResponse } from "next/server";
import { authorizeCron, cronUnauthorized } from "@/lib/cron";
import { createServiceClient } from "@/lib/supabase/service";
import { sendPushToUser } from "@/lib/push";
import { sendRecapEmail, emailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Ranked = { userId: string; name: string; xp: number };

function recapHtml(groupName: string, ranked: Ranked[], meId: string): string {
  const rows = ranked
    .map((r, i) => {
      const you = r.userId === meId;
      return `<tr style="border-bottom:2px solid #272258">
        <td style="padding:8px;color:#ffd24a">${i + 1}</td>
        <td style="padding:8px;color:${you ? "#5cc8ff" : "#f2f0ff"}">${escapeHtml(
          r.name,
        )}${you ? " (you)" : ""}</td>
        <td style="padding:8px;text-align:right;color:#6ee763">${r.xp} XP</td>
      </tr>`;
    })
    .join("");
  return `<div style="font-family:monospace;background:#0d0b1a;color:#f2f0ff;padding:24px;max-width:480px">
    <h1 style="color:#ffd24a;margin:0 0 16px">GRIND — Weekly Recap</h1>
    <p style="color:#9a93d4">Standings for <strong style="color:#f2f0ff">${escapeHtml(
      groupName,
    )}</strong> this week:</p>
    <table style="width:100%;border-collapse:collapse;margin-top:12px">${rows}</table>
    <p style="color:#9a93d4;margin-top:20px">New week, new XP. Keep grinding. ⚔</p>
  </div>`;
}

/**
 * Weekly cron. For each group, ranks the last 7 days of XP and notifies every
 * member (push + email) of their finishing position. All external calls are
 * guarded, so missing push/email config just skips that channel.
 */
async function handler(request: Request) {
  if (!authorizeCron(request)) return cronUnauthorized();
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "service role not configured" },
      { status: 500 },
    );
  }

  const supabase = createServiceClient();
  const today = daysAgo(0);
  const weekAgo = daysAgo(6);

  const { data: groups } = await supabase.from("groups").select("id, name");
  let groupCount = 0;
  let notified = 0;

  for (const g of groups ?? []) {
    groupCount++;
    const [{ data: members }, { data: scores }] = await Promise.all([
      supabase
        .from("group_members")
        .select("user_id, profiles(display_name)")
        .eq("group_id", g.id),
      supabase
        .from("daily_scores")
        .select("user_id, xp_earned")
        .eq("group_id", g.id)
        .gte("date", weekAgo)
        .lte("date", today),
    ]);

    const sums = new Map<string, number>();
    for (const s of scores ?? []) {
      const id = s.user_id as string;
      sums.set(id, (sums.get(id) ?? 0) + (Number(s.xp_earned) || 0));
    }

    const ranked: Ranked[] = (members ?? [])
      .map((m) => ({
        userId: m.user_id as string,
        name:
          (m.profiles as { display_name?: string } | null)?.display_name ??
          "Player",
        xp: sums.get(m.user_id as string) ?? 0,
      }))
      .sort((a, b) => b.xp - a.xp);

    for (let i = 0; i < ranked.length; i++) {
      const r = ranked[i];
      const rank = i + 1;

      await sendPushToUser(supabase, r.userId, {
        title: "Weekly Recap",
        body: `You finished #${rank} with ${r.xp} XP this week`,
        url: "/leaderboard?view=season",
      });

      if (emailConfigured()) {
        try {
          const { data: authUser } =
            await supabase.auth.admin.getUserById(r.userId);
          const email = authUser?.user?.email;
          if (email) {
            await sendRecapEmail(
              email,
              `GRIND — Weekly Recap: you finished #${rank}`,
              recapHtml(g.name as string, ranked, r.userId),
            );
          }
        } catch {
          // Email is best-effort; skip on any failure.
        }
      }
      notified++;
    }
  }

  return NextResponse.json({ groups: groupCount, notified });
}

export const GET = handler;
export const POST = handler;
