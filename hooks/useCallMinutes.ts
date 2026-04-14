/**
 * useCallMinutes.ts — Matches web app's useCallMinutes.ts exactly.
 * Reports earned minutes every 60s via earn-minutes edge function.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

function generateSessionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

interface UseCallMinutesOptions {
  userId: string;
  partnerId: string | null;
  isConnected: boolean;
  voiceMode?: boolean;
  isVip?: boolean;
  isFemale?: boolean;
}

export interface CapInfo {
  cap: number;
  isVip: boolean;
  isVoiceMode?: boolean;
}

export interface FreezeInfo {
  isFrozen: boolean;
  earnRate: number;
}

export interface UseCallMinutesResult {
  totalMinutes: number;
  giftedMinutes: number;
  elapsedSeconds: number;
  capReached: boolean;
  capInfo: CapInfo | null;
  showCapPopup: boolean;
  dismissCapPopup: () => void;
  flushMinutes: () => Promise<void>;
  freezeInfo: FreezeInfo;
  refreshBalance: () => void;
}

export function useCallMinutes({
  userId,
  partnerId,
  isConnected,
  voiceMode = false,
  isVip = false,
  isFemale = false,
}: UseCallMinutesOptions): UseCallMinutesResult {
  // Not needed on web — return safe defaults
  if (Platform.OS === 'web') {
    return {
      totalMinutes: 0,
      giftedMinutes: 0,
      elapsedSeconds: 0,
      capReached: false,
      capInfo: null,
      showCapPopup: false,
      dismissCapPopup: () => {},
      flushMinutes: async () => {},
      freezeInfo: { isFrozen: false, earnRate: 10 },
      refreshBalance: () => {},
    };
  }

  // Per-session cap: 10 min for regular, 30 min for VIP
  const SESSION_CAP = isVip ? 30 : 10;

  const [totalMinutes, setTotalMinutes] = useState(0);
  const [giftedMinutes, setGiftedMinutes] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [capReached, setCapReached] = useState(false);
  const [capInfo, setCapInfo] = useState<CapInfo | null>(null);
  const [showCapPopup, setShowCapPopup] = useState(false);
  const [freezeInfo, setFreezeInfo] = useState<FreezeInfo>({ isFrozen: false, earnRate: 10 });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const lastReportedRef = useRef(0);
  const sessionMinutesEarnedRef = useRef(0); // tracks minutes earned THIS session
  const partnerIdRef = useRef(partnerId);
  const capReachedRef = useRef(false);
  const sessionIdRef = useRef(generateSessionId());
  const isVipRef = useRef(isVip);
  const freezeInfoRef = useRef<FreezeInfo>({ isFrozen: false, earnRate: 10 });

  useEffect(() => { partnerIdRef.current = partnerId; }, [partnerId]);
  useEffect(() => { isVipRef.current = isVip; }, [isVip]);
  useEffect(() => { freezeInfoRef.current = freezeInfo; }, [freezeInfo]);

  // Sync with useAuth minutes if available (prevents needing app restart)
  const { minutes: authMinutes, updateMinutes } = useAuth();
  
  // Reactive frozen state (prioritize authMinutes which is the global source of truth)
  const currentIsFrozen = authMinutes?.is_frozen ?? freezeInfo.isFrozen;

  useEffect(() => {
    if (authMinutes) {
      setTotalMinutes(authMinutes.total_minutes ?? authMinutes.minutes ?? 0);
      setFreezeInfo(prev => ({ 
        isFrozen: authMinutes.is_frozen ?? false, 
        earnRate: prev.earnRate 
      }));
    }
  }, [authMinutes?.is_frozen, authMinutes?.total_minutes]);

  // Handle capReached state from outside (e.g. from useVideoChat which might be causing resets)
  useEffect(() => {
    if (isConnected && capReached) {
      // If we are connected and cap was reached, don't let it be cleared unless connection changes
      capReachedRef.current = true;
    }
  }, [isConnected, capReached]);

  // Fetch balance
  const fetchBalance = useCallback(() => {
    if (!userId || userId === 'anonymous') return;
    supabase.functions
      .invoke('earn-minutes', { body: { type: 'get_balance', userId } })
      .then(({ data }) => {
        if (data?.success) {
          setTotalMinutes(data.totalMinutes);
          setGiftedMinutes(data.giftedMinutes ?? 0);
          setFreezeInfo({ isFrozen: data.isFrozen ?? false, earnRate: data.earnRate ?? 10 });
        }
      });
  }, [userId]);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  // Reset on new partner OR new connection (handles rejoining same partner)
  useEffect(() => {
    if (isConnected) {
      console.log("[useCallMinutes] Session Connected. isConnected:", isConnected, "partnerId:", partnerId);
      // Only reset if this is a DIFFERENT session (new partner or explicit reset)
      // If we're just re-rendering, we shouldn't wipe the cap
      if (!capReachedRef.current) {
        elapsedRef.current = 0;
        lastReportedRef.current = 0;
        sessionMinutesEarnedRef.current = 0;
        setElapsedSeconds(0);
        setCapReached(false);
        setShowCapPopup(false);
        sessionIdRef.current = generateSessionId();
      }
    } else {
      // When disconnected, we can clear the flags for the next session
      console.log("[useCallMinutes] Session Disconnected.");
      capReachedRef.current = false;
      setCapReached(false);
      setShowCapPopup(false);
    }
  }, [isConnected, partnerId]); // Resets on partner change OR reconnection

  const reportMinutes = useCallback(async (minutes: number) => {
    const pid = partnerIdRef.current;
    const safeMinutes = Math.min(minutes, 5);
    if (!pid || !userId || userId === 'anonymous' || safeMinutes <= 0) return;

    const { data } = await supabase.functions.invoke('earn-minutes', {
      body: {
        type: 'earn',
        userId,
        partnerId: pid,
        minutesEarned: safeMinutes,
        sessionId: sessionIdRef.current,
        voiceMode,
      },
    });

    if (data?.success) {
      setTotalMinutes(data.totalMinutes);
      if (data.gifted_minutes !== undefined) setGiftedMinutes(data.gifted_minutes);
      
      // Update local and global state including frozen status
      if (data.isFrozen !== undefined || data.totalMinutes !== undefined) {
        setFreezeInfo({ 
          isFrozen: data.isFrozen ?? false, 
          earnRate: data.earnRate ?? 10 
        });

        // Push to useAuth so top bar updates instantly
        updateMinutes({
          is_frozen: data.isFrozen,
          minutes: data.totalMinutes,
          total_minutes: data.totalMinutes,
        });
      }

      // Track session minutes earned
      sessionMinutesEarnedRef.current += safeMinutes;

      // Client-side session cap check (10 min regular / 30 min VIP / 2 min if frozen / 5 min if voice)
      const frozen = freezeInfoRef.current.isFrozen;
      let cap = frozen ? 2 : (isVipRef.current ? 30 : 10);
      
      // Voice mode cap for females
      if (isFemale && voiceMode && !frozen) {
        cap = 5;
      }

      const clientCapReached = sessionMinutesEarnedRef.current >= cap;

      // Server-side cap check
      const serverCapReached = data.message === 'cap_reached';

      if ((clientCapReached || serverCapReached) && !capReachedRef.current) {
        capReachedRef.current = true;
        setCapReached(true);
        setCapInfo({ cap, isVip: isVipRef.current, isVoiceMode: isFemale && voiceMode });
        setShowCapPopup(true);
        // Stop the timer
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      }
    }
  }, [userId, voiceMode, isFemale]);

  // Timer
  useEffect(() => {
    if (isConnected && !capReachedRef.current) {
      timerRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsedSeconds(elapsedRef.current);

        const totalMinutesElapsed = Math.floor(elapsedRef.current / 60);
        if (totalMinutesElapsed > lastReportedRef.current) {
          const newMinutes = totalMinutesElapsed - lastReportedRef.current;
          lastReportedRef.current = totalMinutesElapsed;
          reportMinutes(newMinutes);
        }
      }, 1000);
    }
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [isConnected, reportMinutes]);

  const flushMinutes = useCallback(async () => {
    const totalMinutesElapsed = Math.floor(elapsedRef.current / 60);
    const unreported = totalMinutesElapsed - lastReportedRef.current;
    if (unreported > 0) {
      lastReportedRef.current = totalMinutesElapsed;
      await reportMinutes(unreported);
    }
  }, [reportMinutes]);

  const dismissCapPopup = useCallback(() => setShowCapPopup(false), []);

  return {
    totalMinutes,
    giftedMinutes,
    elapsedSeconds,
    capReached,
    capInfo,
    showCapPopup,
    dismissCapPopup,
    flushMinutes,
    freezeInfo: { ...freezeInfo, isFrozen: currentIsFrozen },
    refreshBalance: fetchBalance,
  };
}