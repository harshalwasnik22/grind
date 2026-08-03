import { createClient } from "@/lib/supabase/server";

export type GroupRow = {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string | null;
  active_season_id: string | null;
  created_at: string;
};

export type MemberProfile = {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  current_level: number;
  total_xp: number;
  current_streak: number;
  prestige_level: number;
  equipped_title: string | null;
};

export type Member = {
  user_id: string;
  role: string;
  joined_at: string;
  profiles: MemberProfile | null;
};

export type MyGroup = {
  group: GroupRow;
  myRole: string;
  members: Member[];
};

export type WagerRow = {
  id: string;
  group_id: string;
  season_id: string | null;
  stake: string;
  status: "open" | "settled";
  loser_id: string | null;
  settled_at: string | null;
  created_at: string;
};

/**
 * The single OPEN wager for a group's active season (the stake the lowest
 * scorer pays when the season closes), or null if the owner hasn't set one.
 */
export async function getGroupWager(
  groupId: string,
  seasonId: string | null,
): Promise<WagerRow | null> {
  if (!seasonId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("wagers")
    .select("*")
    .eq("group_id", groupId)
    .eq("season_id", seasonId)
    .eq("status", "open")
    .maybeSingle();
  return (data as WagerRow | null) ?? null;
}

/**
 * Returns the caller's primary group (v1 = one shared friend group), its
 * roster, and the caller's role — or null if they aren't in a group yet.
 */
export async function getMyGroup(userId: string): Promise<MyGroup | null> {
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("group_members")
    .select("group_id, role")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  const { data: group } = await supabase
    .from("groups")
    .select("*")
    .eq("id", membership.group_id)
    .maybeSingle();

  if (!group) return null;

  const { data: members } = await supabase
    .from("group_members")
    .select(
      "user_id, role, joined_at, profiles(display_name, username, avatar_url, current_level, total_xp, current_streak, prestige_level, equipped_title)",
    )
    .eq("group_id", group.id)
    .order("joined_at", { ascending: true });

  return {
    group: group as GroupRow,
    myRole: membership.role as string,
    members: (members ?? []) as unknown as Member[],
  };
}
