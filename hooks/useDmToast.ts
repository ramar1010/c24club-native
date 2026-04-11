import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Toast from 'react-native-toast-message';

/**
 * useDmToast
 *
 * Subscribes to new DM messages via Supabase Realtime.
 * Shows an in-app toast banner when:
 *   - A new message arrives for the current user
 *   - The user is NOT already on the messages screen
 *
 * Groups messages: debounces 3 seconds to batch rapid messages.
 */
export function useDmToast() {
  const { user, profile } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const pendingCount = useRef(0);
  const pendingSender = useRef<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationId = useRef<string | null>(null);

  // Check if user is currently viewing messages
  const isOnMessagesScreen = () => {
    return segments.some(s => s === 'messages');
  };

  useEffect(() => {
    if (!user?.id) return;

    // Subscribe to dm_messages where the current user is a participant
    // We do this by subscribing to all dm_messages inserts and filtering client-side
    const channel = supabase
      .channel(`dm-toast-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dm_messages',
        },
        async (payload) => {
          const msg = payload.new as {
            id: string;
            conversation_id: string;
            sender_id: string;
            text?: string;
            content?: string;
          };

          // Ignore messages sent by the current user
          if (msg.sender_id === user.id) return;

          // Verify this conversation belongs to the current user
          const { data: convo } = await supabase
            .from('conversations')
            .select('participant_1, participant_2')
            .eq('id', msg.conversation_id)
            .maybeSingle();

          if (!convo) return;
          const isRecipient =
            convo.participant_1 === user.id || convo.participant_2 === user.id;
          if (!isRecipient) return;

          // ─── Task 2: Block check ─────────────────────────────────────────
          const { data: blockRecord } = await supabase
            .from('blocked_users')
            .select('id')
            .eq('blocker_id', user.id)
            .eq('blocked_id', msg.sender_id)
            .maybeSingle();

          if (blockRecord) {
            console.log("[useDmToast] Skipping toast: Sender is blocked by user");
            return;
          }
          // ─────────────────────────────────────────────────────────────────

          // Skip if already on the messages screen for this conversation
          if (isOnMessagesScreen()) return;

          // Skip if app is in background (push notification handles that)
          if (AppState.currentState !== 'active') return;

          // Look up sender name
          const { data: sender } = await supabase
            .from('members')
            .select('name')
            .eq('id', msg.sender_id)
            .maybeSingle();

          const senderName = sender?.name ?? 'Someone';
          const messageText = (msg.text || msg.content || '').slice(0, 80);

          // Batch rapid messages within a 3-second window
          pendingCount.current += 1;
          pendingSender.current = senderName;
          conversationId.current = msg.conversation_id;

          if (debounceTimer.current) clearTimeout(debounceTimer.current);

          debounceTimer.current = setTimeout(() => {
            const count = pendingCount.current;
            const name = pendingSender.current ?? 'Someone';
            const convId = conversationId.current;

            Toast.show({
              type: 'dmToast',
              text1: count > 1 ? `💬 ${name}` : `💬 ${name}`,
              text2: count > 1
                ? `You have ${count} unread messages`
                : messageText || 'Sent you a message',
              position: 'top',
              visibilityTime: 4000,
              onPress: () => {
                Toast.hide();
                if (convId) {
                  router.push(`/messages/${convId}` as any);
                } else {
                  router.push('/(tabs)/messages' as any);
                }
              },
            });

            // Reset
            pendingCount.current = 0;
            pendingSender.current = null;
            conversationId.current = null;
            debounceTimer.current = null;
          }, 3000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [user?.id]);
}