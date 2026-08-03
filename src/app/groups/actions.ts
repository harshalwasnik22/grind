"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type GroupActionState = { error?: string; ok?: boolean };

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

/** Create a new squad (owner = current player) and jump into it. */
export async function createGroupAction(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const { supabase } = await requireUserId();

  const { error } = await supabase.rpc("create_group", {
    p_name: name || "My Squad",
  });
  if (error) return { error: error.message };

  redirect("/group");
}

/** Join an existing squad via its invite code. */
export async function joinGroupAction(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  if (code.length < 4) {
    return { error: "Enter your 6-character invite code." };
  }

  const { supabase } = await requireUserId();
  const { error } = await supabase.rpc("join_group_by_code", { p_code: code });
  if (error) {
    if (/invalid invite code/i.test(error.message)) {
      return { error: "That code doesn't match any squad." };
    }
    return { error: error.message };
  }

  redirect("/group");
}

/** Owner-only: rotate the invite code (invalidates the old one). */
export async function rotateInviteCodeAction(formData: FormData) {
  const groupId = String(formData.get("group_id") ?? "");
  const { supabase } = await requireUserId();
  await supabase.rpc("rotate_invite_code", { p_group: groupId });
  redirect("/group");
}

/**
 * Owner-only: set (or update) the stake for this season's open wager. The
 * lowest scorer when the season closes owes it. Backed by the `set_wager`
 * RPC, which enforces owner-only server-side.
 */
export async function setWagerAction(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const groupId = String(formData.get("group_id") ?? "");
  const stake = String(formData.get("stake") ?? "").trim();
  if (!groupId) return { error: "Missing squad." };
  if (stake.length < 2) return { error: "Describe the stake (min 2 chars)." };
  if (stake.length > 120) return { error: "Keep the stake under 120 characters." };

  const { supabase } = await requireUserId();
  const { error } = await supabase.rpc("set_wager", {
    p_group: groupId,
    p_stake: stake,
  });
  if (error) {
    if (/only the owner/i.test(error.message)) {
      return { error: "Only the squad owner can set the wager." };
    }
    return { error: error.message };
  }

  revalidatePath("/group");
  return { ok: true };
}

/** Leave the current squad. */
export async function leaveGroupAction(formData: FormData) {
  const groupId = String(formData.get("group_id") ?? "");
  const { supabase, userId } = await requireUserId();
  await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);
  redirect("/groups/new");
}
