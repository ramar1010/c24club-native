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
  Text as RNText,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePinnedSocials } from '@/hooks/usePinnedSocials';
import { usePinTopics } from '@/hooks/usePinTopics';
import { useRevealVideo } from '@/hooks/useRevealVideo';
import { useChatBlur } from '@/hooks/useChatBlur';
import { useGiftFeature } from '@/hooks/useGiftFeature';
import { useFreezeHandler } from '@/hooks/useFreezeHandler';
import { useNsfwRestriction } from '@/hooks/useNsfwRestriction';
import { useCameraPreviewScan } from '@/hooks/useCameraPreviewScan';
import { usePreCallScan } from '@/hooks/usePreCallScan';
import { GiftCelebration } from '@/components/GiftCelebration';
import { Check } from 'lucide-react-native';
import { CameraView } from 'expo-camera';
import ViewShot, { captureRef } from 'react-native-view-shot';

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
  const cameraRef = useRef<CameraView>(null);

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
    partnerIsVip,
    partnerLeft,
    toggleMute,
    toggleCamera,
    toggleVoiceMode,
    startCall,
    handleNext,
    handleStop: handleStopRaw,
    setShowCapPopup,
    restartPreview,
    releaseCamera,
  } = useVideoChat();

  // ─── NSFW shadowban restriction ────────────────────────────────────────────
  // partnerLeft is destructured from main useVideoChat() call above
  // (partnerLeft already in main destructure above)
  const { isRestricted, recheck: recheckRestriction } = useNsfwRestriction(profile?.id);
  const [showRestrictionPopup, setShowRestrictionPopup] = useState(false);

  const handleStop = useCallback(async () => {
    await handleStopRaw();
    refreshProfile();
  }, [handleStopRaw, refreshProfile]);

  const handleMessageMe = useCallback(async () => {
    if (!partnerId) return;

    // Stop call and release camera before navigating
    await handleStop();
    releaseCamera();

    // Navigate to DM
    router.push({
      pathname: '/messages/[id]',
      params: { id: 'new', partnerId: partnerId }
    });
  }, [partnerId, handleStop, releaseCamera, router]);

  // ─── Reveal video after 3s delay on new partner ────────────────────────────
  const { showVideo, videoOpacity } = useRevealVideo(
    callState === 'connected',
    partnerId,
    3000,
    600,
  );

  // ─── Sticky Auto-Blur ──────────────────────────────────────────────────────
  const { isBlurred, handleUnblur, setIsNsfwFlagged } = useChatBlur(partnerId, callState);

  // ─── Pre-chat & Idle Scanning (Gemini Flash) ──────────────────────────────
  const onFlagged = useCallback(() => {
    setShowRestrictionPopup(true);
    setIsNsfwFlagged(true);
    recheckRestriction(); // Force update the restricted state immediately
    if (callState !== 'idle') handleStopRaw();
  }, [callState, handleStop, recheckRestriction, setIsNsfwFlagged]);

  // Periodic scan while in idle preview
  const { runScan: runGeminiScan } = useCameraPreviewScan({
    cameraRef,
    userId: profile?.id,
    active: callState === 'idle',
    onFlagged,
  });

  const { scan: runPreCallScan } = usePreCallScan({ cameraRef, userId: profile?.id, onFlagged });

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
      text1: isMale ? '🔔 10+ women notified!' : '🎁 50+ men notified!',
      text2: isMale
        ? "We just notified 10+ women you are here! Stay active to meet new people."
        : "We just notified 50+ men you are here. Stay active to attract more gifts and rewards!",
      visibilityTime: 20000,
      position: 'top',
    });
  }, [waitingSeconds, callState, profile?.gender]);

  // ─── Overlay states ────────────────────────────────────────────────────────
  const [genderFilter, setGenderFilter] = useState<'Both' | 'Women' | 'Men'>('Both');
  const [isStarting, setIsStarting] = useState(false);
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
  const [isReportAiScanning, setIsReportAiScanning] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewShotRef = useRef<any>(null);

  // ─── Safety Agreement ──────────────────────────────────────────────────────
  const [showSafetyAgreement, setShowSafetyAgreement] = useState(false);
  const [isDirectCallActive, setIsDirectCallActive] = useState(false);

  useEffect(() => {
    const checkAgreement = async () => {
      const agreed = await AsyncStorage.getItem('c24_chat_safety_agreed');
      if (!agreed) {
        setShowSafetyAgreement(true);
      }
    };
    checkAgreement();
  }, []);

  const handleAgreeSafety = async () => {
    await AsyncStorage.setItem('c24_chat_safety_agreed', 'true');
    setShowSafetyAgreement(false);
  };

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
      const { dlog } = require('@/lib/debug-log');
      await dlog('ChatScreen', 'prepare-direct-call received', { callState });
      setIsDirectCallActive(true);
      if (callState !== 'idle') {
        await dlog('ChatScreen', 'calling handleStop() because callState=' + callState);
        await handleStop();
        await dlog('ChatScreen', 'handleStop() done');
      } else {
        await dlog('ChatScreen', 'callState is idle, skipping handleStop');
      }
      await dlog('ChatScreen', 'calling releaseCamera()');
      releaseCamera();
      await dlog('ChatScreen', 'releaseCamera() done');
    });
    const subDismiss = DeviceEventEmitter.addListener('direct-call-dismissed', () => {
      setIsDirectCallActive(false);
    });
    return () => {
      sub.remove();
      subDismiss.remove();
    };
  }, [callState, handleStop, releaseCamera]);

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

  // Check block status for current partner
  useEffect(() => {
    if (!profile?.id || !partnerId || callState !== 'connected') {
      setIsBlocked(false);
      return;
    }
    supabase
      .from('blocked_users')
      .select('id')
      .eq('blocker_id', profile.id)
      .eq('blocked_id', partnerId)
      .maybeSingle()
      .then(({ data }) => setIsBlocked(!!data));
  }, [profile?.id, partnerId, callState]);

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
    setIsStarting(true);
    // Run one final high-quality scan before allowing the user to enter the queue
    if (Platform.OS !== 'web') {
      const isFlagged = await runPreCallScan();
      if (isFlagged) {
        setShowRestrictionPopup(true);
        setIsStarting(false);
        return;
      }
    }

    const gpMap: Record<string, string> = { Both: 'Both', Women: 'Female', Men: 'Male' };
    try {
      await startCall(gpMap[genderFilter] ?? 'Both', isVoiceMode);
    } finally {
      setIsStarting(false);
    }
  }, [genderFilter, isVoiceMode, startCall, isRestricted]);

  const handleCancel = useCallback(async () => {
    await handleStop();
  }, [handleStop]);

  const handleNextPress = useCallback(async () => {
    const gpMap: Record<string, string> = { Both: 'Both', Women: 'Female', Men: 'Male' };
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

  const handleGenderPill = useCallback((option: 'Both' | 'Women' | 'Men') => {
    const isLocked = option !== 'Both' && !minutes?.is_vip;
    if (isLocked) { setShowVipModal(true); return; }
    setGenderFilter(option);
  }, [minutes?.is_vip, setShowVipModal]);

  const handleBlock = useCallback(async () => {
    if (!profile?.id || !partnerId) return;
    setBlockLoading(true);
    try {
      if (isBlocked) {
        await supabase
          .from('blocked_users')
          .delete()
          .eq('blocker_id', profile.id)
          .eq('blocked_id', partnerId);
        setIsBlocked(false);
      } else {
        await supabase
          .from('blocked_users')
          .insert({ blocker_id: profile.id, blocked_id: partnerId });
        setIsBlocked(true);
        // Automatically skip if blocking during call
        if (callState === 'connected' || callState === 'connecting') {
          setTimeout(() => {
            setShowReport(false);
            handleNextPress();
          }, 1000);
        }
      }
    } catch (_) {
    } finally {
      setBlockLoading(false);
    }
  }, [profile?.id, partnerId, isBlocked, callState, handleNextPress]);

  const submitReport = useCallback(async () => {
    if (!reportReason || !profile?.id) return;
    setReportSubmitting(true);

    // ─── Instant Evidence AI Scan ───────────────────────────────────────────
    if (reportReason === 'Nudity / Sexual Content' && partnerId && callState === 'connected') {
      setIsReportAiScanning(true);
      try {
        const uri = await captureRef(viewShotRef, {
          format: 'jpg',
          quality: 0.5,
          result: 'base64',
        });

        if (uri) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            const res = await fetch('https://ncpbiymnafxdfsvpxirb.supabase.co/functions/v1/moderate-frame', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                frame: uri,
                reported_user_id: partnerId,
                source: 'user_report_evidence',
              }),
            });

            if (res.ok) {
              const scanData = await res.json();
              if (scanData.flagged) {
                console.log('[ReportScan] Instant evidence flagged partner.');
                setIsNsfwFlagged(true); // Blur instantly
                // The edge function already handles the strike/ban if score is high enough
              }
            }
          }
        }
      } catch (err) {
        console.warn('[ReportScan] Capture error:', err);
      } finally {
        setIsReportAiScanning(false);
      }
    }

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
            <View style={styles.idleArea}>
              {/* Native: Use CameraView for idle preview (supports Gemini scanning) */}
              {Platform.OS !== 'web' && !isDirectCallActive && (
                <View style={styles.idlePreview}>
                  <CameraView
                    ref={cameraRef}
                    style={styles.idlePreviewRTC}
                    facing="front"
                    mode="video"
                    mute={true}
                    responsiveOrientationWhenInactive={true}
                  />
                </View>
              )}
              {/* On Web we still need a preview in the idle area if not native */}
              {Platform.OS === 'web' && (
                <View style={styles.idlePreview}>
                  {localStream ? (
                    <RTCView
                      streamURL={typeof localStream.toURL === 'function' ? localStream.toURL() : undefined}
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
              )}
            </View>
            <FemaleNotifyCard
              compact
              onSettingsPress={() => router.push('/notification-settings')}
            />
          </ScrollView>
        )}
        {callState === 'waiting' && renderWaitingArea()}
        {(callState === 'connecting' || callState === 'connected') && (
          <ViewShot ref={viewShotRef} style={{ flex: 1 }}>
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
              onSendCash={() => setShowGiftOverlay(true)}
              onTopicsTabPress={() => setShowTopicsOverlay(true)}
              isBlurred={isBlurred}
              onUnblur={handleUnblur}
              isRestricted={isRestricted}
              partnerLeft={partnerLeft}
            />
          </ViewShot>
        )}
      </View>

      {/* Bottom controls */}
      <ChatBottomControls
        callState={callState}
        isStarting={isStarting}
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
        onMessageMe={handleMessageMe}
        onGenderPill={handleGenderPill}
        onTakeSelfie={() => setShowSelfieModal(true)}
        userGender={profile?.gender}
        partnerGender={partnerGender}
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
        onBlock={handleBlock}
        isBlocked={isBlocked}
        blockLoading={blockLoading}
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
            <Text style={styles.modalTitle}>⚠️ Safety Warning</Text>
            <Text style={styles.modalSubtitle}>
              Our AI has detected potential community rule violations. Your video will be forced-blurred for other users until your account is reviewed.
            </Text>
            <TouchableOpacity
              style={styles.modalRedBtn}
              onPress={() => {
                setShowRestrictionPopup(false);
                handleStart(); // Let them start anyway
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.modalRedBtnText}>Continue with Blur</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.modalGrayBtn} 
              onPress={() => {
                setShowRestrictionPopup(false);
                router.push('/rules');
              }} 
              activeOpacity={0.8}
            >
              <Text style={styles.modalGrayBtnText}>View Rules</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <GiftCelebration
        visible={showGiftCelebration}
        recipientName={partnerName}
        onDismiss={() => setShowGiftCelebration(false)}
      />

      {/* Safety Agreement Modal */}
      <Modal
        visible={showSafetyAgreement}
        transparent
        animationType="slide"
        onRequestClose={() => {}}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#1E1E38', borderRadius: 24, padding: 32, borderWidth: 1, borderColor: '#2A2A4A', width: '100%', maxWidth: 400, alignSelf: 'center' }}>
            <View style={{ alignItems: 'center', marginBottom: 32 }}>
              <RNText style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '800', textAlign: 'center' }}>AI Safety Community</RNText>
              <View style={{ height: 2, width: 40, backgroundColor: '#EF4444', marginTop: 12, borderRadius: 1 }} />
            </View>
            
            <RNText style={{ color: '#A1A1AA', fontSize: 16, textAlign: 'center', marginBottom: 32, lineHeight: 24 }}>
              We use real-time AI to keep our community safe. By continuing, you agree to:
            </RNText>
            
            <View style={{ marginBottom: 32 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <Check size={20} color="#22C55E" />
                <RNText style={{ color: '#FFFFFF', fontSize: 16, marginLeft: 12, fontWeight: '500' }}>No nudity or sexual behavior</RNText>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <Check size={20} color="#22C55E" />
                <RNText style={{ color: '#FFFFFF', fontSize: 16, marginLeft: 12, fontWeight: '500' }}>No bullying or harassment</RNText>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <Check size={20} color="#22C55E" />
                <RNText style={{ color: '#FFFFFF', fontSize: 16, marginLeft: 12, fontWeight: '500' }}>I consent to AI safety scanning</RNText>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Check size={20} color="#22C55E" />
                <RNText style={{ color: '#FFFFFF', fontSize: 16, marginLeft: 12, fontWeight: '500' }}>Must be 18 years or older</RNText>
              </View>
            </View>
            
            <RNText style={{ color: '#EF4444', fontSize: 14, fontWeight: '700', textAlign: 'center', marginBottom: 32, fontStyle: 'italic' }}>
              Violations will result in a permanent ban.
            </RNText>
            
            <TouchableOpacity 
              style={{ backgroundColor: '#EF4444', paddingVertical: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 }}
              onPress={handleAgreeSafety}
              activeOpacity={0.8}
            >
              <RNText style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '900' }}>CONTINUE</RNText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}