/**
 * useFreeMsgLimit
 *
 * Tracks how many messages a non-VIP user has sent to female members.
 * Non-VIP users get 3 free messages to female users total.
 * After that they must upgrade to any VIP tier.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export const FREE_MSG_LIMIT = 3;

export function useFreeMsgLimit(partnerId?: string) {
  const { user, minutes } = useAuth();
  const isVip = !!minutes?.is_vip;

  const { data: usedCount = 0, isLoading } = useQuery({
    queryKey: ["free_msg_count", user?.id, partnerId],
    // Only count for non-VIP users who are logged in
    enabled: !!user && !isVip,
    staleTime: 10_000,
    queryFn: async () => {
      if (!user) return 0;

      // If we have a partnerId, we can just count messages in the conversation with that partner
      if (partnerId) {
        // Find the conversation with this partner
        const { data: convo } = await supabase
          .from("conversations")
          .select("id")
          .or(`and(participant_1.eq.${user.id},participant_2.eq.${partnerId}),and(participant_1.eq.${partnerId},participant_2.eq.${user.id})`)
          .maybeSingle();

        if (!convo) return 0;

        // Count messages sent by user in this conversation
        const { count, error } = await supabase
          .from("dm_messages")
          .select("*", { count: 'exact', head: true })
          .eq("conversation_id", convo.id)
          .eq("sender_id", user.id);

        if (error) throw error;
        return count ?? 0;
      }

      // 1. Get all messages sent by this user
      const { data: sentMsgs } = await supabase
        .from("dm_messages")
        .select("conversation_id")
        .eq("sender_id", user.id);

      if (!sentMsgs || sentMsgs.length === 0) return 0;

      // 2. Find which of these messages were sent to female members
      // First get the partner IDs for each conversation
      const convoIds = [...new Set(sentMsgs.map((m) => m.conversation_id))];
      const { data: convos } = await supabase
        .from("conversations")
        .select("id, participant_1, participant_2")
        .in("id", convoIds);

      if (!convos) return 0;

      const convoToPartner = new Map();
      convos.forEach((c) => {
        convoToPartner.set(
          c.id,
          c.participant_1 === user.id ? c.participant_2 : c.participant_1
        );
      });

      const partnerIds = [...new Set(Array.from(convoToPartner.values()))];

      // 3. Filter partners by gender (matching against id)
      const { data: femaleMembers } = await supabase
        .from("members")
        .select("id, gender")
        .in("id", partnerIds);

      console.log("[useFreeMsgLimit] Found partners:", partnerIds, "Profiles:", femaleMembers);

      const femaleIds = new Set(
        (femaleMembers ?? [])
          .filter(m => m.gender?.toLowerCase() === "female")
          .map((m) => m.id)
      );

      if (femaleIds.size === 0) {
        console.log("[useFreeMsgLimit] No female partners found in set");
        return 0;
      }

      // 4. Count messages where the partner in that conversation is female
      let femaleMsgCount = 0;
      sentMsgs.forEach((msg) => {
        const partnerId = convoToPartner.get(msg.conversation_id);
        if (femaleIds.has(partnerId)) {
          femaleMsgCount++;
        }
      });

      return femaleMsgCount;
    },
  });

  const remaining = isVip ? Infinity : Math.max(0, FREE_MSG_LIMIT - usedCount);
  const hasReachedLimit = !isVip && usedCount >= FREE_MSG_LIMIT;

  return {
    isVip,
    usedCount,
    remaining,
    hasReachedLimit,
    isLoading,
    FREE_MSG_LIMIT,
  };
}