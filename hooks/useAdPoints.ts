/**
 * useAdPoints.ts — Matches web app's useAdPoints.ts exactly.
 * Awards ad points at end of call based on duration.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface UseAdPointsOptions {
  userId: string;
  isConnected: boolean;
  elapsedSeconds: number;
}

export function useAdPoints({ userId, isConnected, elapsedSeconds }: UseAdPointsOptions) {
  const [adPoints, setAdPoints] = useState(0);
  const adPointsAwardedRef = useRef(false);

  // Fetch initial balance
  useEffect(() => {
    if (!userId || userId === 'anonymous') return;
    supabase.functions
      .invoke('earn-minutes', { body: { type: 'get_balance', userId } })
      .then(({ data }) => {
        if (data?.success) setAdPoints(data.adPoints ?? 0);
      });
  }, [userId]);

  // Reset award flag when new call starts (elapsedSeconds resets to 0)
  useEffect(() => {
    if (elapsedSeconds === 0) adPointsAwardedRef.current = false;
  }, [elapsedSeconds]);

  // Award ad points when call ends
  const awardAdPoints = useCallback(async (callElapsed: number) => {
    if (adPointsAwardedRef.current || !userId || userId === 'anonymous' || callElapsed < 30) return;
    adPointsAwardedRef.current = true;

    const { data } = await supabase.functions.invoke('earn-minutes', {
      body: { type: 'earn_ad_points', userId, elapsedSeconds: callElapsed },
    });

    if (data?.success && data.totalAdPoints !== undefined) {
      setAdPoints(data.totalAdPoints);
    }
  }, [userId]);

  const refreshBalance = useCallback(async () => {
    if (!userId || userId === 'anonymous') return;
    const { data } = await supabase.functions.invoke('earn-minutes', {
      body: { type: 'get_balance', userId },
    });
    if (data?.success) setAdPoints(data.adPoints ?? 0);
  }, [userId]);

  return { adPoints, awardAdPoints, refreshBalance };
}