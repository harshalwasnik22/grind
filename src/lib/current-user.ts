import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Whether Supabase env is configured (lets the UI showcase run without it). */
export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Fetches the signed-in user and their profile for Server Components / Actions.
 * Returns nulls (rather than throwing) when Supabase isn't configured or the
 * visitor is signed out.
 */
export async function getCurrent() {
  if (!isSupabaseConfigured()) {
    return { user: null, profile: null } as const;
  }

  const supabase = await createClient();
  // getClaims() verifies the JWT locally when asymmetric signing keys are on
  // (no auth round-trip); the proxy already refreshed the session this request.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { user: null, profile: null } as const;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  return { user: { id: userId }, profile } as const;
}

/**
 * Guard for protected pages: requires a signed-in, onboarded player.
 * Redirects to /login (signed out) or /onboarding (profile incomplete).
 */
export async function requirePlayer() {
  const { user, profile } = await getCurrent();
  if (!user) redirect("/login");
  if (!profile || !profile.display_name) redirect("/onboarding");
  return { user, profile };
}
