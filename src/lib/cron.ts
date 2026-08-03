import { NextResponse } from "next/server";

/**
 * Verifies a cron request carries the shared secret. Vercel Cron sends
 * `Authorization: Bearer <CRON_SECRET>`; we also accept an `x-cron-secret`
 * header for manual invocation (e.g. curl during testing).
 */
export function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  if (request.headers.get("x-cron-secret") === secret) return true;
  return false;
}

export function cronUnauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
