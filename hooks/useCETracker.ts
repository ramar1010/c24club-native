import { useEffect } from 'react';
import { useAuth, MemberMinutes } from '@/contexts/AuthContext';

/**
 * useCETracker Hook
 * Monitors total_minutes and increments chance_enhancer based on VIP status.
 */
export const useCETracker = () => {
  const { minutes, updateMinutes, user } = useAuth();

  useEffect(() => {
    if (!user || !minutes) return;

    const { 
      total_minutes, 
      ce_minutes_checkpoint = 0, 
      is_vip = false, 
      chance_enhancer = 0 
    } = minutes;
    
    const threshold = is_vip ? 150 : 200;
    const boostAmount = is_vip ? 10 : 5;
    const cap = is_vip ? 45 : 25;

    const earnedSinceCheckpoint = total_minutes - ce_minutes_checkpoint;

    if (earnedSinceCheckpoint >= threshold) {
      const boostCount = Math.floor(earnedSinceCheckpoint / threshold);
      let newCE = chance_enhancer + (boostCount * boostAmount);
      
      const updates: Partial<MemberMinutes> = {
        ce_minutes_checkpoint: ce_minutes_checkpoint + (boostCount * threshold)
      };

      if (chance_enhancer < cap) {
        if (newCE > cap) newCE = cap;
        updates.chance_enhancer = newCE;
      }

      // Perform update
      updateMinutes(updates);
    }
  }, [minutes?.total_minutes, minutes?.ce_minutes_checkpoint, minutes?.is_vip, minutes?.chance_enhancer, user?.id]);
};