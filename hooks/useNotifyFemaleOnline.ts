import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const STORAGE_KEY = 'notify_female_searching';

export function useNotifyFemaleOnline() {
  const [enabled, setEnabledState] = useState<boolean>(true);
  const [loaded, setLoaded] = useState(false);

  // Load persisted value on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === null) {
        // Default: true
        setEnabledState(true);
      } else {
        setEnabledState(val === 'true');
      }
      setLoaded(true);
    });
  }, []);

  const setEnabled = useCallback(async (value: boolean) => {
    setEnabledState(value);
    await AsyncStorage.setItem(STORAGE_KEY, String(value));

    if (value) {
      // Request push notification permissions when toggling on
      try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') {
          await Notifications.requestPermissionsAsync();
        }
      } catch (_) {
        // expo-notifications may not be fully configured yet — ignore
      }
    }
  }, []);

  return { enabled, setEnabled, loaded };
}