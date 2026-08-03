import { Resend } from "resend";

/** Whether transactional email (Resend) is configured. */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Sends one recap email via Resend. No-op (`{ skipped: true }`) when
 * RESEND_API_KEY is absent, so cron routes stay safe in dev.
 */
export async function sendRecapEmail(to: string, subject: string, html: string) {
  if (!emailConfigured()) return { skipped: true as const };
  const resend = new Resend(process.env.RESEND_API_KEY!);
  return resend.emails.send({
    from: process.env.RESEND_FROM || "GRIND <onboarding@resend.dev>",
    to,
    subject,
    html,
  });
}
