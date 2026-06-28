import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const SUPABASE_URL = 'https://ncpbiymnafxdfsvpxirb.supabase.co';
const CHECK_INTERVAL_MS = 5000; // check every 5 seconds

interface UseFrameModerationOptions {
  /** Whether moderation is active (call is connected) */
  enabled: boolean;
  /** The reported user's ID (partner) */
  reportedUserId: string | null;
  /** Callback fired when the frame is flagged — caller should disconnect */
  onFlagged: (reason: string) => void;
}

/**
 * Web-only hook that periodically captures a frame from the partner's
 * <video> element and sends it to the moderate-frame edge function.
 * If explicit content is detected, onFlagged() is called so the caller
 * can auto-disconnect and show a warning.
 *
 * This file is web-only (*.web.ts) — it will never be bundled on mobile.
 */
export function useFrameModeration({
  enabled,
  reportedUserId,
  onFlagged,
}: UseFrameModerationOptions) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFlaggedRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const captureAndCheck = useCallback(async () => {
    if (!reportedUserId || isFlaggedRef.current) return;

    // Find the partner's remote video element in the DOM
    // react-native-webrtc on web renders as a <video> element
    const videos = document.querySelectorAll('video');
    if (videos.length === 0) return;

    // Use the last video element (typically the remote stream)
    const remoteVideo = videos[videos.length - 1] as HTMLVideoElement;
    if (!remoteVideo || remoteVideo.readyState < 2) return;

    try {
      // Create canvas if needed
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      const canvas = canvasRef.current;

      // Capture at reduced resolution for efficiency
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(remoteVideo, 0, 0, canvas.width, canvas.height);

      // Convert to base64 JPEG (quality 0.7 to keep payload small)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

      // Get current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/moderate-frame`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            frame: base64,
            reported_user_id: reportedUserId,
          }),
        }
      );

      if (!res.ok) return;

      const data = await res.json();

      if (data.flagged) {
        isFlaggedRef.current = true;
        onFlagged(data.reason ?? 'inappropriate_content');
      }
    } catch (err) {
      // Silently fail — never disrupt the call due to moderation errors
      console.warn('[FrameModeration] Check failed:', err);
    }
  }, [reportedUserId, onFlagged]);

  useEffect(() => {
    if (!enabled || !reportedUserId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      isFlaggedRef.current = false;
      return;
    }

    // Small initial delay to let the video stream stabilize
    const startTimeout = setTimeout(() => {
      captureAndCheck();
      intervalRef.current = setInterval(captureAndCheck, CHECK_INTERVAL_MS);
    }, 4000);

    return () => {
      clearTimeout(startTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, reportedUserId, captureAndCheck]);

  // Reset flagged state between calls
  const reset = useCallback(() => {
    isFlaggedRef.current = false;
  }, []);

  return { reset };
}