import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { router } from "expo-router";

// Map status → notification body
const STATUS_BODY_MAP: Record<string, string> = {
  processing: (title: string) => `Your ${title} is being processed!`,
  shipped:    (title: string) => `Your ${title} has shipped! 🚚`,
  delivered:  (title: string) => `Your ${title} has been delivered! 🎉`,
  denied:     (title: string) => `Your ${title} redemption was not approved. Check your rewards page for details.`,
} as any;

function getBody(status: string, rewardTitle: string): string | null {
  const fn = (STATUS_BODY_MAP as any)[status];
  return fn ? fn(rewardTitle) : null;
}

/**
 * Subscribes to real-time member_redemptions status updates for the current user
 * and fires a local push notification when the status changes.
 *
 * Deduplication: tracks (redemptionId + status) in an in-memory set with a
 * 60-second TTL to avoid double-firing if the server-side push also arrives.
 */
export function useRedemptionNotifications(userId: string | null | undefined) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  // In-memory dedup set: "redemptionId:status" → timestamp shown
  const shownRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`redemption-status-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "member_redemptions",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const oldStatus = payload.old?.status as string | undefined;
          const newStatus = payload.new?.status as string;
          const rewardTitle = payload.new?.reward_title as string;
          const rewardImageUrl = payload.new?.reward_image_url as string | null;
          const redemptionId = payload.new?.id as string;

          // Only fire if status actually changed
          if (!newStatus || oldStatus === newStatus) return;

          const body = getBody(newStatus, rewardTitle);
          if (!body) return; // unknown status, skip

          // Deduplication: skip if same redemption+status was shown in last 60s
          const dedupKey = `${redemptionId}:${newStatus}`;
          const lastShown = shownRef.current.get(dedupKey);
          const now = Date.now();
          if (lastShown && now - lastShown < 60_000) return;
          shownRef.current.set(dedupKey, now);

          // Clean up old dedup entries (> 60s)
          shownRef.current.forEach((ts, key) => {
            if (now - ts > 60_000) shownRef.current.delete(key);
          });

          // Build notification content
          const content: Notifications.NotificationContentInput = {
            title: `🎁 Reward Update: ${rewardTitle}`,
            body,
            data: {
              screen: "profile",
              deepLink: "profile",
            },
            sound: "default",
          };

          // Attach image if available (iOS attachment / Android large icon)
          if (rewardImageUrl) {
            (content as any).attachments = [{ url: rewardImageUrl }];
          }

          if (Platform.OS !== 'web') {
            Notifications.scheduleNotificationAsync({
              content,
              trigger: null, // immediate
            });
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId]);
}