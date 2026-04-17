import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Platform, Alert } from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  participant_1: string;
  participant_2: string;
  last_message_at: string;
  created_at: string;
  other_user?: {
    id: string;
    name: string;
    image_url: string | null;
    gender: string | null;
    last_active_at: string | null;
    role?: string | null;
    is_vip?: boolean;
  };
  last_message?: string;
  unread_count?: number;
}

export interface DmMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

// ─── useConversations ─────────────────────────────────────────────────────────

export function useConversations() {
  const { profile } = useAuth();
  const [errorText, setErrorText] = useState<string | null>(null);
  
  // Important: Conversations link to the member profile id, not the auth user id
  const memberId = profile?.id;

  const query = useQuery<Conversation[]>({
    queryKey: ["conversations", memberId],
    enabled: !!memberId,
    refetchInterval: 10000, // Reduced frequency
    queryFn: async () => {
      if (!memberId) return [];

      console.log("[useConversations] FETCH START for memberId:", memberId);
      
      const { data: convos, error } = await supabase
        .from("conversations")
        .select("*")
        .or(`participant_1.eq.${memberId},participant_2.eq.${memberId}`)
        .order("last_message_at", { ascending: false });

      if (error) {
        console.error("[useConversations] Supabase query error:", error.message);
        setErrorText(error.message);
        throw error;
      }
      
      setErrorText(null);

      if (!convos || convos.length === 0) {
        console.log("[useConversations] No conversations found for memberId:", memberId);
        return [];
      }

      console.log("[useConversations] SUCCESS - count:", convos.length);
      
      const otherUserIds = convos.map((c) =>
        c.participant_1 === memberId ? c.participant_2 : c.participant_1
      );

      // 2. Fetch other user profiles & last messages
      let { data: membersData, error: memberError } = await supabase
        .from("members")
        .select("id, name, image_url, gender, last_active_at, role")
        .in("id", otherUserIds);

      if (memberError) {
        console.error("[useConversations] Members error:", memberError);
        // Fallback: try without 'role' if that was the issue
        const { data: retryData } = await supabase
          .from("members")
          .select("id, name, image_url, gender, last_active_at")
          .in("id", otherUserIds);
        if (retryData) membersData = retryData;
      }

      // 3. Fetch VIP status for other users
      let { data: minutesData, error: minutesError } = await supabase
        .from("member_minutes")
        .select("user_id, is_vip, admin_granted_vip")
        .in("user_id", otherUserIds);

      if (minutesError) {
        console.error("[useConversations] Minutes error:", minutesError);
        // Fallback: try without 'admin_granted_vip'
        const { data: retryMin } = await supabase
          .from("member_minutes")
          .select("user_id, is_vip")
          .in("user_id", otherUserIds);
        if (retryMin) minutesData = retryMin;
      }
      
      const memberMap = new Map();
      (membersData ?? []).forEach((m) => {
        const minutes = minutesData?.find(min => min.user_id === m.id);
        memberMap.set(m.id, {
          ...m,
          is_vip: !!(minutes?.is_vip || minutes?.admin_granted_vip)
        });
      });
      
      const enriched: Conversation[] = await Promise.all(
        convos.map(async (convo) => {
          const otherId =
            convo.participant_1 === memberId
              ? convo.participant_2
              : convo.participant_1;

          const [{ data: lastMsgData }, { count: unreadCount }] = await Promise.all([
            supabase
              .from("dm_messages")
              .select("content")
              .eq("conversation_id", convo.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabase
              .from("dm_messages")
              .select("*", { count: "exact", head: true })
              .eq("conversation_id", convo.id)
              .neq("sender_id", memberId)
              .is("read_at", null)
          ]);

          return {
            ...convo,
            other_user: memberMap.get(otherId) || { id: otherId, name: "C24 Member", image_url: null },
            last_message: lastMsgData?.content ?? "New conversation",
            unread_count: unreadCount ?? 0,
          };
        })
      );

      console.log("[useConversations] Returning enriched count:", enriched.length);
      return enriched;
    },
  });

  return { ...query, errorText };
}

// ─── useConversationMessages ──────────────────────────────────────────────────

export function useConversationMessages(conversationId: string | null) {
  const { profile } = useAuth();
  const memberId = profile?.id;
  const queryClient = useQueryClient();

  return useQuery<DmMessage[]>({
    queryKey: ["dm_messages", conversationId],
    enabled: !!conversationId && conversationId !== "new" && !!memberId,
    refetchInterval: Platform.OS === "web" ? false : 8000,
    queryFn: async () => {
      if (!conversationId || conversationId === "new") return [];

      const { data, error } = await supabase
        .from("dm_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Mark unread messages from other user as read
      if (memberId && data && data.length > 0) {
        const unreadIds = data
          .filter((m) => m.sender_id !== memberId && !m.read_at)
          .map((m) => m.id);

        if (unreadIds.length > 0) {
          await supabase
            .from("dm_messages")
            .update({ read_at: new Date().toISOString() })
            .in("id", unreadIds);
            
          // Invalidate unread counts so the tab badge and conversation list update
          queryClient.invalidateQueries({ queryKey: ["unread_count", memberId] });
          queryClient.invalidateQueries({ queryKey: ["conversations", memberId] });
        }
      }

      return (data ?? []) as DmMessage[];
    },
  });
}

// ─── useSendMessage ───────────────────────────────────────────────────────────

interface SendMessageParams {
  conversationId: string | null;
  partnerId: string;
  content: string;
}

interface SendMessageResult {
  conversationId: string;
  message: DmMessage;
}

export function useSendMessage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [lastError, setLastError] = useState<string | null>(null);

  const mutation = useMutation<SendMessageResult, Error, SendMessageParams>({
    mutationFn: async ({ conversationId, partnerId, content }) => {
      if (!profile?.id) throw new Error("Not authenticated (profile loading or missing)");
      if (!partnerId || partnerId === "undefined") throw new Error("No partner specified");

      console.log("[useSendMessage] START - from:", profile.id, "to:", partnerId);

      let actualConversationId = conversationId;

      // 1. Resolve or Create Conversation
      if (actualConversationId === "new" || !actualConversationId) {
        console.log("[useSendMessage] Resolving conversation...");
        
        // Find existing conversation between these two users
        const { data: convos, error: findError } = await supabase
          .from("conversations")
          .select("id, participant_1, participant_2")
          .or(`participant_1.eq.${profile.id},participant_2.eq.${profile.id}`);

        if (findError) {
          console.error("[useSendMessage] Find convo error:", findError);
          throw findError;
        }

        // Filter locally to find the exact match with the partner
        const existing = convos?.find(c => 
          (c.participant_1 === profile.id && c.participant_2 === partnerId) ||
          (c.participant_1 === partnerId && c.participant_2 === profile.id)
        );

        if (existing) {
          actualConversationId = existing.id;
          console.log("[useSendMessage] Found existing:", actualConversationId);
        } else {
          console.log("[useSendMessage] Creating new conversation...");
          const { data: newConvo, error: convoError } = await supabase
            .from("conversations")
            .insert({
              participant_1: profile.id,
              participant_2: partnerId,
              last_message_at: new Date().toISOString(),
            })
            .select("id")
            .single();

          if (convoError) {
            console.error("[useSendMessage] CONVO INSERT ERROR:", convoError);
            throw convoError;
          }
          actualConversationId = newConvo.id;
          console.log("[useSendMessage] Created:", actualConversationId);
        }
      }

      // 2. Send the message
      console.log("[useSendMessage] Inserting message into convo:", actualConversationId);
      const { data: msg, error: msgError } = await supabase
        .from("dm_messages")
        .insert({
          conversation_id: actualConversationId,
          sender_id: profile.id,
          content,
        })
        .select("*")
        .single();

      if (msgError) {
        console.error("[useSendMessage] MESSAGE INSERT ERROR:", msgError);
        throw msgError;
      }

      console.log("[useSendMessage] SUCCESS - msg id:", msg.id);

      // 🔔 Fire-and-forget: trigger push notification for recipient
      supabase.functions.invoke("notify-dm", {
        body: { message_id: msg.id },
      }).catch((e) => console.warn("[useSendMessage] notify-dm error:", e));

      // 3. Update conversation timestamp
      const { error: updateError } = await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", actualConversationId);
      
      if (updateError) {
        console.warn("[useSendMessage] Update timestamp error:", updateError);
      }

      return {
        conversationId: actualConversationId as string,
        message: msg as DmMessage,
      };
    },
    onSuccess: (result) => {
      setLastError(null);
      const cid = result.conversationId;
      console.log("[useSendMessage] Successfully sent message, invalidating queries...");
      queryClient.invalidateQueries({ queryKey: ["dm_messages", cid] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["free_msg_count"] });
    },
    onError: (err: any) => {
      console.error("[useSendMessage] Mutation error:", err);
      const msg = err?.message || "Unknown error";
      setLastError(msg);
      if (Platform.OS === 'web') {
        console.log("SEND ERROR", msg);
      } else {
        Alert.alert("Message Failed", msg);
      }
    },
  });

  return { ...mutation, lastError };
}

// ─── useUnreadCount ───────────────────────────────────────────────────────────

export function useUnreadCount() {
  const { profile } = useAuth();
  const memberId = profile?.id;

  return useQuery<number>({
    queryKey: ["unread_count", memberId],
    enabled: !!memberId,
    refetchInterval: 30000, // Reduced frequency
    queryFn: async () => {
      if (!memberId) return 0;

      // Single query to count all unread messages in conversations where user is a participant
      // We first need the conversation IDs
      const { data: convos } = await supabase
        .from("conversations")
        .select("id")
        .or(`participant_1.eq.${memberId},participant_2.eq.${memberId}`);

      if (!convos || convos.length === 0) return 0;

      const convoIds = convos.map(c => c.id);

      const { count, error } = await supabase
        .from("dm_messages")
        .select("*", { count: "exact", head: true })
        .in("conversation_id", convoIds)
        .neq("sender_id", memberId)
        .is("read_at", null);

      if (error) {
        console.error("Error fetching unread count:", error);
        return 0;
      }

      return count ?? 0;
    },
  });
}