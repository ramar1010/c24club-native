import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  ScrollView,
  Platform,
  DeviceEventEmitter,
  StyleSheet,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Video, VideoOff } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { useVideoChat } from '@/hooks/useVideoChat';
import { useCall } from '@/contexts/CallContext';
import { supabase } from '@/lib/supabase';
import { Text } from '@/components/ui/text';
import Toast from 'react-native-toast-message';
import { RTCView } from '@/lib/webrtc';
import SelfieCaptureModal from '@/components/SelfieCaptureModal';
import { FemaleNotifyCard } from '@/components/FemaleNotifyCard';
import { PinTopicsOverlay } from '@/components/videocall/PinTopicsOverlay';
import { usePinnedSocials } from '@/hooks/usePinnedSocials';
import { usePinTopics } from '@/hooks/usePinTopics';
import { useRevealVideo } from '@/hooks/useRevealVideo';
import { useGiftFeature } from '@/hooks/useGiftFeature';
import { useFreezeHandler } from '@/hooks/useFreezeHandler';
import { useNsfwRestriction } from '@/hooks/useNsfwRestriction';
import { GiftCelebration } from '@/components/GiftCelebration';

import { ChatTopBar } from '@/components/chat/ChatTopBar';
import { ChatVideoArea } from '@/components/chat/ChatVideoArea';
import { ChatBottomControls } from '@/components/chat/ChatBottomControls';
import {
  ReportModal,
  SkipPenaltyModal,
  FreezeModal,
  PendingPopup,
  GiftOverlay,
  BannedOverlay,
  MinuteLossToast,
} from '@/components/chat/ChatModals';
import { VoiceModeAvatar } from '@/components/chat/VoiceModeAvatar';
import styles from '@/components/chat/chat-styles';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
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

  // ─── NSFW shadowban restriction ────────────────────────────────────────────
  const { isRestricted } = useNsfwRestriction(profile?.id);
  const [showRestrictionPopup, setShowRestrictionPopup] = useState(false);

  // ─── Reveal video after 3s delay on new partner ────────────────────────────
  const { showVideo, videoOpacity } = useRevealVideo(
    callState === 'connected',
    partnerId,
    3000,
    600,
  );

  // ─── Partner pinned socials ────────────────────────────────────────────────
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

  useEffect(() => {
    if (partnerId && callState === 'connected') {
      fetchPartnerTopics(partnerId).then(setPartnerPinnedTopics);
    } else {
      setPartnerPinnedTopics([]);
    }
  }, [partnerId, callState]);

  // ─── Remote video track check ──────────────────────────────────────────────
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);

  useEffect(() => {
    if (!remoteStream) { setRemoteHasVideo(false); return; }
    const checkTracks = () => {
      const tracks = typeof remoteStream.getVideoTracks === 'function' ? remoteStream.getVideoTracks() : [];
      setRemoteHasVideo(tracks.length > 0 && tracks.some((t: any) => t.enabled));
    };
    checkTracks();
    const interval = setInterval(checkTracks, 2000);
    return () => clearInterval(interval);
  }, [remoteStream]);

  // ─── Waiting timer ─────────────────────────────────────────────────────────
  const [waitingSeconds, setWaitingSeconds] = useState(0);

  useEffect(() => {
    if (callState !== 'waiting') { setWaitingSeconds(0); return; }
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
  const [showBanned, setShowBanned] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [banDate, setBanDate] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [showPendingPopup, setShowPendingPopup] = useState(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Animated search pulse ─────────────────────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ─── Gift feature ──────────────────────────────────────────────────────────
  const {
    showGiftIcon,
    showGiftOverlay,
    setShowGiftOverlay,
    giftLoading,
    partnerName,
    showGiftCelebration,
    setShowGiftCelebration,
    giftPulseAnim,
    handleGiftTier,
  } = useGiftFeature(partnerId, callState);

  // ─── Freeze handler ────────────────────────────────────────────────────────
  const {
    showFrozen,
    unfreezeLoading,
    handleCloseFreeze,
    handleRemindIn2Days,
    handleOneTimeUnfreeze,
  } = useFreezeHandler({
    isFrozen,
    callState,
    showCapPopup,
    setShowCapPopup,
    refreshProfile,
    updateMinutes,
  });

  // ─── Restart camera preview when tab is focused ───────────────────────────
  useFocusEffect(
    useCallback(() => {
      restartPreview();
    }, [restartPreview])
  );

  // ─── Stop session when a direct call is accepted ──────────────────────────
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('prepare-direct-call', async () => {
      if (callState !== 'idle') await handleStop();
    });
    return () => sub.remove();
  }, [callState, handleStop]);

  // ─── Session init & IP ban check ──────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try { await supabase.functions.invoke('session-init', { body: {} }); } catch (_) {}
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

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    // Shadowban gate — blocked users see a popup instead of starting
    if (isRestricted) {
      setShowRestrictionPopup(true);
      return;
    }
    const gpMap: Record<string, string> = { Both: 'Both', Girls: 'Female', Guys: 'Male' };
    await startCall(gpMap[genderFilter] ?? 'Both', isVoiceMode);
  }, [genderFilter, isVoiceMode, startCall, isRestricted]);

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
      if (error) { setReportSubmitting(false); return; }
      setReportSubmitted(true);
      setTimeout(() => {
        setShowReport(false);
        setReportSubmitted(false);
        setReportReason('');
        setReportDetails('');
      }, 1800);
    } catch (_) {
    } finally {
      setReportSubmitting(false);
    }
  }, [reportReason, reportDetails, profile?.id, partnerId]);

  // ─── Idle & Waiting area renderers ────────────────────────────────────────
  const renderIdleArea = () => (
    <View style={styles.idleArea}>
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

  const hasSubmittedSelfie = !!(profile?.image_url || (profile?.image_status && profile.image_status !== 'pending'));

  // ─── Main layout ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top bar */}
      <ChatTopBar
        callState={callState}
        isFrozen={isFrozen}
        elapsedSeconds={elapsedSeconds}
        totalMinutes={totalMinutes}
        onBack={() => {
          if (callState !== 'idle') handleStop();
          if (router.canGoBack()) router.back(); else router.replace('/');
        }}
        onFrozenPress={() => {}}
      />

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
        {(callState === 'connecting' || callState === 'connected') && (
          <ChatVideoArea
            localStream={localStream}
            remoteStream={remoteStream}
            isVoiceMode={isVoiceMode}
            isCameraOff={isCameraOff}
            partnerIsVoiceMode={partnerIsVoiceMode}
            remoteHasVideo={remoteHasVideo}
            showVideo={showVideo}
            videoOpacity={videoOpacity}
            partnerGender={partnerGender}
            partnerTopics={partnerTopics}
            partnerPinnedTopics={partnerPinnedTopics}
            pinnedTopicIds={pinnedTopicIds}
            pinnedTopicNames={pinnedTopicNames}
            partnerSocials={partnerSocials}
            showGiftIcon={showGiftIcon && callState === 'connected'}
            giftPulseAnim={giftPulseAnim}
            profileGender={profile?.gender}
            onReport={() => setShowReport(true)}
            onSendCash={() => setShowGiftOverlay(true)}
            onTopicsTabPress={() => setShowTopicsOverlay(true)}
          />
        )}
      </View>

      {/* Bottom controls */}
      <ChatBottomControls
        callState={callState}
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        isVoiceMode={isVoiceMode}
        genderFilter={genderFilter}
        isVip={minutes?.is_vip}
        hasSubmittedSelfie={hasSubmittedSelfie}
        isRestricted={isRestricted}
        onStart={handleStart}
        onCancel={handleCancel}
        onNext={handleNextPress}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onToggleVoiceMode={toggleVoiceMode}
        onReport={() => setShowReport(true)}
        onGenderPill={handleGenderPill}
        onTakeSelfie={() => setShowSelfieModal(true)}
      />

      {/* ─── Overlays & Modals ──────────────────────────────────────────── */}

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

      <MinuteLossToast visible={showMinuteLossToast} />

      <SkipPenaltyModal
        visible={showSkipPenalty}
        onClose={() => setShowSkipPenalty(false)}
      />

      <FreezeModal
        visible={showCapPopup || showFrozen}
        showCapPopup={showCapPopup}
        isFrozen={isFrozen}
        unfreezeLoading={unfreezeLoading}
        onClose={handleCloseFreeze}
        onUpgradeVip={() => { handleCloseFreeze(); router.push('/vip'); }}
        onOneTimeUnfreeze={handleOneTimeUnfreeze}
        onRemindLater={handleRemindIn2Days}
      />

      <ReportModal
        visible={showReport}
        reportReason={reportReason}
        reportDetails={reportDetails}
        reportSubmitted={reportSubmitted}
        reportSubmitting={reportSubmitting}
        onClose={() => setShowReport(false)}
        onReasonSelect={setReportReason}
        onDetailsChange={setReportDetails}
        onSubmit={submitReport}
      />

      <BannedOverlay visible={showBanned} banReason={banReason} banDate={banDate} />

      <SelfieCaptureModal
        visible={showSelfieModal}
        onClose={() => setShowSelfieModal(false)}
        onSuccess={() => setShowSelfieModal(false)}
        onPendingReview={() => {
          setShowSelfieModal(false);
          setShowPendingPopup(true);
        }}
      />

      <PendingPopup
        visible={showPendingPopup}
        onClose={() => setShowPendingPopup(false)}
        onStartChatting={() => { setShowPendingPopup(false); handleStart(); }}
      />

      <GiftOverlay
        visible={showGiftOverlay}
        partnerName={partnerName}
        giftLoading={giftLoading}
        onClose={() => setShowGiftOverlay(false)}
        onGiftTier={handleGiftTier}
      />

      {/* Restriction popup — shown when a shadowbanned user tries to start */}
      <Modal visible={showRestrictionPopup} transparent animationType="fade" onRequestClose={() => setShowRestrictionPopup(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🚫 Account Restricted</Text>
            <Text style={styles.modalSubtitle}>
              Your account has been restricted from starting calls. Please contact support if you believe this is a mistake.
            </Text>
            <TouchableOpacity
              style={styles.modalRedBtn}
              onPress={() => {
                setShowRestrictionPopup(false);
                router.push('/rules');
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.modalRedBtnText}>View Community Rules</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalGrayBtn} onPress={() => setShowRestrictionPopup(false)} activeOpacity={0.8}>
              <Text style={styles.modalGrayBtnText}>Dismiss</Text>
            </TouchableOpacity>
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