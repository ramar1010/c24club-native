import { useState, useEffect, useRef, useCallback } from 'react';
import { Animated } from 'react-native';
import { supabase } from '@/lib/supabase';
import { createGiftCheckout, checkIsPremiumVip } from '@/lib/gift-utils';
import Toast from 'react-native-toast-message';

export function useGiftFeature(partnerId: string | null | undefined, callState: string) {
  const [showGiftIcon, setShowGiftIcon] = useState(false);
  const [showGiftOverlay, setShowGiftOverlay] = useState(false);
  const [giftLoading, setGiftLoading] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState('this user');
  const [showGiftCelebration, setShowGiftCelebration] = useState(false);

  const giftPulseAnim = useRef(new Animated.Value(1)).current;
  const giftPulseRef = useRef<Animated.CompositeAnimation | null>(null);

  // VIP check when partner changes
  useEffect(() => {
    if (!partnerId || callState !== 'connected') {
      setShowGiftIcon(false);
      setShowGiftOverlay(false);
      return;
    }
    (async () => {
      try {
        const isPremium = await checkIsPremiumVip(partnerId);
        if (isPremium) {
          setShowGiftIcon(true);
          const { data: partner } = await supabase
            .from('members')
            .select('name')
            .eq('id', partnerId)
            .single();
          setPartnerName((partner as any)?.name || 'this user');
        } else {
          setShowGiftIcon(false);
        }
      } catch (_) {
        setShowGiftIcon(false);
      }
    })();
  }, [partnerId, callState]);

  // Reset gift state on disconnect
  useEffect(() => {
    if (callState !== 'connected') {
      setShowGiftIcon(false);
      setShowGiftOverlay(false);
    }
  }, [callState]);

  // Pulse animation when gift icon appears
  useEffect(() => {
    if (showGiftIcon) {
      giftPulseAnim.setValue(1);
      let count = 0;
      const runPulse = () => {
        if (count >= 3) {
          giftPulseAnim.setValue(1);
          return;
        }
        giftPulseRef.current = Animated.sequence([
          Animated.timing(giftPulseAnim, { toValue: 1.15, duration: 350, useNativeDriver: true }),
          Animated.timing(giftPulseAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
        ]);
        giftPulseRef.current.start(() => {
          count++;
          runPulse();
        });
      };
      runPulse();
      return () => {
        giftPulseRef.current?.stop();
      };
    }
  }, [showGiftIcon, giftPulseAnim]);

  const handleGiftTier = useCallback(async (tier: string) => {
    if (!partnerId) return;
    setGiftLoading(tier);
    try {
      const tierId = parseInt(tier, 10);
      const result = await createGiftCheckout(tierId, partnerId);
      if (result.success) {
        setShowGiftOverlay(false);
        setShowGiftCelebration(true);
      } else if (result.error === 'cancelled') {
        // user cancelled — do nothing
      } else {
        Toast.show({
          type: 'dmToast',
          text1: '❌ Purchase Failed',
          text2: result.error || 'Something went wrong',
          visibilityTime: 8000,
        });
      }
    } catch (err: any) {
      Toast.show({
        type: 'dmToast',
        text1: '❌ Purchase Error',
        text2: err?.message || 'Unknown error',
        visibilityTime: 8000,
      });
    } finally {
      setGiftLoading(null);
    }
  }, [partnerId]);

  return {
    showGiftIcon,
    showGiftOverlay,
    setShowGiftOverlay,
    giftLoading,
    partnerName,
    showGiftCelebration,
    setShowGiftCelebration,
    giftPulseAnim,
    handleGiftTier,
  };
}