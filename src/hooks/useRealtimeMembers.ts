import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/**
 * Keep a live count of members for a given club using Supabase realtime.
 */
export function useRealtimeMembers(clubId: string | null | undefined) {
  const [memberCount, setMemberCount] = useState(0);

  useEffect(() => {
    if (!clubId) {
      setMemberCount(0);
      return;
    }

    let isMounted = true;

    const loadInitialCount = async () => {
      const { count, error } = await supabase
        .from("club_members")
        .select("*", { count: "exact", head: true })
        .eq("club_id", clubId);

      if (!error && typeof count === "number" && isMounted) {
        setMemberCount(count);
      }
    };

    loadInitialCount();

    const channel = supabase
      .channel(`club-members-${clubId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "club_members",
          filter: `club_id=eq.${clubId}`,
        },
        () => {
          setMemberCount((prev) => prev + 1);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "club_members",
          filter: `club_id=eq.${clubId}`,
        },
        () => {
          setMemberCount((prev) => Math.max(prev - 1, 0));
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      channel.unsubscribe();
    };
  }, [clubId]);

  return memberCount;
}
