import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

let vapidReady = false;

/** Whether VAPID keys are present (Web Push can actually be sent). */
export function pushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
  );
}

/** Configure web-push lazily so importing this module never throws in dev. */
function ensureVapid(): boolean {
  if (vapidReady) return true;
  if (!pushConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:grind@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  vapidReady = true;
  return true;
}

export type PushPayload = { title: string; body: string; url?: string };

/**
 * Sends a push to every registered subscription for `userId`. Dead
 * subscriptions (404/410) are pruned. Returns how many were delivered.
 * No-op (returns 0) when push isn't configured.
 */
export async function sendPushToUser(
  // Untyped service/server client — this module isn't schema-aware.
  supabase: SupabaseClient,
  userId: string,
  payload: PushPayload,
): Promise<number> {
  if (!ensureVapid()) return 0;

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, keys")
    .eq("user_id", userId);
  if (!subs || subs.length === 0) return 0;

  const body = JSON.stringify(payload);
  let sent = 0;
  for (const s of subs) {
    const subscription = {
      endpoint: s.endpoint as string,
      keys: s.keys as { p256dh: string; auth: string },
    };
    try {
      await webpush.sendNotification(subscription, body);
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", subscription.endpoint);
      }
    }
  }
  return sent;
}
