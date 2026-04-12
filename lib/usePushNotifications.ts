import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, DeviceEventEmitter } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

// Tell Expo how to handle notifications while the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const type = notification.request.content.data?.type as string | undefined;

    // Suppress incoming call banners — in-app modal handles these via polling
    if (type === 'incoming_direct_call') {
      return {
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    }

    // Show all other notifications normally
    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    };
  },
});

export function usePushNotifications() {
  const router = useRouter();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const coldLaunchHandled = useRef(false);

  // ── Helper: handle a notification response (tap) ───────────────────────────
  const handleNotificationResponse = async (response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data as Record<string, any>;
    const type = data?.type as string | undefined;
    console.log('[usePushNotifications] Notification tapped, type:', type, 'data:', JSON.stringify(data));

    // ── Incoming direct call tap ───────────────────────────────────────────
    if (type === 'incoming_direct_call') {
      const inviteId = data?.inviteId as string | undefined;
      if (!inviteId) return;

      try {
        const { data: invite } = await supabase
          .from('direct_call_invites')
          .select('status, expires_at')
          .eq('id', inviteId)
          .maybeSingle();

        if (
          !invite ||
          invite.status !== 'pending' ||
          new Date(invite.expires_at) < new Date()
        ) {
          console.log('[usePushNotifications] Incoming call invite expired or no longer pending');
          DeviceEventEmitter.emit('incoming-call-expired', { inviteId });
          return;
        }

        DeviceEventEmitter.emit('open-incoming-call', {
          inviteId: data.inviteId,
          inviterId: data.inviterId,
          inviterName: data.inviterName,
          inviterImage: data.inviterImage ?? null,
          expiresAt: data.expiresAt,
        });
      } catch (err) {
        console.warn('[usePushNotifications] Error validating incoming call invite:', err);
      }
      return;
    }

    // ── VIP gifting notification tap → /vip with gifting highlight ─────────
    if (type === 'vip_gifting_reminder' || type === 'vip_gift_attempt') {
      try {
        router.push({ pathname: '/vip', params: { highlight: 'gifting' } } as any);
      } catch (err) {
        console.warn('[usePushNotifications] VIP nav error:', err);
      }
      return;
    }

    // ── Missed call tap → navigate to screen ──────────────────────────────
    if (type === 'missed_direct_call') {
      const screen = data?.screen as string | undefined;
      if (screen) {
        try {
          router.push(screen as any);
        } catch (err) {
          console.warn('[usePushNotifications] Missed call nav error:', err);
        }
      }
      return;
    }

    // ── Generic: navigate to data.screen or data.deepLink ─────────────────
    if (data?.screen) {
      try {
        router.push(data.screen as any);
      } catch (err) {
        console.warn('[usePushNotifications] Navigation error:', err);
      }
    } else if (data?.deepLink) {
      try {
        router.push(data.deepLink as any);
      } catch (err) {
        console.warn('[usePushNotifications] DeepLink navigation error:', err);
      }
    }
  };

  useEffect(() => {
    // Skip on web or simulators/emulators
    if (Platform.OS === 'web') return;
    if (!Device.isDevice) {
      console.log('[usePushNotifications] Skipping — not a real device');
      return;
    }

    let cancelled = false;

    async function register() {
      try {
        // 1. Request permissions
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          console.log('[usePushNotifications] Permission not granted');
          return;
        }

        // 2. Set up Android notification channels
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'C24 Club',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#EF4444',
          });
          await Notifications.setNotificationChannelAsync('incoming_calls', {
            name: 'Incoming Calls',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 500, 250, 500],
            lightColor: '#EF4444',
            sound: 'default',
            enableLights: true,
            enableVibrate: true,
            showBadge: true,
          });
          await Notifications.setNotificationChannelAsync('promotions', {
            name: 'Promotions & Offers',
            importance: Notifications.AndroidImportance.DEFAULT,
            sound: 'default',
          });
        }

        // 3. Get the Expo push token
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: '3f21aa81-c90d-4050-b1a6-80b40a69cf31',
        });
        const token: string = tokenData.data;

        if (!token || cancelled) return;

        console.log('[usePushNotifications] Expo push token:', token);

        // 4. Save token to Supabase members table
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user?.id) {
          console.warn('[usePushNotifications] Could not get current user:', userError?.message);
          return;
        }

        const userId = userData.user.id;

        const { error: updateError } = await supabase
          .from('members')
          .update({ push_token: token })
          .eq('id', userId);

        if (updateError) {
          console.warn('[usePushNotifications] Failed to save push token:', updateError.message);
        } else {
          console.log('[usePushNotifications] Expo push token saved for user:', userId);
        }
      } catch (err) {
        console.warn('[usePushNotifications] Registration error:', err);
      }
    }

    register();

    // ── Cold-launch handler: catches taps that opened the app from killed state
    if (!coldLaunchHandled.current) {
      coldLaunchHandled.current = true;
      Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response) {
          // Small delay to ensure the router is fully mounted
          setTimeout(() => handleNotificationResponse(response), 300);
        }
      }).catch(console.warn);
    }

    // 5. Foreground listener — just log (handler above controls visibility)
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        const type = notification.request.content.data?.type;
        console.log('[usePushNotifications] Foreground notification received, type:', type);
      }
    );

    // 6. Response listener — user tapped a notification (app in bg/fg)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        await handleNotificationResponse(response);
      }
    );

    return () => {
      cancelled = true;
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);
}