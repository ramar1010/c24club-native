import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, DeviceEventEmitter } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

// Tell Expo how to handle notifications while the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const type = notification.request.content.data?.type as string | undefined;
    console.log('[usePushNotifications] Foreground notification received handler, type:', type);

    // Suppress incoming call banners — in-app modal handles these via polling
    if (type === 'incoming_direct_call') {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    }

    // Show all other notifications normally
    return {
      shouldShowAlert: true,
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

  // ── Helper: log when a user taps a push notification ──────────────────────
  const logPushOpen = async (notificationType?: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) return;
      await supabase.functions.invoke('log-push-open', {
        body: {
          user_id: userId,
          notification_type: notificationType ?? null,
          platform: Platform.OS,
        },
      });
    } catch (err) {
      console.warn('[usePushNotifications] Failed to log push open:', err);
    }
  };

  // ── Helper: handle a notification response (tap) ───────────────────────────
  const handleNotificationResponse = async (response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data as Record<string, any>;
    const type = data?.type as string | undefined;
    console.log('[usePushNotifications] Notification tapped, type:', type, 'data:', JSON.stringify(data));

    // Log the push open for analytics / maintenance tracking
    logPushOpen(type);

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
        const params = data?.params ? (typeof data.params === 'string' ? JSON.parse(data.params) : data.params) : {};
        router.push({ pathname: data.screen, params } as any);
      } catch (err) {
        console.warn('[usePushNotifications] Navigation error:', err);
        // Fallback to simple push if params parsing fails
        router.push(data.screen as any);
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
      console.log('[usePushNotifications] Starting registration process...');
      try {
        // 1. Request permissions
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        console.log('[usePushNotifications] Existing permission status:', existingStatus);

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
          console.log('[usePushNotifications] Requested permission status:', finalStatus);
        }

        if (finalStatus !== 'granted') {
          console.log('[usePushNotifications] Permission not granted, aborting registration');
          return;
        }

        // 2. Set up Android notification channels
        if (Platform.OS === 'android') {
          console.log('[usePushNotifications] Setting up Android notification channels...');
          await Notifications.setNotificationChannelAsync('default', {
            name: 'C24 Club',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#EF4444',
            showBadge: true,
            enableLights: true,
            enableVibrate: true,
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
            bypassDnd: true,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          });
          await Notifications.setNotificationChannelAsync('promotions', {
            name: 'Promotions & Offers',
            importance: Notifications.AndroidImportance.DEFAULT,
            sound: 'default',
          });
          console.log('[usePushNotifications] Android notification channels configured');
        }

        // 3. Get the Expo push token
        console.log('[usePushNotifications] Fetching Expo push token...');
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId || '3f21aa81-c90d-4050-b1a6-80b40a69cf31';
        console.log('[usePushNotifications] Using projectId:', projectId);

        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId,
        });
        const token: string = tokenData.data;

        if (!token) {
          console.warn('[usePushNotifications] Received empty token from Expo');
          return;
        }

        if (cancelled) {
          console.log('[usePushNotifications] Registration cancelled before token could be saved');
          return;
        }

        console.log('[usePushNotifications] Expo push token acquired:', token);

        // 4. Save token to Supabase members table
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user?.id) {
          console.warn('[usePushNotifications] Could not get current user for token storage:', userError?.message);
          return;
        }

        const userId = userData.user.id;
        console.log('[usePushNotifications] Saving token for user:', userId);

        const { error: updateError } = await supabase
          .from('members')
          .update({ push_token: token })
          .eq('id', userId);

        if (updateError) {
          console.warn('[usePushNotifications] Failed to save push token to database:', updateError.message);
        } else {
          console.log('[usePushNotifications] Expo push token successfully saved to backend');
        }
      } catch (err) {
        console.warn('[usePushNotifications] Registration error occurred:', err);
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