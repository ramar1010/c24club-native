import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { purchaseUnfreeze } from '@/lib/gift-utils';

const FREEZE_SNOOZE_KEY = 'freeze_popup_snooze_until';

interface UseFreezeHandlerOptions {
  isFrozen: boolean;
  callState: string;
  showCapPopup: boolean;
  setShowCapPopup: (val: boolean) => void;
  refreshProfile?: () => Promise<void>;
  updateMinutes?: (updates: any) => Promise<void>;
}

export function useFreezeHandler({
  isFrozen,
  callState,
  showCapPopup,
  setShowCapPopup,
  refreshProfile,
  updateMinutes,
}: UseFreezeHandlerOptions) {
  const [showFrozen, setShowFrozen] = useState(false);
  const [unfreezeLoading, setUnfreezeLoading] = useState(false);

  // Show frozen dialog when frozen during an active call
  useEffect(() => {
    if (isFrozen && callState === 'connected') setShowFrozen(true);
  }, [isFrozen, callState]);

  // Suppress freeze/cap popup if user snoozed it
  useEffect(() => {
    if (!showCapPopup && !showFrozen) return;
    AsyncStorage.getItem(FREEZE_SNOOZE_KEY).then((val) => {
      if (val && Date.now() < parseInt(val, 10)) {
        setShowCapPopup(false);
        setShowFrozen(false);
      }
    });
  }, [showCapPopup, showFrozen, setShowCapPopup]);

  const handleCloseFreeze = useCallback(() => {
    setShowCapPopup(false);
    setShowFrozen(false);
  }, [setShowCapPopup]);

  const handleRemindIn2Days = useCallback(async () => {
    const snoozeUntil = Date.now() + 2 * 24 * 60 * 60 * 1000;
    await AsyncStorage.setItem(FREEZE_SNOOZE_KEY, String(snoozeUntil));
    setShowCapPopup(false);
    setShowFrozen(false);
  }, [setShowCapPopup]);

  const handleOneTimeUnfreeze = useCallback(async () => {
    setUnfreezeLoading(true);
    try {
      const result = await purchaseUnfreeze();
      if (result.success) {
        if (updateMinutes) {
          await updateMinutes({ is_frozen: false });
        }
        setTimeout(async () => {
          if (refreshProfile) {
            await refreshProfile();
          }
        }, 1500);

        setShowCapPopup(false);
        setShowFrozen(false);
        Toast.show({
          type: 'success',
          text1: '❄️ Minutes Unfrozen!',
          text2: 'You can now continue earning full minutes.',
        });
      } else if (result.error !== 'cancelled') {
        Toast.show({
          type: 'error',
          text1: '❌ Unfreeze Failed',
          text2: result.error || 'Something went wrong',
        });
      }
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: '❌ Purchase Error',
        text2: err?.message || 'Unknown error',
      });
    } finally {
      setUnfreezeLoading(false);
    }
  }, [refreshProfile, updateMinutes, setShowCapPopup]);

  return {
    showFrozen,
    setShowFrozen,
    unfreezeLoading,
    handleCloseFreeze,
    handleRemindIn2Days,
    handleOneTimeUnfreeze,
  };
}