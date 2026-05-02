import { useEffect, useRef, useState, useCallback } from 'react';
import { Animated } from 'react-native';

/**
 * usePreBlur — opaque safety shield whenever a new partner connects.
 *
 * Phase 1 (t=0ms):      Shield snaps on instantly (full opacity).
 * Phase 2 (t=durationMs): Shield fades out over 800ms.
 *
 * @param isConnected - Whether the call is in 'connected' state.
 * @param partnerId   - The current partner's ID (null when no partner).
 * @param durationMs  - How long to keep the shield before fading (default 4000ms).
 */
export function usePreBlur(
  isConnected: boolean,
  partnerId: string | null | undefined,
  durationMs = 4000,
) {
  const [isBlurred, setIsBlurred] = useState(false);
  const blurOpacity = useRef(new Animated.Value(0)).current;
  const prevPartnerIdRef = useRef<string | null | undefined>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  // countdown for display
  const [secondsLeft, setSecondsLeft] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (fadeTimerRef.current) { clearTimeout(fadeTimerRef.current); fadeTimerRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    fadeAnimRef.current?.stop();
    setIsBlurred(false);
    setSecondsLeft(0);
    blurOpacity.setValue(0);
  }, [blurOpacity]);

  const triggerBlur = useCallback(() => {
    cleanup();

    blurOpacity.setValue(1);
    setIsBlurred(true);
    setSecondsLeft(Math.ceil(durationMs / 1000));

    // Countdown ticker
    countdownRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Fade out after durationMs
    fadeTimerRef.current = setTimeout(() => {
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
      fadeAnimRef.current = Animated.timing(blurOpacity, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      });
      fadeAnimRef.current.start(({ finished }) => {
        if (finished) setIsBlurred(false);
      });
    }, durationMs);
  }, [cleanup, blurOpacity, durationMs]);

  useEffect(() => {
    const newPartnerArrived =
      isConnected &&
      partnerId != null &&
      partnerId !== prevPartnerIdRef.current;

    prevPartnerIdRef.current = isConnected ? partnerId : null;

    if (!newPartnerArrived) {
      if (!isConnected) cleanup();
      return;
    }

    triggerBlur();

    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      fadeAnimRef.current?.stop();
    };
  }, [partnerId, isConnected]);

  return { isBlurred, blurOpacity, secondsLeft };
}