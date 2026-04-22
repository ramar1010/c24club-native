import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';

/**
 * usePreBlur — applies a timed blur effect whenever a new partner connects.
 *
 * @param isConnected - Whether the call is in 'connected' state.
 * @param partnerId   - The current partner's ID (null when no partner).
 * @param durationMs  - How long to keep the blur before fading out (default 4000ms).
 * @returns           - { isBlurred, blurOpacity, resetBlur }
 */
export function usePreBlur(
  isConnected: boolean,
  partnerId: string | null | undefined,
  durationMs = 4000,
) {
  const [isBlurred, setIsBlurred] = useState(false);
  const blurOpacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeRef = useRef<Animated.CompositeAnimation | null>(null);
  const prevPartnerIdRef = useRef<string | null | undefined>(null);

  const resetBlur = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    fadeRef.current?.stop();
    blurOpacity.setValue(1);
    setIsBlurred(true);

    timerRef.current = setTimeout(() => {
      fadeRef.current = Animated.timing(blurOpacity, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      });
      
      fadeRef.current.start(({ finished }) => {
        if (finished) {
          setIsBlurred(false);
        }
      });
    }, durationMs);
  };

  useEffect(() => {
    const newPartnerArrived =
      isConnected &&
      partnerId != null &&
      partnerId !== prevPartnerIdRef.current;

    prevPartnerIdRef.current = isConnected ? partnerId : null;

    if (!newPartnerArrived) {
      if (!isConnected) {
        if (timerRef.current) clearTimeout(timerRef.current);
        fadeRef.current?.stop();
        setIsBlurred(false);
        blurOpacity.setValue(0);
      }
      return;
    }

    resetBlur();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      fadeRef.current?.stop();
    };
  }, [partnerId, isConnected]);

  return { isBlurred, blurOpacity, resetBlur };
}