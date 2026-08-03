"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ALL_DAYS } from "@/lib/habit-meta";
import type { SupabaseClient } from "@supabase/supabase-js";

export type HabitActionState = { error?: string; ok?: boolean };

const VALID_CATEGORIES = [
  "dsa",
  "system_design",
  "gym",
  "learning",
  "custom",
];

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

async function getGroupId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.group_id ?? null;
}

type ParsedHabit = {
  name: string;
  category: string;
  unit: string;
  daily_target: number;
  base_xp: number;
  schedule: number[];
};

function parseHabit(formData: FormData): ParsedHabit | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  const categoryRaw = String(formData.get("category") ?? "custom");
  const category = VALID_CATEGORIES.includes(categoryRaw) ? categoryRaw : "custom";
  const unit = String(formData.get("unit") ?? "reps").trim() || "reps";
  const daily_target = Number(formData.get("daily_target"));
  const base_xp = Math.round(Number(formData.get("base_xp")));
  const days = formData
    .getAll("days")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  const schedule = days.length > 0 ? days : ALL_DAYS;

  if (name.length < 1) return { error: "Give your quest a name." };
  if (!Number.isFinite(daily_target) || daily_target <= 0) {
    return { error: "Daily target must be greater than 0." };
  }
  return {
    name,
    category,
    unit,
    daily_target,
    base_xp: Number.isFinite(base_xp) && base_xp > 0 ? base_xp : 100,
    schedule,
  };
}

/** Create a custom habit for the current player. */
export async function createHabit(
  _prev: HabitActionState,
  formData: FormData,
): Promise<HabitActionState> {
  const parsed = parseHabit(formData);
  if ("error" in parsed) return parsed;

  const { supabase, userId } = await requireUserId();
  const groupId = await getGroupId(supabase, userId);
  if (!groupId) redirect("/groups/new");

  const { error } = await supabase.from("habits").insert({
    user_id: userId,
    group_id: groupId,
    ...parsed,
  });
  if (error) return { error: error.message };

  revalidatePath("/habits");
  return { ok: true };
}

/** Update an existing habit (owner only, enforced by RLS). */
export async function updateHabit(
  _prev: HabitActionState,
  formData: FormData,
): Promise<HabitActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing habit id." };

  const parsed = parseHabit(formData);
  if ("error" in parsed) return parsed;

  const { supabase, userId } = await requireUserId();
  const { error } = await supabase
    .from("habits")
    .update(parsed)
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { error: error.message };

  revalidatePath("/habits");
  return { ok: true };
}

/** Archive a habit (hides it without deleting history). */
export async function archiveHabit(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const { supabase, userId } = await requireUserId();
  await supabase
    .from("habits")
    .update({ is_active: false, archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  revalidatePath("/habits");
}

/** Clone selected starter templates into the player's habits. */
export async function addTemplates(
  _prev: HabitActionState,
  formData: FormData,
): Promise<HabitActionState> {
  const templateIds = formData.getAll("template").map((v) => String(v));
  if (templateIds.length === 0) {
    return { error: "Pick at least one starter quest." };
  }

  const { supabase, userId } = await requireUserId();
  const groupId = await getGroupId(supabase, userId);
  if (!groupId) redirect("/groups/new");

  const { data: templates } = await supabase
    .from("habit_templates")
    .select("*")
    .in("id", templateIds);

  if (!templates || templates.length === 0) {
    return { error: "Those templates could not be found." };
  }

  const rows = templates.map((t, i) => ({
    user_id: userId,
    group_id: groupId,
    name: t.name,
    category: t.category,
    unit: t.unit,
    daily_target: t.default_target,
    base_xp: t.base_xp,
    sort_order: i,
  }));

  const { error } = await supabase.from("habits").insert(rows);
  if (error) return { error: error.message };

  revalidatePath("/habits");
  return { ok: true };
}
