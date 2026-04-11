/**
 * useSkipPenalty.ts
 * Deducts minutes if user skips before 30 seconds (Quick Skip penalty).
 * Matches web app's SkipPenaltyPopup logic.
 */
import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const QUICK_SKIP_THRESHOLD_SECONDS = 30;
const SKIP_PENALTY_MINUTES = 1;

export function useSkipPenalty(userId: string) {
  const { minutes } = useAuth();
  const [minutesLost, setMinutesLost] = useState(0);
  const [showPenaltyToast, setShowPenaltyToast] = useState(false);

  const dismissToast = useCallback(() => setShowPenaltyToast(false), []);

  const checkAndApplyPenalty = useCallback(async (elapsedSeconds: number) => {
    if (!userId || userId === 'anonymous') return false;
    
    // Premium VIP users don't lose minutes for quick skips
    if (minutes?.is_vip && minutes.vip_tier === 'premium') return false;
    
    if (elapsedSeconds >= QUICK_SKIP_THRESHOLD_SECONDS) return false;

    // Quick skip — deduct minutes
    const { data } = await supabase.functions.invoke('earn-minutes', {
      body: { type: 'deduct', userId, amount: SKIP_PENALTY_MINUTES },
    });

    if (data?.success) {
      setMinutesLost(SKIP_PENALTY_MINUTES);
      setShowPenaltyToast(true);
      // Auto-dismiss after 2.8s (matches MinuteLossToast)
      setTimeout(() => setShowPenaltyToast(false), 2800);
      return true;
    }
    return false;
  }, [userId]);

  return { minutesLost, showPenaltyToast, checkAndApplyPenalty, dismissToast };
}