import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  TextInput,
  Modal as RNModal,
  SafeAreaView,
  Image,
  Alert,
  Platform,
  Animated,
} from 'react-native';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Gift,
  Flag,
  X,
  Zap,
  DollarSign,
  Heart,
  ChevronRight,
} from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth, MemberProfile } from '@/contexts/AuthContext';
import { Text } from '@/components/ui/text';
import { Heading } from '@/components/ui/heading';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { useToast, Toast, ToastTitle, ToastDescription } from '@/components/ui/toast';
import { flattenStyle } from '@/utils/flatten-style';
import { createGiftCheckout, checkIsPremiumVip, GIFT_TIERS } from '@/lib/gift-utils';
import { GiftCelebration } from '@/components/GiftCelebration';
import { useRevealVideo } from '@/hooks/useRevealVideo';
import { LinearGradient } from 'expo-linear-gradient';

// ─── Native WebRTC Imports (Guarded) ──────────────────────────────────────────
import {
  RTCPeerConnection,
  RTCView,
  mediaDevices,
  RTCIceCandidate,
  RTCSessionDescription,
} from '@/lib/webrtc';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const configuration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp",
        "turns:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
  iceTransportPolicy: "all",
  iceCandidatePoolSize: 10,
};

export default function VideoCallScreen() {
  const { inviteId, roomId, partnerId, type, genderPreference } = useLocalSearchParams<{ 
    inviteId?: string;
    roomId?: string;
    partnerId?: string;
    type?: string;
    genderPreference?: 'Both' | 'Male' | 'Female';
  }>();
  const { user, profile, minutes, refreshProfile } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const matchStatus: string | null = null;
  const skip: ((...args: any[]) => void) | null = null;
  const newRoomId: string | undefined = undefined;
  const newPartnerId: string | undefined = undefined;

  const [localStream, setLocalStream] = useState<any | null>(null);
  const [remoteStream, setRemoteStream] = useState<any | null>(null);
  const [callStatus, setCallStatus] = useState<'Connecting...' | 'Calling...' | 'Connected' | 'Ended' | 'Searching...'>('Connecting...');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [partnerIsVoiceMode, setPartnerIsVoiceMode] = useState(false);
  const [showGiftOverlay, setShowGiftOverlay] = useState(false);
  const [showGiftCelebration, setShowGiftCelebration] = useState(false);
  const [giftLoading, setGiftLoading] = useState<number | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  
  const [partner, setPartner] = useState<{ name: string; image_url: string; id: string; vip_tier?: string } | null>(null);

  // ─── Reveal video after 3s delay on new partner ────────────────────────────
  const { showVideo, videoOpacity } = useRevealVideo(
    callStatus === 'Connected',
    partner?.id,
    3000,
    600,
  );

  const pc = useRef<RTCPeerConnection | null>(null);
  const isInitiatorRef = useRef(false);
  const processedSignalIds = useRef<Set<string>>(new Set());
  const signalingInterval = useRef<NodeJS.Timeout | null>(null);
  const peerReadyInterval = useRef<NodeJS.Timeout | null>(null);
  const inviteStatusInterval = useRef<NodeJS.Timeout | null>(null);
  const senderChannelRef = useRef<string>(user?.id || 'anonymous');
  const pendingRemoteCandidates = useRef<any[]>([]);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHangingUpRef = useRef(false);
  const localStreamRef = useRef<any | null>(null);  // ref copy avoids stale closures in cleanup
  const isSetupRunRef = useRef(false);              // prevents double setupCall (React Strict Mode)

  // Keep senderChannelRef in sync if user loads after mount
  useEffect(() => {
    if (user?.id) senderChannelRef.current = user.id;
  }, [user?.id]);

  // Handle new match from "Next" button
  useEffect(() => {
    if (type === 'random' && matchStatus === 'matched' && newRoomId && newPartnerId) {
      router.setParams({ roomId: newRoomId, partnerId: newPartnerId });
    }
  }, [matchStatus, newRoomId, newPartnerId, type]);

  useEffect(() => {
    const activeId = inviteId || roomId;
    if (!activeId || !user) {
      router.back();
      return;
    }

    // Guard against double-execution (React Strict Mode / re-renders)
    if (isSetupRunRef.current) return;
    isSetupRunRef.current = true;

    setupCall();
    
    // Listen for incoming gifts in real-time
    const giftChannel = supabase
      .channel('video_call_gifts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gift_transactions',
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          const gift = payload.new;
          toast.show({
            placement: 'top',
            render: ({ id }) => (
              <Toast nativeID={'toast-' + id} action="success" variant="solid">
                <VStack space="xs">
                  <ToastTitle>🎁 Gift Received!</ToastTitle>
                  <ToastDescription>
                    Someone gifted you {gift.minutes} minutes = ${gift.cash_value.toFixed(2)}!
                  </ToastDescription>
                </VStack>
              </Toast>
            ),
          });
          refreshProfile();
        }
      )
      .subscribe();

    return () => {
      cleanup();
      supabase.removeChannel(giftChannel);
    };
  }, [inviteId, roomId]);

  const cleanup = async () => {
    if (signalingInterval.current) clearInterval(signalingInterval.current);
    if (peerReadyInterval.current) clearInterval(peerReadyInterval.current);
    if (inviteStatusInterval.current) clearInterval(inviteStatusInterval.current);
    if (disconnectTimerRef.current) { clearTimeout(disconnectTimerRef.current); disconnectTimerRef.current = null; }
    
    // Use ref to avoid stale closure (localStream state may still be null here)
    if (localStreamRef.current) {
       localStreamRef.current.getTracks().forEach((track: any) => track.stop());
       localStreamRef.current = null;
    }
    if (pc.current) {
       pc.current.close();
       pc.current = null;
    }
    
    // Only write hangup to DB when the user intentionally ended the call
    // Prevents remounts/cleanup-on-unmount from killing the call for both sides
    const activeId = inviteId ? `direct-${inviteId}` : roomId;
    if (activeId) {
       if (inviteId && isHangingUpRef.current) {
         await supabase.from('direct_call_invites').update({ status: 'hangup' }).eq('id', inviteId);
       }
       // Only initiator should clear signals for direct calls to avoid wiping offer
       const shouldClear = isHangingUpRef.current && (!inviteId || isInitiatorRef.current);
       if (shouldClear) {
         await supabase.from('room_signals').delete().eq('room_id', activeId);
       }
    }
    setRemoteStream(null);
  };

  const setupCall = async () => {
    try {
      const activeId = inviteId ? `direct-${inviteId}` : roomId;
      if (!activeId || !user) return;

      setCallStatus('Connecting...');

      let isInitiator = false;
      if (inviteId) {
        // 1. Fetch invite details — no joins (FK/PostgREST join issues on this table)
        const { data: invite, error: inviteError } = await supabase
          .from('direct_call_invites')
          .select('*')
          .eq('id', inviteId)
          .single();

        if (inviteError || !invite) {
          console.warn('[VideoCall] invite fetch error:', inviteError);
          throw new Error('Invite not found');
        }

        isInitiator = invite.inviter_id === user.id;
        isInitiatorRef.current = isInitiator;
        const partnerMemberId = isInitiator ? invite.invitee_id : invite.inviter_id;

        // Fetch partner profile separately
        const { data: partnerData } = await supabase
          .from('members')
          .select('id, name, image_url, vip_tier')
          .eq('id', partnerMemberId)
          .maybeSingle();

        setPartner({
           id: partnerMemberId,
           name: partnerData?.name || 'Stranger',
           image_url: partnerData?.image_url || '',
           vip_tier: partnerData?.vip_tier,
        });
        setCallStatus(isInitiator ? 'Calling...' : 'Connecting...');

        // ── 1.1 Initiator Cleanup ──
        if (isInitiator) {
           console.log('[VideoCall] Initiator cleaning stale signals...');
           await supabase.from('room_signals').delete().eq('room_id', activeId);
        }
      } else if (type === 'random' && partnerId) {
        // Fetch partner profile for random match
        const { data: partnerData } = await supabase
          .from('members')
          .select('*')
          .eq('user_id', partnerId)
          .maybeSingle();
        
        if (partnerData) {
          setPartner({
            id: partnerData.user_id,
            name: partnerData.name || 'Stranger',
            image_url: partnerData.image_url || '',
            vip_tier: partnerData.membership === 'Premium' ? 'premium' : partnerData.membership === 'Basic' ? 'basic' : undefined
          });
        }
        setCallStatus('Connecting...');
        isInitiator = user.id < partnerId;
        isInitiatorRef.current = isInitiator;
      }

      // 2. Get local stream — acquire once, reuse for PeerConnection
      console.log('[VideoCall] Acquiring media stream...');
      let currentStream = localStream;
      if (!currentStream) {
        currentStream = await mediaDevices.getUserMedia({
          audio: true,
          video: { facingMode: 'user' },
        });
        console.log('[VideoCall] Media stream acquired successfully');
        setLocalStream(currentStream);
      }
      // Keep ref in sync for cleanup stale-closure safety
      localStreamRef.current = currentStream;

      // 3. Create PeerConnection
      pc.current = new RTCPeerConnection(configuration);
      
      currentStream.getTracks().forEach((track: any) => {
        pc.current?.addTrack(track, currentStream);
      });

      if (pc.current) {
        pc.current.ontrack = (event: any) => {
          let stream = event.streams?.[0] ?? null;
          // Web shim: build stream from individual tracks if needed
          if (!stream && event.track) {
            try { stream = new MediaStream([event.track]); } catch (_) {}
          }
          if (stream) {
            // Web shim: expose .toURL() for RTCView compatibility
            if (Platform.OS === 'web' && !stream.toURL) {
              stream.toURL = () => stream;
            }
            setRemoteStream(stream);
            setCallStatus('Connected');
          }
        };

        pc.current.onicecandidate = (event: any) => {
          if (event.candidate) {
            // Serialize properly for cross-platform compatibility
            const candidateData = event.candidate.toJSON ? event.candidate.toJSON() : event.candidate;
            sendSignal('ice-candidate', candidateData);
          }
        };

        // Connection state monitoring with 7s grace period (handles brief network flickers)
        pc.current.onconnectionstatechange = () => {
          const state = pc.current?.connectionState;
          console.log('[VideoCall] connectionState:', state);
          if (state === 'connected') {
            if (disconnectTimerRef.current) { clearTimeout(disconnectTimerRef.current); disconnectTimerRef.current = null; }
            setCallStatus('Connected');
          } else if (state === 'disconnected' || state === 'failed') {
            if (!isHangingUpRef.current && !disconnectTimerRef.current) {
              console.log(`[VideoCall] connectionState: ${state} — waiting 7s before ending...`);
              disconnectTimerRef.current = setTimeout(() => {
                disconnectTimerRef.current = null;
                if (!isHangingUpRef.current && pc.current?.connectionState !== 'connected') {
                  console.log('[VideoCall] Grace period expired — ending call');
                  setCallStatus('Ended');
                  setTimeout(() => router.back(), 2000);
                }
              }, 7000);
            }
          }
        };
      }

      // 4. Start Signaling Polling
      signalingInterval.current = setInterval(pollSignals, 700);

      // 5. Handshake: Send peer-ready
      // Callee sends once. Initiator resends every 1.5s until offer is sent.
      const sendPeerReady = () => {
        console.log('[VideoCall] Sending peer-ready');
        sendSignal('peer-ready', { from: user.id });
      };

      sendPeerReady();

      if (isInitiator) {
        let attempts = 0;
        peerReadyInterval.current = setInterval(() => {
          attempts++;
          if (attempts >= 20 || pc.current?.localDescription) {
            if (peerReadyInterval.current) clearInterval(peerReadyInterval.current);
            return;
          }
          sendPeerReady();
        }, 1500);
      }

      // 6. Broadcast our voice mode status
      sendSignal('voice-mode', { enabled: false, from: user.id });

      // 7. Monitor call status (hangup/declined) - Only for direct calls
      if (inviteId) {
        inviteStatusInterval.current = setInterval(async () => {
           const { data } = await supabase.from('direct_call_invites').select('status').eq('id', inviteId).single();
           if (data?.status === 'hangup' || data?.status === 'declined' || data?.status === 'expired') {
              setCallStatus('Ended');
              setTimeout(() => router.back(), 2000);
           }
        }, 2000);
      }

    } catch (err: any) {
      console.error('Setup failed:', err);
      Alert.alert('Call Error', err.message);
      router.back();
    }
  };

  const sendSignal = async (type: string, payload: any) => {
    const activeId = inviteId ? `direct-${inviteId}` : roomId;
    const channel = user?.id || senderChannelRef.current;
    if (!activeId || !channel || channel === 'anonymous') return;

    // ── Contract Wrapper ──
    // Web app expects { sdp: ..., from: ... } or { candidate: ..., from: ... }
    const wrappedPayload: any = { from: channel };
    if (type === 'offer' || type === 'answer') {
      wrappedPayload.sdp = payload;
    } else if (type === 'ice-candidate') {
      wrappedPayload.candidate = payload;
    } else {
      // For peer-ready, voice-mode, call-ended, etc. just merge
      Object.assign(wrappedPayload, payload);
    }

    try {
      console.log(`[VideoCall] Sending signal: ${type}`);
      await supabase.from('room_signals').insert({
        room_id: activeId,
        sender_channel: channel,
        signal_type: type,
        payload: wrappedPayload,
      } as any);
    } catch (err) {
      console.error('Signal error:', err);
    }
  };

  const pollSignals = async () => {
    const activeId = inviteId ? `direct-${inviteId}` : roomId;
    const channel = user?.id || senderChannelRef.current;
    if (!activeId || !channel || channel === 'anonymous' || !pc.current) return;
    try {
      const { data } = await supabase
        .from('room_signals')
        .select('*')
        .eq('room_id', activeId)
        .neq('sender_channel', channel)
        .order('created_at', { ascending: true });

      if (data) {
        for (const signal of data) {
          if (processedSignalIds.current.has(signal.id) || !pc.current) continue;
          processedSignalIds.current.add(signal.id);

          const payload = signal.payload;
          console.log(`[VideoCall] Received signal: ${signal.signal_type} from ${signal.sender_channel}`);
          
          if (signal.signal_type === 'voice-mode') {
            setPartnerIsVoiceMode(payload?.enabled ?? false);
            continue;
          }

          if (signal.signal_type === 'peer-ready') {
            // Initiator creates offer once peer-ready received
            if (isInitiatorRef.current && !pc.current.localDescription) {
              console.log('[VideoCall] Partner ready, creating offer...');
              if (peerReadyInterval.current) {
                clearInterval(peerReadyInterval.current);
                peerReadyInterval.current = null;
              }
              const offer = await pc.current.createOffer({});
              await pc.current.setLocalDescription(offer);
              sendSignal('offer', offer);
            }
            continue;
          }

          if (signal.signal_type === 'offer') {
            const sdp = payload.sdp || payload; // handle both wrapped and unwrapped for safety
            await pc.current.setRemoteDescription(new RTCSessionDescription(sdp));
            // Flush pending ICE candidates
            for (const candidate of pendingRemoteCandidates.current) {
              await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
            }
            pendingRemoteCandidates.current = [];
            const answer = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answer);
            sendSignal('answer', answer);
          } else if (signal.signal_type === 'answer') {
            const sdp = payload.sdp || payload;
            await pc.current.setRemoteDescription(new RTCSessionDescription(sdp));
            // Flush pending ICE candidates
            for (const candidate of pendingRemoteCandidates.current) {
              await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
            }
            pendingRemoteCandidates.current = [];
          } else if (signal.signal_type === 'ice-candidate') {
            const candidate = payload.candidate || payload;
            if (pc.current.remoteDescription) {
              await pc.current.addIceCandidate(new RTCIceCandidate(candidate));
            } else {
              pendingRemoteCandidates.current.push(candidate);
            }
          } else if (signal.signal_type === 'call-ended') {
            setCallStatus('Ended');
            setTimeout(() => router.back(), 2000);
          }
        }
      }
    } catch (err) {
      console.error('Polling error:', err);
    }
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOff(!videoTrack.enabled);
      }
    }
  };

  const handleEndCall = async () => {
    isHangingUpRef.current = true;
    if (disconnectTimerRef.current) { clearTimeout(disconnectTimerRef.current); disconnectTimerRef.current = null; }
    setCallStatus('Ended');
    await sendSignal('call-ended', {});
    await cleanup();
    router.back();
  };

  const handleNext = async () => {
    await cleanup();
    setCallStatus('Searching...');
    (skip as any)?.();
  };

  const handleSendGift = async (tier: typeof GIFT_TIERS[0]) => {
     if (!partner) return;
     
     // Recipient must be Premium VIP
     const isPremium = await checkIsPremiumVip(partner.id);
     if (!isPremium) {
        Alert.alert('Ineligible', "This user isn't eligible to receive gifts.");
        return;
     }

     setGiftLoading(tier.id);
     const result = await createGiftCheckout(tier.id, partner.id);
     setGiftLoading(null);

     if (result.success) {
       setShowGiftOverlay(false);
       setShowGiftCelebration(true);
     } else if (result.error !== 'cancelled') {
       Alert.alert('Purchase Failed', result.error || 'Something went wrong. Please try again.');
     }
  };

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
        console.warn('[video-call] Report insert error:', error.message, error.details);
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
      console.warn('[video-call] Report submit error:', err);
    } finally {
      setReportSubmitting(false);
    }
  }, [reportReason, reportDetails, profile?.id, partnerId]);

  const renderVideoArea = () => (
    <View style={styles.videoArea}>
      {/* Remote video */}
      {partnerIsVoiceMode ? (
        <View style={styles.remoteVideoPlaceholder}>
          <Image
            source={partner?.image_url ? { uri: partner.image_url } : require('@/assets/images/icon.png')}
            style={styles.voiceModeAvatar}
          />
          <Text style={styles.voiceModeLabel}>Voice Mode</Text>
        </View>
      ) : remoteStream ? (
        <View style={StyleSheet.absoluteFill}>
          {/* Placeholder shown for first 3s */}
          {!showVideo && (
            <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', zIndex: 10 }]}>
              <LinearGradient
                colors={['#0F0F1A', '#1A1A2E', '#0F0F1A']}
                style={StyleSheet.absoluteFill}
              />
              <View style={{ alignItems: 'center', gap: 14 }}>
                {partner?.image_url ? (
                  <Image
                    source={{ uri: partner.image_url }}
                    style={{ width: 80, height: 80, borderRadius: 40, opacity: 0.5 }}
                  />
                ) : (
                  <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#2A2A4A', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 36 }}>👤</Text>
                  </View>
                )}
                <View style={{ alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600' }}>
                    {partner?.name ? `Connected with ${partner.name}` : 'Match found!'}
                  </Text>
                  <Text style={{ color: '#71717A', fontSize: 13 }}>Starting video…</Text>
                </View>
                <ActivityIndicator size="small" color="#EF4444" style={{ marginTop: 4 }} />
              </View>
            </View>
          )}
          {/* RTCView — mounted immediately but revealed after delay */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: videoOpacity }]}>
            <RTCView
              streamURL={typeof remoteStream.toURL === 'function' ? remoteStream.toURL() : remoteStream}
              style={styles.remoteVideo}
              objectFit="cover"
              zOrder={0}
            />
          </Animated.View>
        </View>
      ) : (
        <View style={styles.remoteVideoPlaceholder}>
          <ActivityIndicator size="large" color="#EF4444" />
          <Text style={{ color: '#A1A1AA', marginTop: 12 }}>{callStatus}</Text>
        </View>
      )}

      {/* Local PiP */}
      <View style={styles.localVideoContainer}>
        {localStream && !isCameraOff ? (
          <RTCView
            streamURL={Platform.OS === 'web' ? localStream : localStream.toURL()}
            style={styles.localVideo}
            objectFit="cover"
            mirror={true}
          />
        ) : (
          <View style={styles.localPlaceholder}>
             <VideoOff size={24} color="#71717A" />
          </View>
        )}
      </View>

      {/* Header Info */}
      <SafeAreaView style={styles.header}>
        <View style={styles.topBar}>
          <View style={styles.statusBadge}>
            <View style={flattenStyle([styles.pulseDot,callStatus === 'Connected' ? styles.onlinePulse : undefined])} />
            <Text style={styles.statusText}>
              {callStatus === 'Connected' ? `Connected with ${partner?.name}` : 
               matchStatus === 'searching' ? 'Searching...' : callStatus}
            </Text>
          </View>

        </View>
        
        {callStatus === 'Connected' && (
           <View style={styles.giftHint}>
              <Text style={styles.giftHintText}>💸 Tap the gift button to send cash!</Text>
           </View>
        )}
      </SafeAreaView>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        <HStack space="xl" style={styles.controlsRow}>
          <TouchableOpacity 
            style={flattenStyle([styles.controlButton,isMuted ? styles.activeControl : undefined])} 
            onPress={toggleMute}
          >
            {isMuted ? <MicOff size={24} color="#FFFFFF" /> : <Mic size={24} color="#FFFFFF" />}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.giftButton} 
            onPress={() => setShowGiftOverlay(true)}
          >
            <Gift size={28} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.endCallButton} 
            onPress={handleEndCall}
          >
            <PhoneOff size={32} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={flattenStyle([styles.controlButton,isCameraOff ? styles.activeControl : undefined])} 
            onPress={toggleCamera}
          >
             {isCameraOff ? <VideoOff size={24} color="#FFFFFF" /> : <Video size={24} color="#FFFFFF" />}
          </TouchableOpacity>

          {type === 'random' && (
            <TouchableOpacity 
              style={flattenStyle([styles.controlButton, styles.nextButton])} 
              onPress={handleNext}
              disabled={matchStatus === 'searching'}
            >
               <ChevronRight size={32} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => setShowReport(true)}
          >
            <Flag size={22} color="#EF4444" />
          </TouchableOpacity>
        </HStack>
      </View>

      {/* Gift Overlay */}
      {showGiftOverlay && (
         <View style={styles.overlay}>
            <TouchableOpacity style={styles.overlayClose} onPress={() => setShowGiftOverlay(false)} />
            <VStack space="lg" style={styles.giftMenu}>
               <HStack style={styles.giftHeader}>
                  <Heading style={styles.giftTitle}>Send a Gift 🎁</Heading>
                  <TouchableOpacity onPress={() => setShowGiftOverlay(false)}>
                     <X size={24} color="#71717A" />
                  </TouchableOpacity>
               </HStack>
               
               <Text style={styles.giftSubtitle}>
                  Support {partner?.name} by sending minutes they can cash out!
               </Text>
               
               <View style={styles.giftGrid}>
                  {GIFT_TIERS.map((tier) => (
                     <TouchableOpacity 
                       key={tier.id} 
                       style={styles.giftCard}
                       onPress={() => handleSendGift(tier)}
                       disabled={giftLoading !== null}
                     >
                        <VStack space="xs" style={styles.centerItems}>
                           {giftLoading === tier.id ? (
                             <ActivityIndicator size="small" color="#FACC15" />
                           ) : (
                             <>
                               <View style={styles.giftIconBg}>
                                  <DollarSign size={24} color="#FACC15" />
                               </View>
                               <Text style={styles.giftMins}>{tier.minutes} mins</Text>
                               <Text style={styles.giftPrice}>${tier.price.toFixed(2)}</Text>
                               {tier.senderBonus > 0 && <Text style={styles.bonusText}>+{tier.senderBonus} bonus</Text>}
                             </>
                           )}
                        </VStack>
                     </TouchableOpacity>
                  ))}
               </View>
               
               <View style={styles.infoBox}>
                  <Text style={styles.infoText}>
                     Gifts get a 20% bonus on minutes credited to the recipient!
                  </Text>
               </View>
            </VStack>
         </View>
      )}

      <GiftCelebration
        visible={showGiftCelebration}
        recipientName={partner?.name || 'this user'}
        onDismiss={() => setShowGiftCelebration(false)}
      />

      {/* Report Modal */}
      <RNModal visible={showReport} transparent animationType="slide" onRequestClose={() => setShowReport(false)}>
        <View style={styles.reportModalOverlay}>
          <View style={styles.reportSheet}>
            <View style={styles.reportHeader}>
              <Text style={styles.reportTitle}>Report User</Text>
              <TouchableOpacity onPress={() => setShowReport(false)}>
                <X size={22} color="#71717A" />
              </TouchableOpacity>
            </View>
            {reportSubmitted ? (
              <View style={styles.reportSuccess}>
                <Text style={styles.reportSuccessText}>✅ Report submitted. Thank you!</Text>
              </View>
            ) : (
              <>
                <View style={styles.reportGrid}>
                  {['Underage User','Inappropriate Behavior','Nudity / Sexual Content','Harassment / Bullying','Hate Speech / Discrimination','Spam / Scam','Violence / Threats','Other'].map((reason) => (
                    <TouchableOpacity
                      key={reason}
                      style={[styles.reportReasonBtn,reportReason === reason ? styles.reportReasonBtnActive : undefined]}
                      onPress={() => setReportReason(reason)}
                    >
                      <Text style={[styles.reportReasonText,reportReason === reason ? styles.reportReasonTextActive : undefined]}>
                        {reason}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.reportDetailsInput}
                  placeholder="Additional details (optional)"
                  placeholderTextColor="#52525B"
                  multiline
                  numberOfLines={3}
                  value={reportDetails}
                  onChangeText={setReportDetails}
                />
                <TouchableOpacity
                  style={[styles.reportSubmitBtn,!reportReason ? styles.disabledBtn : undefined]}
                  onPress={submitReport}
                  disabled={!reportReason || reportSubmitting}
                >
                  {reportSubmitting
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.reportSubmitBtnText}>Submit Report</Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </RNModal>
    </View>
  );

  return (
    <View style={styles.container}>
      {renderVideoArea()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  videoArea: {
    flex: 1,
    position: 'relative',
  },
  remoteVideoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  remoteVideo: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  remoteVideoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceModeAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.6)',
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceModeLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  placeholderContainer: {
    alignItems: 'center',
    gap: 16,
  },
  placeholderText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  localVideoContainer: {
    position: 'absolute',
    bottom: 120,
    right: 20,
    width: 100,
    height: 150,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1E1E38',
    borderWidth: 2,
    borderColor: '#2A2A4A',
    zIndex: 10,
  },
  localVideo: {
    width: 100,
    height: 150,
  },
  localPlaceholder: {
     flex: 1,
     justifyContent: 'center',
     alignItems: 'center',
  },
  header: {
    position: 'absolute',
    top: 20,
    width: '100%',
    alignItems: 'center',
    zIndex: 20,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    alignItems: 'flex-start',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    gap: 8,
    alignSelf: 'flex-start',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  onlinePulse: {
    backgroundColor: '#22C55E',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  statsContainer: {
    alignItems: 'flex-end',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'sans-serif-medium',
  },
  statValue: {
    color: '#FFFFFF',
  },
  pointsText: {
    color: '#FACC15',
    fontSize: 14,
    fontWeight: '800',
    marginTop: -2,
  },
  pointsValue: {
    color: '#FACC15',
  },
  giftHint: {
     marginTop: 12,
     backgroundColor: 'rgba(250, 204, 21, 0.2)',
     paddingHorizontal: 12,
     paddingVertical: 6,
     borderRadius: 8,
  },
  giftHintText: {
     color: '#FACC15',
     fontSize: 12,
     fontWeight: '800',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 40,
    width: '100%',
    alignItems: 'center',
    zIndex: 30,
  },
  controlsRow: {
    backgroundColor: 'rgba(30, 30, 56, 0.8)',
    padding: 20,
    borderRadius: 40,
    alignItems: 'center',
  },
  controlButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeControl: {
    backgroundColor: '#EF4444',
  },
  nextButton: {
    backgroundColor: '#3B82F6',
  },
  giftButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endCallButton: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
     position: 'absolute',
     top: 0,
     left: 0,
     right: 0,
     bottom: 0,
     backgroundColor: 'rgba(0,0,0,0.7)',
     zIndex: 50,
     justifyContent: 'flex-end',
  },
  overlayClose: {
     flex: 1,
  },
  giftMenu: {
     backgroundColor: '#1E1E38',
     borderTopLeftRadius: 32,
     borderTopRightRadius: 32,
     padding: 24,
     paddingBottom: 48,
  },
  giftHeader: {
     justifyContent: 'space-between',
     alignItems: 'center',
  },
  giftTitle: {
     color: '#FFFFFF',
     fontSize: 24,
     fontWeight: '900',
  },
  giftSubtitle: {
     color: '#A1A1AA',
     fontSize: 14,
     marginBottom: 8,
  },
  giftGrid: {
     flexDirection: 'row',
     flexWrap: 'wrap',
     gap: 12,
     justifyContent: 'center',
  },
  giftCard: {
     width: (SCREEN_WIDTH - 72) / 2,
     backgroundColor: '#1A1A2E',
     borderRadius: 20,
     padding: 16,
     borderWidth: 1,
     borderColor: '#2A2A4A',
  },
  giftIconBg: {
     width: 48,
     height: 48,
     borderRadius: 24,
     backgroundColor: 'rgba(250, 204, 21, 0.1)',
     justifyContent: 'center',
     alignItems: 'center',
     marginBottom: 4,
  },
  giftMins: {
     color: '#FFFFFF',
     fontSize: 16,
     fontWeight: '800',
  },
  giftPrice: {
     color: '#FACC15',
     fontSize: 14,
     fontWeight: '700',
  },
  bonusText: {
     color: '#22C55E',
     fontSize: 11,
     fontWeight: '600',
  },
  centerItems: {
     alignItems: 'center',
  },
  infoBox: {
     backgroundColor: 'rgba(34, 197, 94, 0.1)',
     padding: 12,
     borderRadius: 12,
     marginTop: 12,
  },
  infoText: {
     color: '#22C55E',
     fontSize: 12,
     textAlign: 'center',
     fontWeight: '600',
  },
  reportModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  reportSheet: {
    backgroundColor: '#1E1E38',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36, 
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  reportTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  reportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  reportReasonBtn: {
    backgroundColor: '#2A2A4A', 
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#3F3F5A',
  },
  reportReasonBtnActive: {
    borderColor: '#EF4444',
    backgroundColor: '#3A1A1A',
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
    backgroundColor: '#2A2A4A',
    borderRadius: 10,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 13,
    marginBottom: 12,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  reportSubmitBtn: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  reportSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  reportSuccess: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  reportSuccessText: {
    color: '#22C55E',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledBtn: {
    opacity: 0.4,
  },
});