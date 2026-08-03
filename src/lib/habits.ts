import { createClient } from "@/lib/supabase/server";

export type Habit = {
  id: string;
  user_id: string;
  group_id: string | null;
  name: string;
  category: string;
  unit: string;
  daily_target: number;
  base_xp: number;
  schedule: number[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  archived_at: string | null;
};

export type HabitTemplate = {
  id: string;
  category: string;
  name: string;
  unit: string;
  default_target: number;
  base_xp: number;
  sort_order: number;
};

/** Active (non-archived) habits for a player, in display order. */
export async function getMyHabits(userId: string): Promise<Habit[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("habits")
    .select("*")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []) as Habit[];
}

/** Starter-habit catalog cloned during setup. */
export async function getTemplates(): Promise<HabitTemplate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("habit_templates")
    .select("*")
    .order("sort_order", { ascending: true });
  return (data ?? []) as HabitTemplate[];
}
