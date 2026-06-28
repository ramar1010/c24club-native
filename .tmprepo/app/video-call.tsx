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
  ScrollView,
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

import { dlog } from '@/lib/debug-log';
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
import { getFriendlyErrorMessage } from '@/lib/error-utils';

// ─── Native WebRTC Imports (Guarded) ──────────────────────────────────────────
import {
  RTCPeerConnection,
  RTCView,
  mediaDevices,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
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
  iceTransportPolicy: "all" as any,
};

export default function VideoCallScreen({ modalInviteId, onDismiss }: { modalInviteId?: string; onDismiss?: () => void } = {}) {
  const params = useLocalSearchParams<{ 
    inviteId?: string;
    roomId?: string;
    partnerId?: string;
    type?: string;
    genderPreference?: 'Both' | 'Male' | 'Female';
  }>();
  // When rendered as a Modal, modalInviteId takes precedence over route params
  const inviteId = modalInviteId ?? params.inviteId;
  const roomId = params.roomId;
  const partnerId = params.partnerId;
  const type = params.type;
  const genderPreference = params.genderPreference;

  const { user, profile, minutes, refreshProfile } = useAuth();
  const router = useRouter();
  const toast = useToast();

  // Unified dismiss — works whether rendered as modal or as a route
  const dismiss = () => {
    if (onDismiss) {
      onDismiss();
    } else {
      router.back();
    }
  };

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

  // ─── Mount-time sync log (runs before any useEffect) ──────────────────────
  const [_mountLog] = useState(() => {
    dlog('VideoCall', 'component mounting (sync)', { inviteId, roomId, hasUser: !!user });
    return null;
  });

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
  const isMountedRef = useRef(true);                // guards setState after async IAP/gift ops

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
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    const activeId = inviteId || roomId;

    // user may be null on first render while AuthContext hydrates from AsyncStorage.
    // Do NOT call router.back() here — just wait for the next render when user is available.
    if (!activeId) {
      dlog('VideoCall', 'no activeId, going back');
      dismiss();
      return;
    }

    if (!user) {
      dlog('VideoCall', 'user not yet loaded, waiting for auth hydration...');
      return; // will re-run when user becomes available
    }

    dlog('VideoCall', 'useEffect fired with user', { userId: user.id, activeId });

    // Guard against double-execution (React Strict Mode / re-renders)
    if (isSetupRunRef.current) {
      dlog('VideoCall', 'setupCall already ran, skipping duplicate');
      return;
    }
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
                    Someone gifted you {gift.minutes_amount} minutes!
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
  }, [inviteId, roomId, user?.id]);

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

      await dlog('VideoCall', 'setupCall START', { activeId, inviteId, roomId, platform: Platform.OS });

      // ── Initiator Cleanup (runs BEFORE the iOS wait) ──────────────────────
      // Must happen first so we don't wipe Android callee's peer-ready signals
      // that arrive during the iOS hardware-release delay.
      if (inviteId) {
        // Determine initiator early so we can clean up stale signals right away
        const { data: inviteEarly } = await supabase
          .from('direct_call_invites')
          .select('inviter_id')
          .eq('id', inviteId)
          .single();
        if (inviteEarly?.inviter_id === user.id) {
          console.log('[VideoCall] Initiator: cleaning stale signals before iOS wait...');
          await supabase.from('room_signals').delete().eq('room_id', activeId);
        }
      }

      // iOS Stability: wait for camera hardware to release AFTER cleanup
      if (Platform.OS === 'ios') {
        await dlog('VideoCall', 'iOS: waiting 2500ms before acquiring camera');
        await new Promise(resolve => setTimeout(resolve, 2500));
        await dlog('VideoCall', 'iOS: wait done');
      }

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

        // Cleanup already ran above — skip here
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
        // Always acquire a fresh stream. Do NOT reuse tracks from another peer connection
        // (even via handoff) — on iOS, WebRTC tracks are owned by the RTCPeerConnection
        // that created them and cannot be safely moved to a new one. The releaseCamera()
        // in chat.tsx now stops tracks cleanly; we wait 2500ms above for full hardware release.
        await dlog('VideoCall', 'calling getUserMedia for fresh stream');
        const acquireStream = async (attempt = 0): Promise<any> => {
            try {
              await dlog('VideoCall', `getUserMedia attempt ${attempt + 1}`);
              return await mediaDevices.getUserMedia({
                audio: true,
                video: { facingMode: 'user' },
              });
            } catch (err: any) {
              await dlog('VideoCall', `getUserMedia FAILED attempt ${attempt + 1}`, { name: err?.name, message: err?.message });
              if (Platform.OS === 'ios' && attempt < 4) {
                const delay = (attempt + 1) * 2000;
                await dlog('VideoCall', `retrying in ${delay}ms`);
                await new Promise(r => setTimeout(r, delay));
                return acquireStream(attempt + 1);
              }
              if (Platform.OS === 'ios') {
                await dlog('VideoCall', 'falling back to audio-only stream');
                return await mediaDevices.getUserMedia({ audio: true, video: false });
              }
              throw err;
            }
          };
          currentStream = await acquireStream();

        if (Platform.OS === 'web' && typeof currentStream === 'object' && !currentStream.toURL) {
           (currentStream as any).toURL = () => currentStream;
        }

        await dlog('VideoCall', 'stream ready', { tracks: currentStream?.getTracks?.()?.map((t: any) => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })) });
        setLocalStream(currentStream);
      }
      // Keep ref in sync for cleanup stale-closure safety
      localStreamRef.current = currentStream;

      // 3. Create PeerConnection
      await dlog('VideoCall', 'creating RTCPeerConnection');
      pc.current = new RTCPeerConnection(configuration);
      await dlog('VideoCall', 'RTCPeerConnection created, adding tracks');
      
      currentStream.getTracks().forEach((track: any) => {
        pc.current?.addTrack(track, currentStream);
      });
      await dlog('VideoCall', 'tracks added to PC');

      if (pc.current) {
        pc.current.ontrack = (event: any) => {
          dlog('VideoCall', 'ontrack fired', { streams: event.streams?.length, track: event.track?.kind });
          let stream = event.streams?.[0] ?? null;
          // Web shim: build stream from individual tracks if needed
          if (!stream && event.track) {
            try { 
              if (MediaStream) {
                stream = new MediaStream([event.track]); 
              }
            } catch (_) {}
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
            dlog('VideoCall', 'ICE candidate generated');
            // Serialize properly for cross-platform compatibility
            const candidateData = event.candidate.toJSON ? event.candidate.toJSON() : event.candidate;
            sendSignal('ice-candidate', candidateData);
          }
        };

        // Connection state monitoring with 7s grace period (handles brief network flickers)
        pc.current.onconnectionstatechange = () => {
          const state = pc.current?.connectionState;
          dlog('VideoCall', 'connectionState changed', { state });
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
                  setTimeout(() => dismiss(), 2000);
                }
              }, 7000);
            }
          }
        };
      }

      // 4. Start Signaling Polling
      signalingInterval.current = setInterval(pollSignals, 700);

      // 5. Handshake: Send peer-ready
      // Both sides resend until handshake completes — this survives the initiator's stale-signal cleanup.
      const sendPeerReady = () => {
        console.log('[VideoCall] Sending peer-ready');
        sendSignal('peer-ready', { from: user.id });
      };

      sendPeerReady();

      // Initiator resends until it has sent an offer (localDescription set).
      // Callee resends until it has received an offer (remoteDescription set).
      // This ensures peer-ready is never permanently lost due to signal cleanup timing.
      let peerReadyAttempts = 0;
      peerReadyInterval.current = setInterval(() => {
        peerReadyAttempts++;
        if (peerReadyAttempts >= 20) {
          if (peerReadyInterval.current) clearInterval(peerReadyInterval.current);
          return;
        }
        if (isInitiatorRef.current && pc.current?.localDescription) {
          if (peerReadyInterval.current) clearInterval(peerReadyInterval.current);
          return;
        }
        if (!isInitiatorRef.current && pc.current?.remoteDescription) {
          if (peerReadyInterval.current) clearInterval(peerReadyInterval.current);
          return;
        }
        sendPeerReady();
      }, 1500);

      // ── Guaranteed offer timer (initiator only) ────────────────────────────
      // If peer-ready from callee is never received (race condition, missed signal,
      // or callee on older build), the initiator would deadlock waiting forever.
      // This fires after 3s and creates the offer unconditionally.
      // The peer-ready path above is the fast path; this is the safety net.
      if (isInitiator) {
        setTimeout(async () => {
          if (!pc.current || pc.current.localDescription) return; // already offered
          console.log('[VideoCall] Guaranteed offer timer fired — creating offer without peer-ready');
          try {
            if (peerReadyInterval.current) {
              clearInterval(peerReadyInterval.current);
              peerReadyInterval.current = null;
            }
            const offer = await pc.current.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            });
            await pc.current.setLocalDescription(offer);
            sendSignal('offer', offer);
            console.log('[VideoCall] Guaranteed offer sent');
          } catch (e: any) {
            console.warn('[VideoCall] Guaranteed offer failed:', e?.message);
          }
        }, 3000);
      }

      // 6. Broadcast our voice mode status
      sendSignal('voice-mode', { enabled: false, from: user.id });

      // 7. Monitor call status (hangup/declined) - Only for direct calls
      if (inviteId) {
        inviteStatusInterval.current = setInterval(async () => {
           const { data } = await supabase.from('direct_call_invites').select('status').eq('id', inviteId).single();
           if (data?.status === 'hangup' || data?.status === 'declined' || data?.status === 'expired') {
              setCallStatus('Ended');
              setTimeout(() => dismiss(), 2000);
           }
        }, 2000);
      }

    } catch (err: any) {
      await dlog('VideoCall', 'setupCall CRASHED', { name: err?.name, message: err?.message, stack: err?.stack });
      console.error('Setup failed:', err);
      Alert.alert('Call Error', getFriendlyErrorMessage(err));
      dismiss();
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
              const offer = await pc.current.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
              });
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
            setTimeout(() => dismiss(), 2000);
          }
        }
      }
    } catch (err) {
      console.error('Poll error:', err);
    }
  };

  const handleHangup = async () => {
    if (isHangingUpRef.current) return;
    isHangingUpRef.current = true;
    setCallStatus('Ended');
    await sendSignal('call-ended', { from: user?.id });
    // cleanup() called by useEffect return
    dismiss();
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
        sendSignal('voice-mode', { enabled: !videoTrack.enabled, from: user?.id });
      }
    }
  };

  const handleNext = () => {
    setCallStatus('Searching...');
    (skip as any)?.();
  };

  const handleSendGift = async (tier: (typeof GIFT_TIERS)[number], retryCount = 0) => {
     if (!partner) return;
     
     // Recipient must be Premium VIP
     const isPremium = await checkIsPremiumVip(partner.id);
     if (!isPremium) {
        Alert.alert('Ineligible', "This user isn't eligible to receive gifts.");
        return;
     }

     if (isMountedRef.current) setGiftLoading(tier.id);
     try {
       const result = await createGiftCheckout(tier.id, partner.id);
       if (!isMountedRef.current) return; // component unmounted during IAP sheet
       if (!result.success && result.error === 'cleared_retry' && retryCount < 2) {
         console.log(`[video-call] Cleared stuck transaction, auto-retrying... (attempt ${retryCount + 1})`);
         setGiftLoading(null);
         await handleSendGift(tier, retryCount + 1);
         return;
       }
       if (result.success) {
         setShowGiftOverlay(false);
         setShowGiftCelebration(true);
         refreshProfile();
       } else if (result.error !== 'cancelled') {
         Alert.alert('Purchase Failed', getFriendlyErrorMessage(result.error));
       }
     } catch (err) {
       if (isMountedRef.current) Alert.alert('Error', getFriendlyErrorMessage(err));
     } finally {
       if (isMountedRef.current) setGiftLoading(null);
     }
  };

  const submitReport = useCallback(async () => {
    if (!reportReason || !profile?.id) return;
    setReportSubmitting(true);
    try {
      const { error } = await supabase.from('user_reports').insert({
        reporter_id: profile.id,
        reported_user_id: partner?.id || partnerId,
        reason: reportReason,
        details: reportDetails,
      });

      if (error) throw error;
      setReportSubmitted(true);
      setTimeout(() => {
        setShowReport(false);
        setReportSubmitted(false);
        setReportReason('');
        setReportDetails('');
        handleHangup();
      }, 2000);
    } catch (err: any) {
      Alert.alert('Error', getFriendlyErrorMessage(err));
    } finally {
      setReportSubmitting(false);
    }
  }, [reportReason, reportDetails, profile?.id, partner?.id, partnerId]);

  return (
    <View style={styles.container}>
      {/* Remote Video (Full Screen) */}
      <View style={styles.remoteVideoContainer}>
        {remoteStream && !partnerIsVoiceMode ? (
          <Animated.View style={{ flex: 1, opacity: videoOpacity }}>
             <RTCView
               {...(Platform.OS === 'web'
                 ? { stream: remoteStream }
                 : { streamURL: typeof remoteStream?.toURL === 'function' ? remoteStream.toURL() : undefined }
               )}
               style={styles.remoteVideo}
               objectFit="cover"
               zOrder={0}
             />
          </Animated.View>
        ) : (
          <View style={styles.placeholderContainer}>
             <Image 
               source={{ uri: partner?.image_url || 'https://via.placeholder.com/400' }} 
               style={styles.partnerAvatar}
             />
             <VStack space="md" style={styles.centerItems}>
               <ActivityIndicator color="#EF4444" size="large" />
               <Text style={styles.statusText}>
                 {partnerIsVoiceMode ? `${partner?.name || 'Partner'} is in voice mode` : callStatus}
               </Text>
             </VStack>
          </View>
        )}
      </View>

      {/* Local Video (Floating) */}
      <View style={styles.localVideoContainer}>
        {localStream && !isCameraOff ? (
          <RTCView
            {...(Platform.OS === 'web'
              ? { stream: localStream }
              : { streamURL: typeof localStream?.toURL === 'function' ? localStream.toURL() : undefined }
            )}
            style={styles.localVideo}
            objectFit="cover"
            mirror={true}
            zOrder={1}
          />
        ) : (
          <View style={[styles.localVideo, styles.localVideoOff]}>
            <VideoOff color="#FFFFFF" size={24} />
          </View>
        )}
      </View>

      {/* Header Info */}
      <SafeAreaView style={styles.header}>
        <HStack style={styles.headerContent} space="md">
          <TouchableOpacity onPress={() => setShowReport(true)} style={styles.reportButton}>
             <Flag color="#FFFFFF" size={20} />
          </TouchableOpacity>
          <View style={styles.partnerInfo}>
            <Text style={styles.partnerName}>{partner?.name || 'Stranger'}</Text>
            {partner?.vip_tier && (
              <View style={styles.vipBadge}>
                <Zap size={10} color="#1A1A2E" fill="#1A1A2E" />
                <Text style={styles.vipText}>VIP</Text>
              </View>
            )}
          </View>
        </HStack>
      </SafeAreaView>

      {/* Bottom Controls */}
      <View style={styles.controls}>
        <HStack space="xl" style={styles.controlsRow}>
          <TouchableOpacity 
            style={[styles.controlButton, isMuted && styles.activeControl]} 
            onPress={toggleMute}
          >
            {isMuted ? <MicOff color="#FFFFFF" size={28} /> : <Mic color="#FFFFFF" size={28} />}
          </TouchableOpacity>

          <TouchableOpacity style={styles.hangupButton} onPress={handleHangup}>
            <PhoneOff color="#FFFFFF" size={32} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.controlButton, isCameraOff && styles.activeControl]} 
            onPress={toggleCamera}
          >
            {isCameraOff ? <VideoOff color="#FFFFFF" size={28} /> : <Video color="#FFFFFF" size={28} />}
          </TouchableOpacity>
        </HStack>

        <HStack space="lg" style={styles.actionRow}>
          <TouchableOpacity style={styles.actionButton} onPress={() => setShowGiftOverlay(true)}>
            <Gift color="#FACC15" size={24} />
            <Text style={styles.actionText}>Gift</Text>
          </TouchableOpacity>

          {type === 'random' && (
            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextText}>Next</Text>
              <ChevronRight color="#FFFFFF" size={20} />
            </TouchableOpacity>
          )}
        </HStack>
      </View>

      {/* Gift Overlay */}
      <RNModal visible={showGiftOverlay} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.giftSheet}>
            <HStack style={styles.modalHeader} space="md">
               <Heading size="md" style={styles.modalTitle}>Send a Gift</Heading>
               <TouchableOpacity onPress={() => setShowGiftOverlay(false)}>
                  <X color="#A1A1AA" size={24} />
               </TouchableOpacity>
            </HStack>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.giftList}>
                  {GIFT_TIERS.map((tier) => (
                     <TouchableOpacity 
                       key={tier.id} 
                       style={styles.giftCard}
                       onPress={() => handleSendGift(tier)}
                       disabled={giftLoading !== null}
                     >
                        <VStack space="xs" style={styles.centerItems}>
                           {giftLoading === tier.id ? (
                             <ActivityIndicator color="#FACC15" />
                           ) : (
                             <>
                               <Text style={styles.giftEmoji}>🎁</Text>
                               <Text style={styles.giftMinutes}>{tier.minutes} Min</Text>
                               <Text style={styles.giftPrice}>${tier.price}</Text>
                             </>
                           )}
                        </VStack>
                     </TouchableOpacity>
                  ))}
            </ScrollView>
          </View>
        </View>
      </RNModal>

      {/* Report Modal */}
      <RNModal visible={showReport} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.reportContent}>
            {reportSubmitted ? (
               <View style={styles.reportSuccess}>
                  <Heart color="#22C55E" size={48} fill="#22C55E" />
                  <Heading size="md" style={styles.reportSuccessText}>Report Submitted</Heading>
                  <Text style={styles.statusText}>We will review this match shortly.</Text>
               </View>
            ) : (
              <>
                <HStack style={styles.modalHeader} space="md">
                  <Heading size="md" style={styles.modalTitle}>Report User</Heading>
                  <TouchableOpacity onPress={() => setShowReport(false)}>
                    <X color="#A1A1AA" size={24} />
                  </TouchableOpacity>
                </HStack>

                <VStack space="lg">
                  <VStack space="xs">
                    <Text style={styles.inputLabel}>Reason</Text>
                    <TextInput
                      placeholder="e.g. Inappropriate behavior"
                      placeholderTextColor="#71717A"
                      style={styles.input}
                      value={reportReason}
                      onChangeText={setReportReason}
                    />
                  </VStack>

                  <VStack space="xs">
                    <Text style={styles.inputLabel}>Details (Optional)</Text>
                    <TextInput
                      placeholder="Provide more information..."
                      placeholderTextColor="#71717A"
                      style={styles.textarea}
                      multiline
                      numberOfLines={4}
                      value={reportDetails}
                      onChangeText={setReportDetails}
                    />
                  </VStack>

                  <TouchableOpacity 
                    style={[styles.reportSubmitBtn, !reportReason && styles.disabledBtn]} 
                    disabled={!reportReason || reportSubmitting}
                    onPress={submitReport}
                  >
                    {reportSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.reportSubmitBtnText}>Submit Report</Text>}
                  </TouchableOpacity>
                </VStack>
              </>
            )}
          </View>
        </View>
      </RNModal>

      <GiftCelebration 
        visible={showGiftCelebration} 
        recipientName={partner?.name || 'User'}
        onDismiss={() => setShowGiftCelebration(false)} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  remoteVideoContainer: {
    flex: 1,
  },
  remoteVideo: {
    flex: 1,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
  },
  partnerAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  centerItems: {
    alignItems: 'center',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  localVideoContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 100,
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#000000',
  },
  localVideo: {
    flex: 1,
  },
  localVideoOff: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E1E3A',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  headerContent: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  reportButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  partnerInfo: {
    flex: 1,
  },
  partnerName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  vipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FACC15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  vipText: {
    color: '#1A1A2E',
    fontSize: 10,
    fontWeight: '900',
    marginLeft: 2,
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
    paddingHorizontal: 30,
  },
  controlsRow: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeControl: {
    backgroundColor: '#EF4444',
  },
  hangupButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  nextText: {
    color: '#1A1A2E',
    fontSize: 14,
    fontWeight: '800',
    marginRight: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  giftSheet: {
    backgroundColor: '#1E1E3A',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    color: '#FFFFFF',
  },
  giftList: {
    paddingRight: 20,
  },
  giftCard: {
    width: 100,
    backgroundColor: '#25254A',
    borderRadius: 20,
    padding: 16,
    marginRight: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  giftEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  giftMinutes: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  giftPrice: {
    color: '#FACC15',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  reportContent: {
    backgroundColor: '#1E1E3A',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    paddingBottom: 40,
  },
  inputLabel: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#25254A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 15,
  },
  textarea: {
    backgroundColor: '#25254A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 15,
    height: 100,
    textAlignVertical: 'top',
  },
  reportSubmitBtn: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
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