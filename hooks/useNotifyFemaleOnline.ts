import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'notify_female_searching';

export function useNotifyFemaleOnline() {
  const [enabled, setEnabledState] = useState<boolean>(true);
  const [loaded, setLoaded] = useState(false);

  // Load persisted value on mount
  useEffect(() => {
    const load = async () => {
      // 1. Try DB first
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: member } = await supabase
          .from('members')
          .select('notify_female_searching')
          .eq('id', user.id)
          .maybeSingle();
        
        if (member && typeof member.notify_female_searching === 'boolean') {
          setEnabledState(member.notify_female_searching);
          await AsyncStorage.setItem(STORAGE_KEY, String(member.notify_female_searching));
          setLoaded(true);
          return;
        }
      }

      // 2. Fallback to AsyncStorage
      const val = await AsyncStorage.getItem(STORAGE_KEY);
      if (val !== null) {
        setEnabledState(val === 'true');
      } else {
        setEnabledState(true);
      }
      setLoaded(true);
    };
    
    load();
  }, []);

  const setEnabled = useCallback(async (value: boolean) => {
    setEnabledState(value);
    await AsyncStorage.setItem(STORAGE_KEY, String(value));

    // Update DB if user is logged in
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // NOTE: We do not clear push_token here because this is a specific toggle.
      // The master toggle (notify_enabled) handles the global token state.
      await supabase
        .from('members')
        .update({ notify_female_searching: value } as any)
        .eq('id', user.id);
    }

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