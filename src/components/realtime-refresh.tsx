"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribes to daily_scores changes for a group and re-fetches the server
 * component tree when a group-mate logs, giving a live-updating leaderboard.
 * No-op unless the `daily_scores` table is in the `supabase_realtime`
 * publication; failure to subscribe is silent (the page still works statically).
 */
export function RealtimeRefresh({ groupId }: { groupId: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`scores:${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "daily_scores",
          filter: `group_id=eq.${groupId}`,
        },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [groupId, router]);

  return null;
}
