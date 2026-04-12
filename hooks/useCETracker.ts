import { useEffect, useRef } from 'react';
import { useAuth, MemberMinutes } from '@/contexts/AuthContext';

/**
 * useCETracker Hook
 *
 * Handles the full Chance Enhancer lifecycle on every auth/minutes change:
 *   1. Enforce minimum CE floor (5% non-VIP, 15% VIP)
 *   2. Decay CE for missed login days (60% non-VIP, 50% VIP)
 *   3. Grow CE based on call minutes vs checkpoint
 *   4. Update login_streak and last_streak_login_at
 */
export const useCETracker = () => {
  const { minutes, updateMinutes, user } = useAuth();
  // Prevent running twice in the same session
  const hasCheckedDecay = useRef(false);

  // ── DECAY + STREAK CHECK (runs once per session on login) ──────────────────
  useEffect(() => {
    if (!user || !minutes || hasCheckedDecay.current) return;
    hasCheckedDecay.current = true;

    const {
      is_vip = false,
      admin_granted_vip = false,
      chance_enhancer = 0,
      last_streak_login_at,
      login_streak = 0,
    } = minutes;

    const vip = is_vip || admin_granted_vip;
    const minCE = vip ? 15 : 5;
    const decayFactor = vip ? 0.5 : 0.6;
    const now = new Date();

    const updates: Partial<MemberMinutes> = {};

    if (last_streak_login_at) {
      const lastLogin = new Date(last_streak_login_at);

      // Midnight-boundary difference in days
      const lastMidnight = new Date(lastLogin);
      lastMidnight.setHours(0, 0, 0, 0);
      const todayMidnight = new Date(now);
      todayMidnight.setHours(0, 0, 0, 0);
      const dayDiff = Math.floor(
        (todayMidnight.getTime() - lastMidnight.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (dayDiff === 0) {
        // Same day — no decay, no streak change needed
      } else if (dayDiff === 1) {
        // Consecutive day — extend streak, no decay
        updates.login_streak = login_streak + 1;
        updates.last_streak_login_at = now.toISOString();
      } else {
        // Missed ≥1 day — apply decay for each missed day, reset streak
        let decayed = chance_enhancer;
        const missedDays = dayDiff - 1; // days with no login
        for (let i = 0; i < missedDays; i++) {
          decayed = decayed * (1 - decayFactor);
        }
        // Enforce floor after decay
        decayed = Math.max(minCE, Math.round(decayed * 10) / 10);
        updates.chance_enhancer = decayed;
        updates.login_streak = 1;
        updates.last_streak_login_at = now.toISOString();
      }
    } else {
      // First ever login — set streak and timestamp
      updates.login_streak = 1;
      updates.last_streak_login_at = now.toISOString();
    }

    // Enforce minimum CE floor regardless (in case they were at 0)
    const currentCE = (updates.chance_enhancer ?? chance_enhancer);
    if (currentCE < minCE) {
      updates.chance_enhancer = minCE;
    }

    if (Object.keys(updates).length > 0) {
      updateMinutes(updates);
    }
  }, [user?.id, minutes?.user_id]);

  // ── GROWTH CHECK (runs whenever total_minutes changes) ─────────────────────
  useEffect(() => {
    if (!user || !minutes) return;

    const {
      total_minutes,
      ce_minutes_checkpoint = 0,
      is_vip = false,
      admin_granted_vip = false,
      chance_enhancer = 0,
    } = minutes;

    const vip = is_vip || admin_granted_vip;
    const threshold = vip ? 150 : 200;
    const boostAmount = vip ? 10 : 5;
    const cap = vip ? 45 : 25;
    const minCE = vip ? 15 : 5;

    const earnedSinceCheckpoint = total_minutes - ce_minutes_checkpoint;

    if (earnedSinceCheckpoint >= threshold) {
      const boostCount = Math.floor(earnedSinceCheckpoint / threshold);
      const newCheckpoint = ce_minutes_checkpoint + boostCount * threshold;

      const updates: Partial<MemberMinutes> = {
        ce_minutes_checkpoint: newCheckpoint,
      };

      // Only boost CE if not already at cap
      if (chance_enhancer < cap) {
        const boosted = Math.min(cap, chance_enhancer + boostCount * boostAmount);
        updates.chance_enhancer = Math.max(minCE, boosted);
      }

      updateMinutes(updates);
    }
  }, [
    minutes?.total_minutes,
    minutes?.ce_minutes_checkpoint,
    minutes?.is_vip,
    minutes?.admin_granted_vip,
    minutes?.chance_enhancer,
    user?.id,
  ]);
};