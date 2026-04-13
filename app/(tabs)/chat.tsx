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
// ... existing code ...
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
        subtitle: 'You\'ve reached the 10-minute session limit! Upgrade to VIP for a 30-minute session cap and earn 3x more every time you chat.',
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

  const handleOneTimeUnfreeze = useCallback(async () => {
    setUnfreezeLoading(true);
    try {
      const result = await purchaseUnfreeze();
      if (result.success) {
        // Optimistically update local state so UI responds instantly
        await updateMinutes({ is_frozen: false });
        await refreshProfile();
        
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

  // ─── Render helpers ────────────────────────────────────────────────────────
  const renderTopBar = () => (
    <View style={styles.topBar}>
      {/* Back button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => {
        if (callState !== 'idle') handleStop();
        if (router.canGoBack()) router.back(); else router.replace('/');
      }}>
        <ChevronLeft size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Center — frozen button or session timer */}
      <View style={styles.topBarCenter}>
        {isFrozen ? (
          <TouchableOpacity style={styles.frozenBtn} onPress={() => setShowFrozen(true)} activeOpacity={0.8}>
            <Text style={styles.frozenBtnText}>🥶 Unfreeze Minutes</Text>
          </TouchableOpacity>
        ) : callState === 'connected' ? (
          <View style={styles.timerRow}>
            <View style={styles.greenDot} />
            <Text style={styles.timerText}>{formatTime(elapsedSeconds)}</Text>
          </View>
        ) : callState === 'waiting' ? (
          <Text style={styles.searchingText}>Searching...</Text>
        ) : null}
      </View>

      {/* Minutes — top right */}
      <View style={styles.minutesRight}>
        <Text style={styles.minutesText}>{totalMinutes} mins ⏱️</Text>
      </View>
    </View>
  );

  const renderIdleArea = () => (
    <View style={styles.idleArea}>
      {/* Camera preview — top-right PiP */}
      <View style={styles.idlePreview}>
        {localStream ? (
          <RTCView
            streamURL={typeof localStream.toURL === 'function' ? localStream.toURL() : localStream}
            style={styles.idlePreviewRTC}
            objectFit="cover"
            mirror={true}
            zOrder={1}
          />
        ) : (
          <View style={styles.idlePreviewPlaceholder}>
            <Video size={32} color="#555" />
            <Text style={{ color: '#555', fontSize: 11, marginTop: 6 }}>Camera</Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderWaitingArea = () => (
    <View style={styles.waitingArea}>
      <Animated.View style={[StyleSheet.flatten(styles.pulseRing), { transform: [{ scale: pulseAnim }] }]} />
      <Animated.View style={[StyleSheet.flatten(styles.pulseRingInner), {
        transform: [{ scale: pulseAnim.interpolate({ inputRange: [1, 1.3], outputRange: [1, 1.15] }) }],
      }]} />
      <View style={styles.waitingContent}>
        <Text style={styles.waitingTitle}>Finding a partner...</Text>
        <Text style={styles.waitingTimer}>{formatTime(waitingSeconds)}</Text>
      </View>
    </View>
  );

  const renderVideoArea = () => (
    <View style={styles.videoArea}>
      {/* Remote video */}
      {remoteStream ? (
        <RTCView
          streamURL={typeof remoteStream.toURL === 'function' ? remoteStream.toURL() : remoteStream}
          style={styles.remoteVideo}
          objectFit="cover"
          zOrder={0}
        />
      ) : (
        <View style={styles.remoteVideoPlaceholder}>
          <ActivityIndicator size="large" color="#EF4444" />
          <Text style={{ color: '#A1A1AA', marginTop: 12 }}>Connecting...</Text>
        </View>
      )}

      {/* Partner Voice Mode Overlay — shown when partner has camera off (voice only) */}
      {remoteStream && partnerIsVoiceMode && (
        <View style={styles.partnerVoiceOverlay} pointerEvents="none">
          <LinearGradient
            colors={['#7C3AED', '#4F46E5']}
            style={styles.partnerVoiceAvatarCircle}
          >
            <Text style={{ fontSize: 48 }}>🎙️</Text>
          </LinearGradient>
          <Text style={styles.partnerVoiceTitle}>Voice Only</Text>
          <Text style={styles.partnerVoiceSubtitle}>Your match has their camera off</Text>
        </View>
      )}

      {/* Pre-blur overlay — fades out after 4 s on every new partner */}
      {isBlurred && (
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            { 
              opacity: blurOpacity, 
              zIndex: 10, 
              overflow: 'hidden',
              backgroundColor: 'rgba(0,0,0,0.4)' 
            },
          ]}
          pointerEvents="none"
        >
          <BlurView
            intensity={100}
            tint="dark"
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
      )}

      {/* Partner topics (from useVideoChat hook — legacy) */}
      {partnerTopics.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.topicsRow}
          contentContainerStyle={styles.topicsContent}
        >
          {partnerTopics.map((topic, i) => (
            <View key={i} style={styles.topicChip}>
              <Text style={styles.topicChipText}>{topic}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Partner's pinned topics — blue chips, top-right */}
      {partnerPinnedTopics.length > 0 && (
        <View style={styles.partnerChipsContainer}>
          {partnerPinnedTopics.map((name, i) => (
            <View key={i} style={styles.partnerChip}>
              <Text style={styles.partnerChipText}>{name}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Topics bookmark tab — left edge */}
      <TouchableOpacity
        style={styles.topicsTab}
        onPress={() => setShowTopicsOverlay(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.topicsTabText}>📌</Text>
        <Text style={styles.topicsTabLabel}>Topics</Text>
        {pinnedTopicIds.size > 0 && (
          <View style={styles.topicsTabBadge}>
            <Text style={styles.topicsTabBadgeText}>{pinnedTopicIds.size}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Report button */}
      <TouchableOpacity style={styles.reportBtn} onPress={() => setShowReport(true)}>
        <Flag size={18} color="#EF4444" />
      </TouchableOpacity>

      {/* Partner's VIP pinned socials — shown to their partner only */}
      <PinnedSocialsDisplay
        socials={partnerSocials}
      />

      {/* Pulsing Gift button — shown when partner is VIP */}
      {showGiftIcon && callState === 'connected' && (
        <TouchableOpacity
          style={styles.giftBtn}
          onPress={() => setShowGiftOverlay(true)}
          activeOpacity={0.85}
        >
          <Animated.View style={[styles.giftBtnInner, { transform: [{ scale: giftPulseAnim }] }]}>
            <View style={styles.giftBtnCircle}>
              <Text style={styles.giftBtnEmoji}>🎁</Text>
            </View>
            <Text style={styles.giftBtnLabel}>Gift</Text>
          </Animated.View>
        </TouchableOpacity>
      )}

      {/* Local PiP */}
      <View style={styles.localPip}>
        {isVoiceMode ? (
          <VoiceModeAvatar size={60} label={false} />
        ) : isCameraOff ? (
          <View style={styles.pipPlaceholder}>
            <VideoOff size={24} color="#555" />
          </View>
        ) : localStream ? (
          <RTCView
            streamURL={typeof localStream.toURL === 'function' ? localStream.toURL() : localStream}
            style={styles.localPipRTC}
            objectFit="cover"
            mirror={true}
            zOrder={1}
          />
        ) : (
          <View style={styles.pipPlaceholder}>
            <ActivityIndicator size="small" color="#EF4444" />
          </View>
        )}
      </View>
    </View>
  );

  const renderGenderFilter = () => (
    <View style={styles.genderFilterRow}>
      {(['Girls', 'Both', 'Guys'] as const).map((opt) => {
        const isActive = genderFilter === opt;
        const isLocked = opt !== 'Both' && !minutes?.is_vip;
        return (
          <TouchableOpacity
            key={opt}
            style={flattenStyle([styles.genderPill,isActive ? styles.genderPillActive : null])}
            onPress={() => handleGenderPill(opt)}
            activeOpacity={0.8}
          >
            <Text style={flattenStyle([styles.genderPillText,isActive ? styles.genderPillTextActive : null])}>
              {opt === 'Girls' ? '👧 Girls' : opt === 'Guys' ? '👦 Guys' : 'Both'}
            </Text>
            {isLocked && (
              <Star size={11} color="#FACC15" fill="#FACC15" style={{ marginLeft: 3 }} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderBottomControls = () => {
    if (callState === 'idle') {
      const hasSubmittedSelfie = !!(profile?.image_url || (profile?.image_status && profile.image_status !== 'pending'));
      return (
        <View style={styles.bottomBar}>
          {renderGenderFilter()}
          {!hasSubmittedSelfie ? (
            <TouchableOpacity style={styles.selfieBtn} onPress={() => setShowSelfieModal(true)} activeOpacity={0.85}>
              <Text style={styles.selfieBtnText}>📸 Take Selfie to Start Chatting</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.startBtn} onPress={handleStart} activeOpacity={0.85}>
              <Text style={styles.startBtnText}>START CHATTING</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }
    if (callState === 'waiting') {
      return (
        <View style={styles.bottomBar}>
          {renderGenderFilter()}
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.8}>
            <Text style={styles.cancelBtnText}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (callState === 'connecting' || callState === 'connected') {
      return (
        <View style={styles.bottomBar}>
          {renderGenderFilter()}
          <View style={styles.callControls}>
            <TouchableOpacity style={styles.ctrlBtn} onPress={toggleMute} activeOpacity={0.8}>
              {isMuted ? <MicOff size={22} color="#EF4444" /> : <Mic size={22} color="#FFFFFF" />}
              <Text style={styles.ctrlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.ctrlBtn} onPress={toggleVoiceMode} activeOpacity={0.8}>
              {isVoiceMode ? <VideoOff size={22} color="#EF4444" /> : <Video size={22} color="#FFFFFF" />}
              <Text style={styles.ctrlLabel}>{isVoiceMode ? 'Voice ON' : 'Voice Mode'}</Text>
            </TouchableOpacity>

            {/* End call button */}
            <TouchableOpacity style={styles.endCallBtn} onPress={handleCancel} activeOpacity={0.85}>
              <X size={26} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.nextBtn} onPress={handleNextPress} activeOpacity={0.85}>
              <SkipForward size={20} color="#FFFFFF" />
              <Text style={styles.nextBtnText}>NEXT</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.ctrlBtn} onPress={() => setShowReport(true)} activeOpacity={0.8}>
              <Flag size={22} color="#A1A1AA" />
              <Text style={styles.ctrlLabel}>Report</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return null;
  };

  // ─── Main layout ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top bar */}
      {renderTopBar()}

      {/* Video / idle / waiting area */}
      <View style={styles.mainArea}>
        {callState === 'idle' && (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
          >
            {renderIdleArea()}
            <FemaleNotifyCard
              compact
              onSettingsPress={() => router.push('/notification-settings')}
            />
            {/* FooterLinks removed */}
          </ScrollView>
        )}
        {callState === 'waiting' && renderWaitingArea()}
        {(callState === 'connecting' || callState === 'connected') && renderVideoArea()}
      </View>

      {/* Bottom controls */}
      {renderBottomControls()}

      {/* ─── Overlays ────────────────────────────────────────────────────── */}

      {/* Pin Topics overlay */}
      <PinTopicsOverlay
        visible={showTopicsOverlay}
        onClose={() => setShowTopicsOverlay(false)}
        categories={categories}
        topics={topics}
        pinnedTopicIds={pinnedTopicIds}
        loading={topicsLoading}
        onOpen={loadTopicsAll}
        onTogglePin={togglePin}
      />

      {/* Minute loss toast */}
      {showMinuteLossToast && (
        <View style={styles.minuteLossToast} pointerEvents="none">
          <Text style={styles.minuteLossToastText}>🚫 -2 Minutes / Don't Quick Skip</Text>
        </View>
      )}

      {/* Skip penalty popup */}
      <Modal visible={showSkipPenalty} transparent animationType="fade" onRequestClose={() => setShowSkipPenalty(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>⚠️ -2 Minutes Deducted</Text>
            <Text style={styles.modalSubtitle}>
              Stop quick-skipping or upgrade to VIP for unlimited skips
            </Text>
            <TouchableOpacity
              style={styles.modalRedBtn}
              onPress={() => { setShowSkipPenalty(false); router.push('/vip'); }}
              activeOpacity={0.85}
            >
              <Text style={styles.modalRedBtnText}>Upgrade to VIP ($2.49/wk)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalGrayBtn} onPress={() => setShowSkipPenalty(false)} activeOpacity={0.8}>
              <Text style={styles.modalGrayBtnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Cap reached / Freeze popup — unified modal */}
      <Modal visible={showCapPopup || showFrozen} transparent animationType="fade" onRequestClose={() => { if (!unfreezeLoading) { setShowCapPopup(false); setShowFrozen(false); } }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{capContent.title}</Text>
            <Text style={styles.modalSubtitle}>{capContent.subtitle}</Text>
            <TouchableOpacity
              style={styles.modalRedBtn}
              onPress={() => { setShowCapPopup(false); setShowFrozen(false); router.push('/vip'); }}
              activeOpacity={0.85}
              disabled={unfreezeLoading}
            >
              <Text style={styles.modalRedBtnText}>VIP Unfreeze ($2.49/wk)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={flattenStyle([styles.modalGrayBtn, { borderColor: '#FACC15' }, unfreezeLoading && styles.disabledBtn])}
              onPress={handleOneTimeUnfreeze}
              activeOpacity={0.8}
              disabled={unfreezeLoading}
            >
              {unfreezeLoading ? (
                <ActivityIndicator size="small" color="#FACC15" />
              ) : (
                <Text style={flattenStyle([styles.modalGrayBtnText, { color: '#FACC15' }])}>One-Time Unfreeze ($1.99)</Text>
              )}
            </TouchableOpacity>
            {!unfreezeLoading && (
              <>
                <TouchableOpacity onPress={handleRemindIn2Days} activeOpacity={0.7} style={{ marginTop: 8, alignItems: 'center' }}>
                  <Text style={styles.remindLaterText}>Remind me in 2 days</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalGrayBtn} onPress={() => { setShowCapPopup(false); setShowFrozen(false); }} activeOpacity={0.8}>
                  <Text style={styles.modalGrayBtnText}>Keep Chatting</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Report overlay */}
      <Modal visible={showReport} transparent animationType="slide" onRequestClose={() => setShowReport(false)}>
        <View style={styles.reportModalOverlay}>
          <View style={styles.reportSheet}>
            <View style={styles.reportHeader}>
              <Text style={styles.reportTitle}>Report User</Text>
              <TouchableOpacity onPress={() => setShowReport(false)}>
                <X size={22} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            {reportSubmitted ? (
              <View style={styles.reportSuccess}>
                <Text style={styles.reportSuccessText}>✅ Report submitted. Thank you!</Text>
              </View>
            ) : (
              <>
                <View style={styles.reportGrid}>
                  {[
                    'Underage User',
                    'Inappropriate Behavior',
                    'Nudity / Sexual Content',
                    'Harassment / Bullying',
                    'Hate Speech / Discrimination',
                    'Spam / Scam',
                    'Violence / Threats',
                    'Other',
                  ].map((reason) => (
                    <TouchableOpacity
                      key={reason}
                      style={flattenStyle([
                        styles.reportReasonBtn,
                        reportReason === reason ? styles.reportReasonBtnActive : null,
                      ])}
                      onPress={() => setReportReason(reason)}
                      activeOpacity={0.8}
                    >
                      <Text style={flattenStyle([
                        styles.reportReasonText,
                        reportReason === reason ? styles.reportReasonTextActive : null,
                      ])}>
                        {reason}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  style={styles.reportDetailsInput}
                  placeholder="Additional details..."
                  placeholderTextColor="#555"
                  multiline
                  maxLength={500}
                  value={reportDetails}
                  onChangeText={setReportDetails}
                />

                <TouchableOpacity
                  style={flattenStyle([styles.modalRedBtn, { marginTop: 12 },!reportReason ? styles.disabledBtn : null])}
                  onPress={submitReport}
                  activeOpacity={0.85}
                  disabled={!reportReason || reportSubmitting}
                >
                  {reportSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalRedBtnText}>Submit Report</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Banned overlay */}
      {showBanned && (
        <View style={styles.bannedOverlay}>
          <View style={styles.bannedContent}>
            <Text style={styles.bannedIcon}>🚫</Text>
            <Text style={styles.bannedTitle}>You are banned</Text>
            <Text style={styles.bannedReason}>{banReason}</Text>
            {banDate ? <Text style={styles.bannedDate}>Since: {banDate}</Text> : null}
          </View>
        </View>
      )}

      {/* Selfie capture modal */}
      <SelfieCaptureModal
        visible={showSelfieModal}
        onClose={() => setShowSelfieModal(false)}
        onSuccess={() => setShowSelfieModal(false)}
        onPendingReview={() => {
          setShowSelfieModal(false);
          setShowPendingPopup(true);
        }}
      />

      {/* Pending review popup */}
      <Modal visible={showPendingPopup} transparent animationType="fade" onRequestClose={() => setShowPendingPopup(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🎉 Selfie Submitted!</Text>
            <Text style={styles.modalSubtitle}>
              Your selfie is pending review by our team. You can start chatting right now while you wait — it usually takes just a few minutes!
            </Text>
            <TouchableOpacity
              style={styles.modalRedBtn}
              onPress={() => { setShowPendingPopup(false); handleStart(); }}
              activeOpacity={0.85}
            >
              <Text style={styles.modalRedBtnText}>Start Chatting Now 🚀</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalGrayBtn} onPress={() => setShowPendingPopup(false)} activeOpacity={0.8}>
              <Text style={styles.modalGrayBtnText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Gift overlay modal */}
      <Modal
        visible={showGiftOverlay}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGiftOverlay(false)}
      >
        <View style={styles.giftModalOverlay}>
          <View style={styles.giftModalCard}>
            {/* Close button */}
            <TouchableOpacity
              style={styles.giftCloseBtn}
              onPress={() => setShowGiftOverlay(false)}
              activeOpacity={0.8}
            >
              <X size={20} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Header */}
            <Text style={styles.giftModalTitle}>🎁 SEND CASH TO THIS USER!</Text>
            <Text style={styles.giftModalSubtitle}>Send cash to {partnerName}</Text>
            <Text style={styles.giftModalPaypal}>💵 They receive real cash via PayPal</Text>

            {/* Tier buttons */}
            {[
              { tier: '100', label: 'Gift $1.00 Cash', sublabel: '100 Minutes • You pay $1.99', bonus: null },
              { tier: '400', label: 'Gift $4.00 Cash', sublabel: '400 Minutes • You pay $4.99', bonus: 'Send $4.00 Cash & Get +100 Minutes Back!' },
              { tier: '600', label: 'Gift $6.00 Cash', sublabel: '600 Minutes • You pay $7.99', bonus: 'Send $6.00 Cash & Get +150 Minutes Back!' },
              { tier: '1000', label: 'Gift $10.00 Cash', sublabel: '1000 Minutes • You pay $12.99', bonus: 'Send $10.00 Cash & Get +250 Minutes Back!' },
            ].map(({ tier, label, sublabel, bonus }) => (
              <View key={tier} style={styles.giftTierWrapper}>
                <TouchableOpacity
                  style={styles.giftTierBtn}
                  onPress={() => handleGiftTier(tier)}
                  activeOpacity={0.85}
                  disabled={giftLoading !== null}
                >
                  {giftLoading === tier ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <View style={styles.giftTierContent}>
                      <Text style={styles.giftTierLabel}>{label}</Text>
                      <Text style={styles.giftTierSublabel}>{sublabel}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {bonus && (
                  <Text style={styles.giftTierBonus}>{bonus}</Text>
                )}
              </View>
            ))}

            {/* Footer */}
            <Text style={styles.giftNoRefund}>NO REFUND POLICY</Text>
          </View>
        </View>
      </Modal>

      <GiftCelebration
        visible={showGiftCelebration}
        recipientName={partnerName}
        onDismiss={() => setShowGiftCelebration(false)}
      />

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Layout ──────────────────────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: '#0c0c14',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#0c0c14',
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f2e',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frozenBtn: {
    backgroundColor: '#1e3a5f',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  frozenBtnText: {
    color: '#93c5fd',
    fontSize: 13,
    fontWeight: '600',
  },
  minutesRight: {
    minWidth: 80,
    alignItems: 'flex-end',
  },
  minutesText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    fontStyle: 'italic',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  timerText: {
    color: '#22C55E',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  searchingText: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '500',
  },
  mainArea: {
    flex: 1,
    backgroundColor: '#0c0c14',
  },

  // ── Idle area ────────────────────────────────────────────────────────────────
  idleArea: {
    flex: 1,
    position: 'relative',
  },
  idlePreview: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 130,
    height: 175,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1E1E38',
    borderWidth: 1.5,
    borderColor: '#2A2A4A',
    zIndex: 10,
  },
  idlePreviewRTC: {
    width: '100%',
    height: '100%',
  },
  idlePreviewPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A2E',
  },
  voiceToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  voiceToggleText: {
    color: '#A1A1AA',
    fontSize: 13,
    marginLeft: 6,
  },
  voiceAvatarCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceModeLabel: {
    color: '#A1A1AA',
    fontSize: 12,
    marginTop: 6,
  },

  // ── Waiting area ─────────────────────────────────────────────────────────────
  waitingArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0c0c14',
  },
  waitingPulseSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  pulseRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  pulseRingInner: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(239,68,68,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(239,68,68,0.5)',
  },
  waitingContent: {
    alignItems: 'center',
    marginTop: 20,
  },
  waitingTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  waitingTimer: {
    color: '#EF4444',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  waitingSubText: {
    color: '#A1A1AA',
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  waitingMessageSection: {
    marginTop: 24,
    alignItems: 'center',
  },
  waitingDiscoverBtn: {
    backgroundColor: '#1A1A2E',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  waitingDiscoverBtnText: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Video area ───────────────────────────────────────────────────────────────
  videoArea: {
    flex: 1,
    backgroundColor: '#000000',
    position: 'relative',
  },
  remoteVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  remoteVideoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0c0c14',
  },
  topicsRow: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    zIndex: 5,
  },
  topicsContent: {
    paddingHorizontal: 12,
    gap: 6,
    flexDirection: 'row',
  },
  topicChip: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  topicChipText: {
    color: '#FFFFFF',
    fontSize: 11,
  },
  reportBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
  },
  localPip: {
    position: 'absolute',
    bottom: 48,
    right: 12,
    width: 90,
    height: 124,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1A1A2E',
    borderWidth: 2,
    borderColor: '#2a2a3e',
    zIndex: 15,
  },
  localPipRTC: {
    width: '100%',
    height: '100%',
  },
  pipPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A2E',
  },
  partnerChipsContainer: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    zIndex: 20,
    gap: 4,
    alignItems: 'flex-end',
  },
  partnerChip: {
    backgroundColor: 'rgba(59,130,246,0.7)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  partnerChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  topicsTab: {
    position: 'absolute',
    left: 0,
    top: '40%',
    backgroundColor: 'rgba(239,68,68,0.85)',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    zIndex: 20,
  },
  topicsTabText: {
    fontSize: 16,
  },
  topicsTabLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  topicsTabBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FACC15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicsTabBadgeText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '800',
  },

  // ── Gender filter row ────────────────────────────────────────────────────────
  genderFilterRow: {
    flexDirection: 'row',
    backgroundColor: '#2A2A4A',
    borderRadius: 50,
    padding: 5,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  genderPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  genderPillActive: {
    backgroundColor: '#EF4444',
  },
  genderPillText: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '700',
  },
  genderPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },

  // ── Bottom bar / controls ─────────────────────────────────────────────────
  bottomBar: {
    backgroundColor: '#0c0c14',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#1f1f2e',
  },
  selfieBtn: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FACC15',
    borderStyle: 'dashed',
  },
  selfieBtnText: {
    color: '#FACC15',
    fontSize: 15,
    fontWeight: '700',
  },
  startBtn: {
    backgroundColor: '#EF4444',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  cancelBtn: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  cancelBtnText: {
    color: '#A1A1AA',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  callControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  ctrlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    minWidth: 52,
  },
  ctrlLabel: {
    color: '#A1A1AA',
    fontSize: 10,
    marginTop: 4,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 6,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  endCallBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#7f1d1d',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Minute loss toast ────────────────────────────────────────────────────────
  minuteLossToast: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    backgroundColor: 'rgba(239,68,68,0.9)',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
    zIndex: 999,
  },
  minuteLossToastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Modal / overlay helpers ───────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  modalSubtitle: {
    color: '#A1A1AA',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
  },
  modalRedBtn: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalRedBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalGrayBtn: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a3e',
    marginBottom: 8,
  },
  modalGrayBtnText: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledBtn: {
    opacity: 0.45,
  },
  remindLaterText: {
    color: '#555',
    fontSize: 12,
    textDecorationLine: 'underline',
  },

  // ── Report sheet ──────────────────────────────────────────────────────────────
  reportModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  reportSheet: {
    backgroundColor: '#1A1A2E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
    borderTopWidth: 1,
    borderColor: '#2a2a3e',
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  reportTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  reportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  reportReasonBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#12122a',
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  reportReasonBtnActive: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  reportReasonText: {
    color: '#A1A1AA',
    fontSize: 12,
  },
  reportReasonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  reportDetailsInput: {
    backgroundColor: '#12122a',
    borderRadius: 10,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#2a2a3e',
    minHeight: 72,
    textAlignVertical: 'top',
  },
  reportSuccess: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  reportSuccessText: {
    color: '#22C55E',
    fontSize: 16,
    fontWeight: '700',
  },

  // ── Banned overlay ───────────────────────────────────────────────────────────
  bannedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  bannedContent: {
    alignItems: 'center',
    padding: 32,
  },
  bannedIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  bannedTitle: {
    color: '#EF4444',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 10,
  },
  bannedReason: {
    color: '#A1A1AA',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 8,
  },
  bannedDate: {
    color: '#555',
    fontSize: 12,
  },

  // ── Gift modal ───────────────────────────────────────────────────────────────
  giftModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  giftModalCard: {
    backgroundColor: '#1A1A2E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderColor: '#FACC15',
  },
  giftCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  giftModalTitle: {
    color: '#FACC15',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
    marginTop: 8,
  },
  giftModalSubtitle: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  giftModalPaypal: {
    color: '#22C55E',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  giftTierWrapper: {
    marginBottom: 8,
  },
  giftTierBtn: {
    backgroundColor: '#FACC15',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  giftTierContent: {
    alignItems: 'center',
  },
  giftTierLabel: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },
  giftTierSublabel: {
    color: '#333333',
    fontSize: 12,
    marginTop: 2,
  },
  giftTierBonus: {
    color: '#22C55E',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
  },
  giftNoRefund: {
    color: '#555',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
    letterSpacing: 0.5,
  },

  // ── Partner voice overlay ─────────────────────────────────────────────────────
  partnerVoiceOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12,12,20,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 8,
  },
  partnerVoiceAvatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  partnerVoiceTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  partnerVoiceSubtitle: {
    color: '#A1A1AA',
    fontSize: 13,
  },

  // ── Gift button (pulsing, on video area) ──────────────────────────────────────
  giftBtn: {
    position: 'absolute',
    top: 124,
    left: 12,
    zIndex: 100,
    alignItems: 'center',
  },
  giftBtnInner: {
    alignItems: 'center',
  },
  giftBtnCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FACC15',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FACC15',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  giftBtnEmoji: {
    fontSize: 24,
  },
  giftBtnLabel: {
    color: '#FACC15',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
});