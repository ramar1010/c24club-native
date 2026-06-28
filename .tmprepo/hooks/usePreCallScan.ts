/**
 * usePreCallScan (native only — iOS & Android)
 *
 * When the user starts searching for a match (callState transitions to 'waiting'),
 * this hook takes a single snapshot from their front camera via expo-camera and
 * sends it to the moderate-frame edge function.
 *
 * If their own camera feed is flagged as explicit:
 *   - onFlagged() is called so the caller can stop the search
 *   - A report + potential auto-ban is filed server-side
 *
 * The CameraView ref must be passed in from the parent — this hook does NOT render
 * any camera component itself.
 */

import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

const SUPABASE_URL = 'https://ncpbiymnafxdfsvpxirb.supabase.co';

interface UsePreCallScanOptions {
  /** Ref to an expo-camera CameraView instance */
  cameraRef: React.RefObject<any>;
  /** The current user's own ID (they are the one being scanned) */
  userId: string | null;
  /** Callback fired if the scan detects inappropriate content */
  onFlagged: () => void;
}

export function usePreCallScan({ cameraRef, userId, onFlagged }: UsePreCallScanOptions) {
  const isScanning = useRef(false);

  const scan = useCallback(async (): Promise<boolean> => {
    // Web uses the canvas-based approach in useFrameModeration.web.ts
    if (Platform.OS === 'web') return false;
    if (!cameraRef.current || !userId || isScanning.current) return false;

    isScanning.current = true;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.5,
        skipProcessing: true,
        exif: false,
      });

      if (!photo?.base64) return false;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return false;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/moderate-frame`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          frame: photo.base64,
          reported_user_id: userId,
        }),
      });

      if (!res.ok) return false;

      const data = await res.json();

      if (data.flagged) {
        console.warn('[PreCallScan] Local camera flagged:', data.reason, data.score);
        onFlagged();
        return true;
      }

      return false;
    } catch (err) {
      console.warn('[PreCallScan] Scan error:', err);
      return false;
    } finally {
      isScanning.current = false;
    }
  }, [cameraRef, userId, onFlagged]);

  return { scan };
}