import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (!Device.isDevice) {
    console.log('[notifications] Skipping — not a real device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[notifications] Permission not granted');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'C24 Club',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#EF4444',
      showBadge: true,
      enableLights: true,
      enableVibrate: true,
    });
  }

  try {
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId || '3f21aa81-c90d-4050-b1a6-80b40a69cf31';
    console.log('[notifications] Fetching Expo push token for project:', projectId);
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    return tokenData.data ?? null;
  } catch (err) {
    console.warn('[notifications] getExpoPushTokenAsync error:', err);
    return null;
  }
}

export function setupNotificationListeners(
  onResponse: (notification: Notifications.NotificationResponse) => void
): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener(onResponse);
  return () => sub.remove();
}