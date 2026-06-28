/**
 * useCameraPreviewScan (native only — iOS & Android)
 *
 * While the user is on the idle chat screen (before clicking "Start Chatting"),
 * this hook periodically captures a snapshot from their local camera preview
 * and sends it to the moderate-frame edge function.
 *
 * If a snapshot is flagged:
 *   - onFlagged() is called immediately so the parent can shadowban the UI
 *   - The server side will also increment nsfw_strike_count on the members table
 *
 * Usage:
 *   const { startScanning, stopScanning } = useCameraPreviewScan({
 *     localStream,      // the RTCStream from useVideoChat — used to extract frames
 *     userId,
 *     onFlagged,
 *   });
 *
 * Implementation note:
 *   React Native WebRTC does not expose a direct frame-capture API on MediaStream.
 *   We reuse the existing expo-camera CameraView ref (same one usePreCallScan uses)
 *   to take low-quality snapshots. The caller passes the ref in.
 *
 *   Scanning is intentionally low-frequency (every 20 seconds) to avoid
 *   hammering the Sightengine API or draining battery.
 */

import { useCallback, useRef, useEffect } from 'react';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

const SUPABASE_URL = 'https://ncpbiymnafxdfsvpxirb.supabase.co';
const SCAN_INTERVAL_MS = 20_000; // 20 seconds (safer for mobile hardware to avoid preview flicker)

interface UseCameraPreviewScanOptions {
  /** Ref to an expo-camera CameraView instance (same as usePreCallScan) */
  cameraRef: React.RefObject<any>;
  /** Current authenticated user's ID */
  userId: string | null | undefined;
  /** Whether we should be actively scanning (true = idle state) */
  active: boolean;
  /** Called if a scan detects inappropriate content */
  onFlagged: () => void;
}

export function useCameraPreviewScan({
  cameraRef,
  userId,
  active,
  onFlagged,
}: UseCameraPreviewScanOptions) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isScanning = useRef(false);

  const runScan = useCallback(async (isManual = false) => {
    if (Platform.OS === 'web') return;
    if (!cameraRef.current || !userId || (isScanning.current && !isManual)) return;

    isScanning.current = true;
    try {
      console.log('[CameraPreviewScan] Attempting picture capture...');
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.35,        // lower quality = smaller payload, faster
        skipProcessing: true,
        exif: false,
      });

      if (!photo?.base64) {
        console.warn('[CameraPreviewScan] Capture failed: no base64 data');
        return;
      }

      console.log('[CameraPreviewScan] Capture success, sending to moderation...');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/moderate-frame`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          frame: photo.base64,
          reported_user_id: userId,
          source: 'periodic_scan',
        }),
      });

      if (!res.ok) return;

      const data = await res.json();

      if (data.flagged) {
        console.warn('[CameraPreviewScan] Preview flagged:', data.reason, data.score);
        onFlagged();
      }
    } catch (err) {
      console.warn('[CameraPreviewScan] Scan error:', err);
    } finally {
      isScanning.current = false;
    }
  }, [cameraRef, userId, onFlagged]);

  // Start/stop the interval whenever `active` changes
  useEffect(() => {
    if (!active || Platform.OS === 'web') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Then scan on the regular interval
    intervalRef.current = setInterval(runScan, SCAN_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [active, runScan]);

  return { runScan };
}