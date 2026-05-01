import { useEffect, useRef, useState, useCallback } from 'react';
import { Animated } from 'react-native';
import { captureRef } from 'react-native-view-shot';

/**
 * usePreBlur — 3-phase safety blur whenever a new partner connects.
 *
 * Phase 1 (t=0ms):      Black shield appears instantly.
 * Phase 2 (t=200ms):    Snapshot taken at 32×56px, upscaled with blurRadius=20.
 *                        Shield swaps for the pixelated snapshot overlay.
 * Phase 3 (t=4000ms):   Snapshot fades out over 800ms, then unmounts.
 *
 * @param isConnected - Whether the call is in 'connected' state.
 * @param partnerId   - The current partner's ID (null when no partner).
 * @param videoRef    - Ref to the View wrapping RTCView (used for captureRef).
 * @param durationMs  - How long to keep the blur before fading (default 4000ms).
 */
export function usePreBlur(
  isConnected: boolean,
  partnerId: string | null | undefined,
  videoRef: React.RefObject<any>,
  durationMs = 4000,
) {
  // Phase 1: show opaque black shield immediately
  const [showShield, setShowShield] = useState(false);
  // Phase 2: show pixelated snapshot overlay
  const [frozenUri, setFrozenUri] = useState<string | null>(null);

  const blurOpacity = useRef(new Animated.Value(0)).current;
  const prevPartnerIdRef = useRef<string | null | undefined>(null);
  const snapshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const cleanup = useCallback(() => {
    if (snapshotTimerRef.current) { clearTimeout(snapshotTimerRef.current); snapshotTimerRef.current = null; }
    if (fadeTimerRef.current) { clearTimeout(fadeTimerRef.current); fadeTimerRef.current = null; }
    fadeAnimRef.current?.stop();
    setShowShield(false);
    setFrozenUri(null);
    blurOpacity.setValue(0);
  }, [blurOpacity]);

  const triggerBlur = useCallback(() => {
    cleanup();

    // Phase 1 — black shield, instant
    setShowShield(true);
    blurOpacity.setValue(1);

    // Phase 2 — snapshot at 200ms
    snapshotTimerRef.current = setTimeout(async () => {
      try {
        if (videoRef.current) {
          const uri = await captureRef(videoRef, {
            format: 'jpg',
            quality: 0.1,
            width: 32,
            height: 56,
            result: 'tmpfile',
          });
          setFrozenUri(uri);
          setShowShield(false); // swap shield for snapshot
        }
      } catch {
        // If snapshot fails, keep the shield up — it will still fade out below
      }

      // Phase 3 — start fade after durationMs
      fadeTimerRef.current = setTimeout(() => {
        fadeAnimRef.current = Animated.timing(blurOpacity, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        });
        fadeAnimRef.current.start(({ finished }) => {
          if (finished) {
            setFrozenUri(null);
            setShowShield(false);
          }
        });
      }, durationMs);
    }, 200);
  }, [cleanup, videoRef, blurOpacity, durationMs]);

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
      if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      fadeAnimRef.current?.stop();
    };
  }, [partnerId, isConnected]);

  // isBlurred = true during phase 1 OR phase 2 (anything visible)
  const isBlurred = showShield || frozenUri !== null;

  return { isBlurred, showShield, frozenUri, blurOpacity };
}