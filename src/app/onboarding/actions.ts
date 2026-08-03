"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type OnboardingState = { error?: string };

/**
 * Completes a new player's profile (display name, handle, timezone). On success
 * redirects to the dashboard. Used with `useActionState` on the client.
 */
export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const displayName = String(formData.get("display_name") ?? "").trim();
  const usernameRaw = String(formData.get("username") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "UTC").trim() || "UTC";

  if (displayName.length < 2) {
    return { error: "Display name must be at least 2 characters." };
  }

  const username = usernameRaw
    ? usernameRaw.toLowerCase().replace(/[^a-z0-9_]/g, "")
    : null;
  if (username !== null && username.length < 3) {
    return { error: "Handle must be at least 3 characters (a–z, 0–9, _)." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      username,
      timezone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") return { error: "That handle is already taken." };
    return { error: error.message };
  }

  // New players who aren't in a squad yet go set one up next.
  const { data: membership } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  redirect(membership ? "/group" : "/groups/new");
}
