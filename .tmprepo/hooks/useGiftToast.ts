import { useEffect } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Toast from 'react-native-toast-message';

/**
 * useGiftToast
 *
 * Subscribes to gift_transactions via Supabase Realtime.
 * Shows a gold in-app toast banner when:
 *   - A gift transaction is inserted with the current user as recipient
 *   - The transaction status is 'completed'
 *
 * Works globally — random video chats, direct calls, DMs, Discover, etc.
 */
export function useGiftToast() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`gift-toast-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gift_transactions',
          filter: `recipient_id=eq.${user.id}`,
        },
        async (payload) => {
          const tx = payload.new as {
            id: string;
            sender_id: string;
            recipient_id: string;
            tier_id: number;
            minutes: number;
            cash_value: number;
            status: string;
          };

          // Only show toast for completed gifts
          if (tx.status !== 'completed') return;

          // Skip if app is in background
          if (AppState.currentState !== 'active') return;

          // Look up sender name
          const { data: sender } = await supabase
            .from('members')
            .select('name')
            .eq('id', tx.sender_id)
            .maybeSingle();

          const senderName = sender?.name ?? 'Someone';
          const cashValue = tx.cash_value ? `$${tx.cash_value.toFixed(2)}` : null;
          const minutes = tx.minutes ? Math.round(tx.minutes) : null;

          Toast.show({
            type: 'giftToast',
            text1: `🎁 ${senderName} sent you a gift!`,
            text2: cashValue && minutes
              ? `You received ${cashValue} cash (${minutes} minutes)`
              : minutes
              ? `You received ${minutes} minutes`
              : 'You received a gift!',
            position: 'top',
            visibilityTime: 5000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);
}