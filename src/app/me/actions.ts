"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MAX_LEVEL } from "@/lib/scoring";
import { localDate } from "@/lib/dates";
import { syncAwards } from "@/lib/awards-server";

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

/** Prestige at max level: reset to level 1, +1 prestige star, keep badges. */
export async function prestigeAction() {
  const { supabase, userId } = await requireUserId();
  const { data: profile } = await supabase
    .from("profiles")
    .select("current_level, prestige_level, timezone")
    .eq("id", userId)
    .single();
  if (!profile || (profile.current_level ?? 1) < MAX_LEVEL) return;

  const newPrestige = (profile.prestige_level ?? 0) + 1;
  await supabase
    .from("profiles")
    .update({ total_xp: 0, current_level: 1, prestige_level: newPrestige })
    .eq("id", userId);

  const today = localDate(profile.timezone ?? "UTC");
  await syncAwards(supabase, userId, {
    level: 1,
    currentStreak: 0,
    prestige: newPrestige,
    groupId: null,
    today,
  });

  revalidatePath("/me");
  revalidatePath("/");
}

/** Toggle today as a planned rest day (protects the streak). */
export async function toggleRestDay() {
  const { supabase, userId } = await requireUserId();
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .single();
  const today = localDate(profile?.timezone ?? "UTC");

  const { data: existing } = await supabase
    .from("rest_days")
    .select("id")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();

  if (existing) {
    await supabase.from("rest_days").delete().eq("id", existing.id);
  } else {
    await supabase.from("rest_days").insert({ user_id: userId, date: today });
  }

  revalidatePath("/me");
  revalidatePath("/");
}

/** Equip one of the player's unlocked titles. */
export async function equipTitle(formData: FormData) {
  const name = String(formData.get("title") ?? "");
  const { supabase, userId } = await requireUserId();

  const { data: unlocked } = await supabase
    .from("user_titles")
    .select("titles(name)")
    .eq("user_id", userId);
  const names = new Set<string>();
  for (const r of unlocked ?? []) {
    const rel = r.titles as unknown;
    const rec = (Array.isArray(rel) ? rel[0] : rel) as
      | { name?: string }
      | null;
    if (rec?.name) names.add(rec.name);
  }
  if (!names.has(name)) return;

  await supabase.from("profiles").update({ equipped_title: name }).eq("id", userId);
  revalidatePath("/me");
  revalidatePath("/");
}
