import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';

/**
 * useRevealVideo — delays mounting the remote RTCView for `delayMs`,
 * then fades it in over `fadeDurationMs`.
 *
 * While hidden, render your placeholder. Once `showVideo` is true,
 * render RTCView wrapped in an Animated.View with style={{ opacity: videoOpacity }}.
 *
 * @param isConnected     Whether the call is in 'connected' state.
 * @param partnerId       The current partner's ID — resets the timer on every new match.
 * @param delayMs         How long to show the placeholder before revealing video (default 3000ms).
 * @param fadeDurationMs  How long the fade-in takes (default 600ms).
 */
export function useRevealVideo(
  isConnected: boolean,
  partnerId: string | null | undefined,
  delayMs = 3000,
  fadeDurationMs = 600,
) {
  const [showVideo, setShowVideo] = useState(false);
  const videoOpacity = useRef(new Animated.Value(0)).current;
  const prevPartnerIdRef = useRef<string | null | undefined>(null);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeRef = useRef<Animated.CompositeAnimation | null>(null);

  const reset = () => {
    if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    fadeRef.current?.stop();
    setShowVideo(false);
    videoOpacity.setValue(0);
  };

  useEffect(() => {
    const newPartner =
      isConnected &&
      partnerId != null &&
      partnerId !== prevPartnerIdRef.current;

    prevPartnerIdRef.current = isConnected ? partnerId : null;

    if (!isConnected) {
      reset();
      return;
    }

    if (!newPartner) return;

    // New partner — reset and start timer
    reset();

    delayTimerRef.current = setTimeout(() => {
      setShowVideo(true);
      fadeRef.current = Animated.timing(videoOpacity, {
        toValue: 1,
        duration: fadeDurationMs,
        useNativeDriver: true,
      });
      fadeRef.current.start();
    }, delayMs);

    return () => {
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
      fadeRef.current?.stop();
    };
  }, [partnerId, isConnected]);

  return { showVideo, videoOpacity };
}