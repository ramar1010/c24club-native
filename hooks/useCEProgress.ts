import { useAuth } from '@/contexts/AuthContext';

/**
 * useCEProgress Hook
 * Provides current CE % and progress toward next boost.
 */
export const useCEProgress = () => {
  const { minutes } = useAuth();

  if (!minutes) {
    return {
      currentCE: 0,
      progress: 0,
      threshold: 200,
      remaining: 200,
      isMaxed: false,
      percentage: 0,
      cap: 25
    };
  }

  const { total_minutes, ce_minutes_checkpoint = 0, is_vip = false, chance_enhancer = 0 } = minutes;
  const threshold = is_vip ? 150 : 200;
  const cap = is_vip ? 45 : 25;

  // Use default 0 for total_minutes to avoid NaN calculations
  const currentMinutes = total_minutes ?? 0;
  const earnedSinceCheckpoint = Math.max(0, currentMinutes - ce_minutes_checkpoint);
  const progress = Math.min(earnedSinceCheckpoint, threshold);
  const remaining = Math.max(0, threshold - progress);
  const isMaxed = chance_enhancer >= cap;

  // Progress towards next boost
  let percentage = 0;
  if (isMaxed) {
    percentage = 100;
  } else {
    const calculated = (progress / threshold) * 100;
    percentage = isNaN(calculated) ? 0 : Math.min(100, calculated);
  }

  return {
    currentCE: chance_enhancer,
    progress,
    threshold,
    remaining,
    isMaxed,
    percentage,
    cap
  };
};