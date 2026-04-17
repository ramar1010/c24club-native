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
import { usePreBlur } from '@/hooks/usePreBlur';
import { BlurView } from 'expo-blur';

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
    if (isFrozen && callState === 'connected') setShowFrozen(true);
  }, [isFrozen, callState]);

  // Suppress freeze/cap popup if user snoozed it
  useEffect(() => {
    if (!showCapPopup && !showFrozen) return;
    AsyncStorage.getItem(FREEZE_SNOOZE_KEY).then((val) => {
      if (val && Date.now() < parseInt(val, 10)) {
        setShowCapPopup(false);
        setShowFrozen(false);
      }
    });
  }, [showCapPopup, showFrozen]);

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
      let count = 0;
      const runPulse = () => {
        if (count >= 3) {
          giftPulseAnim.setValue(1);
          return;
        }
        giftPulseRef.current = Animated.sequence([
          Animated.timing(giftPulseAnim, { toValue: 1.15, duration: 350, useNativeDriver: true }),
          Animated.timing(giftPulseAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
        ]);
        giftPulseRef.current.start(() => {
          count++;
          runPulse();
        });
      };
      runPulse();
      return () => {
        giftPulseRef.current?.stop();
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
    callState === 'connected',
    partnerId,
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
      {partnerIsVoiceMode ? (
        <View style={styles.remoteVideoPlaceholder}>
          <VoiceModeAvatar size={120} />
        </View>
      ) : remoteStream ? (
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[
            StyleSheet.absoluteFill,
            {
              transform: [{
                scale: blurOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.15]
                })
              }]
            }
          ]}>
            <RTCView
              streamURL={typeof remoteStream.toURL === 'function' ? remoteStream.toURL() : remoteStream}
              style={styles.remoteVideo}
              objectFit="cover"
              zOrder={0}
            />
          </Animated.View>
          {isBlurred && (
            <Animated.View 
              style={[
                StyleSheet.absoluteFill, 
                { 
                  opacity: blurOpacity,
                  zIndex: 20,
                  elevation: 20,
                  backgroundColor: 'rgba(0,0,0,0.1)' 
                }
              ]}
              pointerEvents="none"
            >
              <BlurView intensity={100} style={StyleSheet.absoluteFill} tint="dark" />
            </Animated.View>
          )}
        </View>
      ) : (
        <View style={styles.remoteVideoPlaceholder}>
          <ActivityIndicator size="large" color="#EF4444" />
          <Text style={{ color: '#A1A1AA', marginTop: 12 }}>Connecting...</Text>
        </View>
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

      {/* My pinned topics — red chips, bottom-left */}
      {pinnedTopicNames.length > 0 && (
        <View style={styles.myChipsContainer}>
          {pinnedTopicNames.map((name, i) => (
            <View key={i} style={styles.myChip}>
              <Text style={styles.myChipText}>{name}</Text>
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

      {/* Partner's VIP pinned socials + Send Cash — shown to their partner only */}
      <PinnedSocialsDisplay
        socials={partnerSocials}
        showSendCash={showGiftIcon && callState === 'connected'}
        onSendCash={() => setShowGiftOverlay(true)}
        giftPulseAnim={giftPulseAnim}
      />

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
            <Text style={styles.modalTitle}>🥶 Your Minutes Are Frozen</Text>
            <Text style={styles.modalSubtitle}>
              {showCapPopup
                ? `You've hit your ${isFrozen ? 'freeze' : 'session'} minute cap. ${isFrozen ? 'While frozen, you can only earn 2 minutes per session. ' : ''}Upgrade to VIP for 3× more minutes per session, or do a one-time unfreeze.`
                : 'Your minutes are frozen because you\'ve hit the freeze threshold. Unfreeze to continue earning. While frozen, you can only earn 2 minutes per session.'}
            </Text>
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
  container: {
    flex: 1,
    backgroundColor: '#0c0c14',
  },

  // ─── Top bar ───────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: '#0c0c14',
    zIndex: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarCenter: {
    alignItems: 'center',
  },
  frozenBtn: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frozenBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '800',
  },
  minutesRight: {
    alignItems: 'flex-end',
    minWidth: 80,
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
    rowGap: 5, columnGap: 5,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  timerText: {
    color: '#22C55E',
    fontSize: 14,
    fontWeight: '800',
  },
  searchingText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
  },

  // ─── Main area ────────────────────────────────────────────────────────────
  mainArea: {
    flex: 1,
    position: 'relative',
  },

  // ─── Idle ─────────────────────────────────────────────────────────────────
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
  },
  voiceToggle: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    left: 0,
    right: 0,
    marginHorizontal: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: 10, columnGap: 10,
    backgroundColor: '#1E1E38',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A4A',
  },
  voiceToggleText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
  },
  voiceAvatarCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceModeLabel: {
    color: '#A1A1AA',
    fontSize: 10,
    marginTop: 4,
  },

  // ─── Waiting ──────────────────────────────────────────────────────────────
  waitingArea: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A2E',
  },
  waitingPulseSection: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 200,
    height: 200,
    marginBottom: 32,
  },
  pulseRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  pulseRingInner: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(239,68,68,0.2)',
  },
  waitingContent: {
    alignItems: 'center',
    zIndex: 10,
    marginBottom: 24,
  },
  waitingTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  waitingTimer: {
    color: '#A1A1AA',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 10,
  },
  waitingSubText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  waitingMessageSection: {
    alignItems: 'center',
    marginTop: 16,
  },
  waitingDiscoverBtn: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  waitingDiscoverBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },

  // ─── Video area ───────────────────────────────────────────────────────────
  videoArea: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
  },
  remoteVideo: {
    flex: 1,
  },
  remoteVideoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0c0c14',
  },
  topicsRow: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
  },
  topicsContent: {
    paddingHorizontal: 12,
    rowGap: 6, columnGap: 6,
  },
  topicChip: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginRight: 6,
  },
  topicChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  reportBtn: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  localPip: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 120,
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1E1E38',
    borderWidth: 2,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
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
    top: 56,
    right: 12,
    flexDirection: 'column',
    alignItems: 'flex-end',
    rowGap: 6, columnGap: 6,
    maxWidth: 160,
  },
  partnerChip: {
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  partnerChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  myChipsContainer: {
    position: 'absolute',
    bottom: 180,
    left: 12,
    flexDirection: 'column',
    alignItems: 'flex-start',
    rowGap: 6, columnGap: 6,
    maxWidth: 160,
  },
  myChip: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  myChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  topicsTab: {
    position: 'absolute',
    left: -28,
    top: '28%',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopRightRadius: 10,
    borderTopLeftRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 10,
    transform: [{ rotate: '-90deg' }],
  },
  topicsTabText: {
    fontSize: 12,
  },
  topicsTabLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  topicsTabBadge: {
    backgroundColor: '#FFFFFF',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  topicsTabBadgeText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '900',
  },

  // ─── Gender filter ────────────────────────────────────────────────────────
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
    rowGap: 3, columnGap: 3,
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

  // ─── Bottom bar ───────────────────────────────────────────────────────────
  bottomBar: {
    backgroundColor: '#0c0c14',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#2A2A4A',
  },
  selfieBtn: {
    backgroundColor: '#EC4899',
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      native: {
        shadowColor: '#EC4899',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 8,
      },
    }),
  },
  selfieBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  startBtn: {
    backgroundColor: '#EF4444',
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      native: {
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 8,
      },
    }),
  },
  startBtnText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cancelBtn: {
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  cancelBtnText: {
    color: '#EF4444',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1,
  },
  callControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  ctrlBtn: {
    alignItems: 'center',
    rowGap: 4, columnGap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  ctrlLabel: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '600',
  },
  nextBtn: {
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    rowGap: 6, columnGap: 6,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 50,
    ...Platform.select({
      native: {
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 6,
      },
    }),
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  endCallBtn: {
    backgroundColor: '#EF4444',
    borderRadius: 50,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      native: {
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 6,
      },
    }),
  },

  // ─── Toast ────────────────────────────────────────────────────────────────
  minuteLossToast: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(20,20,30,0.9)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EF4444',
    zIndex: 100,
  },
  minuteLossToastText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '800',
  },

  // ─── Modals ───────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#1E1E38',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: '#2A2A4A',
    rowGap: 12, columnGap: 12,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  modalSubtitle: {
    color: '#A1A1AA',
    fontSize: 14,
    textAlign: 'center',
  },
  modalRedBtn: {
    backgroundColor: '#EF4444',
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalRedBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  modalGrayBtn: {
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2A2A4A',
  },
  modalGrayBtnText: {
    color: '#A1A1AA',
    fontSize: 15,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  remindLaterText: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '600',
  },

  // ─── Report sheet ─────────────────────────────────────────────────────────
  reportModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  reportSheet: {
    backgroundColor: '#1E1E38',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: '#2A2A4A',
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  reportTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  reportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8, columnGap: 8,
    marginBottom: 14,
  },
  reportReasonBtn: {
    backgroundColor: '#2A2A4A',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A3A5A',
    width: '47%',
  },
  reportReasonBtnActive: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  reportReasonText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
  },
  reportReasonTextActive: {
    color: '#EF4444',
  },
  reportDetailsInput: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A4A',
    color: '#FFFFFF',
    padding: 12,
    fontSize: 14,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  reportSuccess: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  reportSuccessText: {
    color: '#22C55E',
    fontSize: 16,
    fontWeight: '800',
  },

  // ─── Banned overlay ───────────────────────────────────────────────────────
  bannedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0c0c14',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  bannedContent: {
    alignItems: 'center',
    paddingHorizontal: 40,
    rowGap: 12, columnGap: 12,
  },
  bannedIcon: {
    fontSize: 64,
  },
  bannedTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
  },
  bannedReason: {
    color: '#A1A1AA',
    fontSize: 15,
    textAlign: 'center',
  },
  bannedDate: {
    color: '#71717A',
    fontSize: 12,
  },

  // ─── Gift overlay ─────────────────────────────────────────────────────────
  giftModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  giftModalCard: {
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  giftCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: '#EF4444',
    borderRadius: 18,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  giftModalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6,
    marginTop: 4,
    paddingRight: 36,
  },
  giftModalSubtitle: {
    color: '#9CA3AF',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 6,
  },
  giftModalPaypal: {
    color: '#22C55E',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 16,
  },
  giftTierWrapper: {
    marginBottom: 8,
  },
  giftTierBtn: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  giftTierContent: {
    alignItems: 'center',
  },
  giftTierLabel: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '900',
  },
  giftTierSublabel: {
    color: 'rgba(0,0,0,0.6)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  giftTierBonus: {
    color: '#FACC15',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  giftNoRefund: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
  },
});