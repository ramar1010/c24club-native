/**
 * useNsfwRestriction
 *
 * Checks whether the current user has been shadowbanned from starting calls
 * by looking at their nsfw_strike_count in the members table.
 *
 * A user is considered restricted if nsfw_strike_count >= 1.
 *
 * The check is:
 *  - Run once on mount / when userId changes
 *  - Re-run whenever `recheck()` is called (e.g. after a frame scan flags them)
 *  - Kept lightweight: single column select, no realtime subscription needed
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface UseNsfwRestrictionReturn {
  isRestricted: boolean;
  loading: boolean;
  recheck: () => Promise<void>;
}

export function useNsfwRestriction(userId: string | null | undefined): UseNsfwRestrictionReturn {
  const [isRestricted, setIsRestricted] = useState(false);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    if (!userId) {
      setIsRestricted(false);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('members')
        .select('nsfw_strike_count')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn('[useNsfwRestriction] fetch error:', error.message);
        setIsRestricted(false);
      } else {
        const strikes = (data as any)?.nsfw_strike_count ?? 0;
        setIsRestricted(strikes >= 1);
      }
    } catch (err) {
      console.warn('[useNsfwRestriction] unexpected error:', err);
      setIsRestricted(false);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    check();
  }, [check]);

  return { isRestricted, loading, recheck: check };
}