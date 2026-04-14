import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated,
  Dimensions,
  ScrollView,
  Modal,
  Platform,
  DeviceEventEmitter,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import {
  ChevronLeft,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Flag,
  X,
  ChevronRight,
  Star,
  SkipForward,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { useVideoChat } from '@/hooks/useVideoChat';
import { useCall } from '@/contexts/CallContext';
import { supabase } from '@/lib/supabase';
import { Text } from '@/components/ui/text';
import Toast from 'react-native-toast-message';
import { flattenStyle } from '@/utils/flatten-style';
import { RTCView } from '@/lib/webrtc';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SelfieCaptureModal from '@/components/SelfieCaptureModal';
import { FemaleNotifyCard } from '@/components/FemaleNotifyCard';
import { PinnedSocialsDisplay } from '@/components/videocall/PinnedSocialsDisplay';
import { usePinnedSocials } from '@/hooks/usePinnedSocials';
import { PinTopicsOverlay } from '@/components/videocall/PinTopicsOverlay';
import { usePinTopics } from '@/hooks/usePinTopics';
import * as WebBrowser from 'expo-web-browser';
import { createGiftCheckout, checkIsPremiumVip, purchaseUnfreeze } from '@/lib/gift-utils';
import { GiftCelebration } from '@/components/GiftCelebration';
import { BlurView } from 'expo-blur';
import { usePreBlur } from '@/hooks/usePreBlur';
// FOOTERLINKS REMOVED

const { width, height } = Dimensions.get('window');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

// ─── Voice Mode Avatar ────────────────────────────────────────────────────────
function VoiceModeAvatar({ size = 80, label = true }: { size?: number; label?: boolean }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <LinearGradient
        colors={['#7C3AED', '#4F46E5']}
        style={[styles.voiceAvatarCircle, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <Text style={{ fontSize: size * 0.45 }}>👩</Text>
      </LinearGradient>
      {label && <Text style={styles.voiceModeLabel}>Voice Mode</Text>}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const router = useRouter();
  const { profile, minutes, refreshProfile, updateMinutes } = useAuth();
  const { setShowVipModal } = useCall();

  const {
    callState,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    isVoiceMode,
    partnerIsVoiceMode,
    skipPenaltyCount,
    showCapPopup,
    totalMinutes,
    isFrozen,
    elapsedSeconds,
    partnerGender,
    partnerTopics,
    partnerId,
    capInfo,
    toggleMute,
    toggleCamera,
    toggleVoiceMode,
    startCall,
    handleNext,
    handleStop,
    setShowCapPopup,
    restartPreview,
  } = useVideoChat();

  // ─── Partner pinned socials (VIP only, fresh fetch on every match) ─────────
  const { socials: partnerSocials } = usePinnedSocials(
    partnerId,
    callState === 'connected',
  );

  // ─── Pin Topics ────────────────────────────────────────────────────────────
  const {
    categories,
    topics,
    pinnedTopicIds,
    pinnedTopicNames,
    loading: topicsLoading,
    loadAll: loadTopicsAll,
    togglePin,
    fetchPartnerTopics,
  } = usePinTopics();

  const [showTopicsOverlay, setShowTopicsOverlay] = useState(false);
  const [partnerPinnedTopics, setPartnerPinnedTopics] = useState<string[]>([]);

  // Fetch partner's pinned topics whenever the partner changes
  useEffect(() => {
    if (partnerId && callState === 'connected') {
      fetchPartnerTopics(partnerId).then(setPartnerPinnedTopics);
    } else {
      setPartnerPinnedTopics([]);
    }
  }, [partnerId, callState]);

  // ─── Waiting timer (counts up while searching) ────────────────────────────
  const [waitingSeconds, setWaitingSeconds] = useState(0);

  useEffect(() => {
    if (callState !== 'waiting') {
      setWaitingSeconds(0);
      return;
    }
    setWaitingSeconds(0);
    const t = setInterval(() => setWaitingSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [callState]);

  // ─── Show gender toast after 5s of waiting ────────────────────────────────
  useEffect(() => {
    if (callState !== 'waiting' || waitingSeconds !== 5) return;
    const isMale = profile?.gender?.toLowerCase() === 'male';
    const isFemale = profile?.gender?.toLowerCase() === 'female';
    if (!isMale && !isFemale) return;
    Toast.show({
      type: 'dmToast',
      text1: isMale ? '🔔 10+ girls notified!' : '🎁 50+ guys notified!',
      text2: isMale
        ? "We just notified 10+ girls you are here! Stay here or come back, we'll notify you!"
        : "We just notified 50+ guys you are here, get gifted cash & rewards from guys! Stay here or come back & we'll notify you!",
      visibilityTime: 20000,
      position: 'top',
    });
  }, [waitingSeconds, callState, profile?.gender]);

  // ─── Overlay states ────────────────────────────────────────────────────────
  const [genderFilter, setGenderFilter] = useState<'Both' | 'Girls' | 'Guys'>('Both');
  const [showReport, setShowReport] = useState(false);
  const [showSkipPenalty, setShowSkipPenalty] = useState(false);
  const [showMinuteLossToast, setShowMinuteLossToast] = useState(false);
  const [showFrozen, setShowFrozen] = useState(false);
  const [showBanned, setShowBanned] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [banDate, setBanDate] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [showPendingPopup, setShowPendingPopup] = useState(false);
  const [unfreezeLoading, setUnfreezeLoading] = useState(false);
  const FREEZE_SNOOZE_KEY = 'freeze_popup_snooze_until';

  // ─── Modal Content Helper ──────────────────────────────────────────────────
  const getCapContent = () => {
    if (capInfo?.isVoiceMode) {
      return {
        title: '🎙️ Voice Mode Limit',
        subtitle: 'Female users in Voice Mode earn up to 5 minutes per session. Switch to Video Mode to earn up to 10 minutes (or 30 mins as VIP)!',
      };
    }
    if (isFrozen || capInfo?.cap === 2) {
      return {
        title: '🥶 Minutes Are Frozen',
        subtitle: 'Your minutes are frozen because you\'ve hit the freeze threshold. While frozen, you can only earn 2 minutes per session. Upgrade to VIP or do a one-time unfreeze to continue earning.',
      };
    }
    if (capInfo?.cap === 10 && !capInfo?.isVip) {
      return {
        title: '⏰ Session Limit Reached',
        subtitle: "You've reached the 10-minute session limit! Upgrade to VIP for a 30-minute session cap and earn 3x more every time you chat.",
      };
    }
    if (capInfo?.cap === 30) {
      return {
        title: '🌟 VIP Session Limit',
        subtitle: 'You\'ve reached the 30-minute VIP session limit. Amazing chatting! Start a new session to continue earning.',
      };
    }
    // Fallback
    return {
      title: '⏰ Session Limit',
      subtitle: 'You\'ve hit your session minute cap. Upgrade to VIP for 3× more minutes per session, or start a new match to continue.',
    };
  };

  const capContent = getCapContent();

  // Animated search pulsing
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Restart camera preview when tab is focused ───────────────────────────
  useFocusEffect(
    useCallback(() => {
      restartPreview();
    }, [restartPreview])
  );

  // ─── Stop session when a direct call is accepted ──────────────────────────
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('prepare-direct-call', async () => {
      if (callState !== 'idle') {
        await handleStop();
      }
    });
    return () => sub.remove();
  }, [callState, handleStop]);

  // ─── Session init ──────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        // Session init
        await supabase.functions.invoke('session-init', { body: {} });
      } catch (_) {}

      try {
        const { data } = await supabase.functions.invoke('check-ip-ban', { body: {} });
        if (data?.banned) {
          setBanReason(data.reason || 'Violation of terms of service');
          setBanDate(data.banned_at || '');
          setShowBanned(true);
        }
      } catch (_) {}
    };
    init();
  }, []);

  // ─── Search pulse animation ────────────────────────────────────────────────
  useEffect(() => {
    if (callState === 'waiting') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [callState, pulseAnim]);

  // ─── Frozen check ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (isFrozen && callState === 'connected') {
      AsyncStorage.getItem(FREEZE_SNOOZE_KEY).then((val) => {
        if (!val || Date.now() >= parseInt(val, 10)) {
          setShowFrozen(true);
        }
      });
    }
  }, [isFrozen, callState]);

  // Suppress automatic cap popup if snoozed
  useEffect(() => {
    if (showCapPopup) {
      AsyncStorage.getItem(FREEZE_SNOOZE_KEY).then((val) => {
        if (val && Date.now() < parseInt(val, 10)) {
          setShowCapPopup(false);
        }
      });
    }
  }, [showCapPopup, setShowCapPopup]);

  const handleRemindIn2Days = useCallback(async () => {
    const snoozeUntil = Date.now() + 2 * 24 * 60 * 60 * 1000; // 2 days
    await AsyncStorage.setItem(FREEZE_SNOOZE_KEY, String(snoozeUntil));
    setShowCapPopup(false);
    setShowFrozen(false);
  }, [setShowCapPopup]);

  // ─── ADDITION: refreshed profile after successful unfreeze ────────────────
  // (This replaces the original handleOneTimeUnfreeze with explicit refreshProfile call after unfreeze)
  const handleOneTimeUnfreeze = useCallback(async () => {
    setUnfreezeLoading(true);
    try {
      const result = await purchaseUnfreeze();
      if (result.success) {
        // Optimistically update local state so UI responds instantly
        if (updateMinutes) {
          await updateMinutes({ is_frozen: false });
        }
        
        // Use a timeout to ensure the server has processed the update before we refresh
        setTimeout(async () => {
          if (refreshProfile) {
            await refreshProfile();
          }
        }, 1500);

        setShowCapPopup(false);
        setShowFrozen(false);
        Toast.show({
          type: 'success',
          text1: '❄️ Minutes Unfrozen!',
          text2: 'You can now continue earning full minutes.',
        });
      } else if (result.error !== 'cancelled') {
        Toast.show({
          type: 'error',
          text1: '❌ Unfreeze Failed',
          text2: result.error || 'Something went wrong',
        });
      }
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: '❌ Purchase Error',
        text2: err?.message || 'Unknown error',
      });
    } finally {
      setUnfreezeLoading(false);
    }
  }, [refreshProfile, updateMinutes]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    const gpMap: Record<string, string> = { Both: 'Both', Girls: 'Female', Guys: 'Male' };
    await startCall(gpMap[genderFilter] ?? 'Both', isVoiceMode);
  }, [genderFilter, isVoiceMode, startCall]);

  const handleCancel = useCallback(async () => {
    await handleStop();
  }, [handleStop]);

  const handleNextPress = useCallback(async () => {
    const gpMap: Record<string, string> = { Both: 'Both', Girls: 'Female', Guys: 'Male' };
    const result = await handleNext(gpMap[genderFilter] ?? 'Both', isVoiceMode);
    if (result.penalized) {
      if (result.count <= 3) {
        setShowSkipPenalty(true);
      } else {
        setShowMinuteLossToast(true);
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = setTimeout(() => setShowMinuteLossToast(false), 2800);
      }
    }
  }, [genderFilter, isVoiceMode, handleNext]);

  const handleGenderPill = useCallback((option: 'Both' | 'Girls' | 'Guys') => {
    const isLocked = option !== 'Both' && !minutes?.is_vip;
    if (isLocked) { setShowVipModal(true); return; }
    setGenderFilter(option);
  }, [minutes?.is_vip, setShowVipModal]);

  const submitReport = useCallback(async () => {
    if (!reportReason || !profile?.id) return;
    setReportSubmitting(true);
    try {
      const { error } = await supabase.from('user_reports').insert({
        reporter_id: profile.id,
        reported_user_id: partnerId ?? null,
        reason: reportReason,
        details: reportDetails || null,
      });
      if (error) {
        console.warn('Report insert error:', error.message, error.details, error.hint);
        setReportSubmitting(false);
        return;
      }
      setReportSubmitted(true);
      setTimeout(() => {
        setShowReport(false);
        setReportSubmitted(false);
        setReportReason('');
        setReportDetails('');
      }, 1800);
    } catch (err) {
      console.warn('Report submit error:', err);
    } finally {
      setReportSubmitting(false);
    }
  }, [reportReason, reportDetails, profile?.id, partnerId]);

  // ─── Gift / Send Cash feature ──────────────────────────────────────────────
  const [showGiftIcon, setShowGiftIcon] = useState(false);
  const [showGiftOverlay, setShowGiftOverlay] = useState(false);
  const [giftLoading, setGiftLoading] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState('this user');
  const [showGiftCelebration, setShowGiftCelebration] = useState(false);
  const giftPulseAnim = useRef(new Animated.Value(1)).current;
  const giftPulseRef = useRef<Animated.CompositeAnimation | null>(null);

  // VIP check when partner changes
  useEffect(() => {
    if (!partnerId || callState !== 'connected') {
      setShowGiftIcon(false);
      setShowGiftOverlay(false);
      return;
    }
    (async () => {
      try {
        const isPremium = await checkIsPremiumVip(partnerId);
        if (isPremium) {
          setShowGiftIcon(true);
          const { data: partner } = await supabase
            .from('members')
            .select('name')
            .eq('id', partnerId)
            .single();
          setPartnerName((partner as any)?.name || 'this user');
        } else {
          setShowGiftIcon(false);
        }
      } catch (_) {
        setShowGiftIcon(false);
      }
    })();
  }, [partnerId, callState]);

  // Reset gift state on disconnect
  useEffect(() => {
    if (callState !== 'connected') {
      setShowGiftIcon(false);
      setShowGiftOverlay(false);
    }
  }, [callState]);

  // Pulse animation when gift icon appears
  useEffect(() => {
    if (showGiftIcon) {
      giftPulseAnim.setValue(1);
      giftPulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(giftPulseAnim, { toValue: 1.2, duration: 400, useNativeDriver: true }),
          Animated.timing(giftPulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.delay(700),
        ])
      );
      giftPulseRef.current.start();
      return () => {
        giftPulseRef.current?.stop();
        giftPulseAnim.setValue(1);
      };
    }
  }, [showGiftIcon]);

  const handleGiftTier = useCallback(async (tier: string) => {
    if (!partnerId) return;
    setGiftLoading(tier);
    try {
      const tierId = parseInt(tier, 10);
      const result = await createGiftCheckout(tierId, partnerId);
      if (result.success) {
        setShowGiftOverlay(false);
        setShowGiftCelebration(true);
      } else if (result.error === 'cancelled') {
        // user cancelled — do nothing
      } else {
        Toast.show({
          type: 'dmToast',
          text1: '❌ Purchase Failed',
          text2: result.error || 'Something went wrong',
          visibilityTime: 8000,
        });
      }
    } catch (err: any) {
      Toast.show({
        type: 'dmToast',
        text1: '❌ Purchase Error',
        text2: err?.message || 'Unknown error',
        visibilityTime: 8000,
      });
    } finally {
      setGiftLoading(null);
    }
  }, [partnerId]);

  // ─── Pre-blur on new partner ───────────────────────────────────────────────
  const { isBlurred, blurOpacity } = usePreBlur(
    partnerId,
    callState === 'connected',
    4000,
  );

  // (rest of the code remains exactly the same)

// ... The file continues as before, unchanged. ...
// All other code for renderTopBar, renderIdleArea, renderWaitingArea, renderVideoArea, modals, etc. remain unchanged.

// Styles definition left unchanged at the end of the file.