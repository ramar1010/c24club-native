import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { RTCPeerConnection, mediaDevices, RTCIceCandidate, RTCSessionDescription, MediaStream } from '@/lib/webrtc';
import { useCallMinutes } from '@/hooks/useCallMinutes';
import { useSkipPenalty } from '@/hooks/useSkipPenalty';

export type CallState = 'idle' | 'waiting' | 'connecting' | 'connected';

// ─── UUID helper ─────────────────────────────────────────────────────────────
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function useVideoChat() {
  const { user, profile, minutes } = useAuth();

  // ─── React state (triggers re-renders) ──────────────────────────────────────
  const [callState, setCallState] = useState<CallState>('idle');
  const [localStream, setLocalStream] = useState<any | null>(null);
  const [remoteStream, setRemoteStream] = useState<any | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [skipPenaltyCount, setSkipPenaltyCount] = useState(0);
  const [adPoints, setAdPoints] = useState(0);
  const [partnerGender, setPartnerGender] = useState<string | null>(null);
  const [partnerTopics, setPartnerTopics] = useState<string[]>([]);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [partnerIsVoiceMode, setPartnerIsVoiceMode] = useState(false);

  // ─── Refs (stale-closure-safe mutable values) ────────────────────────────────
  const memberIdRef = useRef<string | null>(null);
  const channelIdRef = useRef<string>(generateUUID());
  const roomIdRef = useRef<string | null>(null);
  const partnerIdRef = useRef<string | null>(null);
  const pcRef = useRef<any | null>(null);
  const localStreamRef = useRef<any | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const signalIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processedSignalIds = useRef<Set<string>>(new Set());
  const connectionStartTimeRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string>(generateUUID());
  const autoReconnectingRef = useRef(false);
  const capReachedRef = useRef(false);
  const isMountedRef = useRef(true);
  const skipPenaltyCountRef = useRef(0);
  const callStateRef = useRef<CallState>('idle');
  const isVoiceModeRef = useRef(false);
  const genderPrefRef = useRef<string>('Both');
  const isStoppingRef = useRef(false);

  // Keep callStateRef in sync
  const updateCallState = useCallback((s: CallState) => {
    callStateRef.current = s;
    setCallState(s);
  }, []);

  // ─── useCallMinutes — handles all earn logic correctly ──────────────────────
  const {
    totalMinutes,
    elapsedSeconds,
    showCapPopup,
    dismissCapPopup,
    flushMinutes,
    freezeInfo,
    refreshBalance,
  } = useCallMinutes({
    userId: user?.id ?? '',
    partnerId: partnerIdRef.current,
    isConnected: callState === 'connected',
    voiceMode: isVoiceMode,
    isVip: minutes?.is_vip ?? false,
  });

  // ─── useSkipPenalty — deducts minutes on quick skips ────────────────────────
  const { minutesLost, showPenaltyToast, checkAndApplyPenalty, dismissToast } = useSkipPenalty(user?.id ?? '');

  const isFrozen = freezeInfo.isFrozen;

  // ─── Sync auth data into state ───────────────────────────────────────────────
  useEffect(() => {
    if (user?.id) memberIdRef.current = user.id;
  }, [user?.id]);

  useEffect(() => {
    if (minutes) {
      setAdPoints(minutes.ad_points ?? 0);
    }
  }, [minutes]);

  useEffect(() => {
    // Default voice mode ON for female users
    if (profile?.gender === 'female' || profile?.gender === 'Female') {
      setIsVoiceMode(true);
      isVoiceModeRef.current = true;
    }
  }, [profile?.gender]);

  // ─── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearAllIntervals();
    };
  }, []);

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  function clearAllIntervals() {
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    if (signalIntervalRef.current) { clearInterval(signalIntervalRef.current); signalIntervalRef.current = null; }
    if (disconnectTimerRef.current) { clearTimeout(disconnectTimerRef.current); disconnectTimerRef.current = null; }
  }

  const cleanupPC = useCallback(() => {
    if (pcRef.current) {
      try { pcRef.current.close(); } catch (_) {}
      pcRef.current = null;
    }
  }, []);

  // ─── Local stream ─────────────────────────────────────────────────────────────
  const getLocalStream = useCallback(async (voiceMode: boolean) => {
    // ✅ Request Android permissions before accessing camera/mic
    if (Platform.OS === 'android') {
      try {
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);
        const cameraGranted = grants[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
        const micGranted = grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
        if (!micGranted) {
          console.warn('[useVideoChat] Microphone permission denied');
          return null;
        }
        if (!voiceMode && !cameraGranted) {
          console.warn('[useVideoChat] Camera permission denied — falling back to voice mode');
          voiceMode = true;
        }
      } catch (err) {
        console.warn('[useVideoChat] Permission request error:', err);
      }
    }

    // Stop old stream if exists
    if (localStreamRef.current) {
      try { localStreamRef.current.getTracks?.()?.forEach((t: any) => t.stop()); } catch (_) {}
      localStreamRef.current = null;
    }

    const constraints = voiceMode
      ? { audio: true, video: false }
      : { audio: true, video: { facingMode: 'user', width: 640, height: 480 } };

    try {
      const stream = await mediaDevices.getUserMedia(constraints);
      // Web shim: expose .toURL() for RTCView compatibility
      if (Platform.OS === 'web' && typeof stream === 'object' && !stream.toURL) {
        (stream as any).toURL = () => stream;
      }
      localStreamRef.current = stream;
      if (isMountedRef.current) setLocalStream(stream);
      return stream;
    } catch (err) {
      console.warn('[useVideoChat] getLocalStream error:', err);
      return null;
    }
  }, []);

  // Initialise camera preview on mount
  useEffect(() => {
    getLocalStream(isVoiceModeRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Signaling helpers ────────────────────────────────────────────────────────
  const sendSignal = useCallback(async (
    roomId: string,
    channelId: string,
    type: string,
    payload: any,
  ) => {
    try {
      await supabase.from('room_signals').insert({
        room_id: roomId,
        sender_channel: channelId,
        signal_type: type,
        payload,
      });
    } catch (err) {
      console.warn('[useVideoChat] sendSignal error:', err);
    }
  }, []);

  // ─── Peer Connection ──────────────────────────────────────────────────────────
  const createPeerConnection = useCallback((roomId: string, myChannelId: string, voiceMode: boolean) => {
    cleanupPC();

    // Use STUN + TURN for reliable mobile connections (prevents NAT timeout disconnects)
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
        {
          urls: [
            'turn:openrelay.metered.ca:80',
            'turn:openrelay.metered.ca:443',
            'turn:openrelay.metered.ca:443?transport=tcp',
            'turns:openrelay.metered.ca:443?transport=tcp',
          ],
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
      ],
    });
    pcRef.current = pc;

    // ✅ Add local tracks BEFORE any offer/answer exchange
    if (localStreamRef.current) {
      localStreamRef.current.getTracks?.()?.forEach((track: any) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // If voice mode, receive video in case partner sends
    if (voiceMode) {
      try { pc.addTransceiver('video', { direction: 'recvonly' }); } catch (_) {}
    }

    // Remote track handler — build stream from individual tracks (Android sends them one-by-one)
    const remoteStreamRef: any = { stream: null, tracks: [] as any[] };
    pc.ontrack = (event: any) => {
      let stream = event.streams?.[0] ?? event.stream ?? null;

      if (!stream && event.track) {
        remoteStreamRef.tracks.push(event.track);
        try {
          if (MediaStream) stream = new MediaStream(remoteStreamRef.tracks);
        } catch (_) {}
      }

      if (stream) {
        if (Platform.OS === 'web' && !stream.toURL) stream.toURL = () => stream;
        remoteStreamRef.stream = stream;
        if (isMountedRef.current) {
          setRemoteStream(stream);
          updateCallState('connected');
          connectionStartTimeRef.current = Date.now();
        }
      }
    };

    // ICE candidate — send via room_signals
    pc.onicecandidate = (event: any) => {
      if (event.candidate) {
        sendSignal(roomId, myChannelId, 'ice-candidate', event.candidate.toJSON ? event.candidate.toJSON() : event.candidate);
      }
    };

    // Connection state
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('[useVideoChat] connectionState:', state);
      if (state === 'connected') {
        // Clear any pending disconnect timer on recovery
        if (disconnectTimerRef.current) { clearTimeout(disconnectTimerRef.current); disconnectTimerRef.current = null; }
        if (signalIntervalRef.current) { clearInterval(signalIntervalRef.current); signalIntervalRef.current = null; }
        // Fallback if ontrack didn't fire
        if (callStateRef.current !== 'connected' && isMountedRef.current) {
          updateCallState('connected');
          if (!connectionStartTimeRef.current) {
            connectionStartTimeRef.current = Date.now();
          }
        }
        // Keep polling at low frequency after connected — handles keepalives & partner-disconnected signals
        startSignalPolling(roomId, myChannelId, voiceMode);
      } else if (['disconnected', 'failed', 'closed'].includes(state)) {
        // Don't auto-reconnect if the user intentionally stopped
        if (!isStoppingRef.current) {
          // Grace period: wait 7s before giving up — handles brief network flickers
          if (!disconnectTimerRef.current) {
            console.log(`[useVideoChat] connectionState: ${state} — waiting 7s before reconnecting...`);
            disconnectTimerRef.current = setTimeout(() => {
              disconnectTimerRef.current = null;
              if (!isStoppingRef.current && pcRef.current?.connectionState !== 'connected') {
                console.log('[useVideoChat] Grace period expired — reconnecting...');
                handlePartnerLeft(voiceMode);
              }
            }, 7000);
          }
        }
      }
    };

    return pc;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanupPC, sendSignal, updateCallState]);

  // ─── Signal polling ───────────────────────────────────────────────────────────
  const startSignalPolling = useCallback((roomId: string, channelId: string, voiceMode: boolean) => {
    if (signalIntervalRef.current) { clearInterval(signalIntervalRef.current); signalIntervalRef.current = null; }

    // Use slower interval when already connected (keepalive), fast interval during handshake
    const interval = callStateRef.current === 'connected' ? 5000 : 1000;

    signalIntervalRef.current = setInterval(async () => {
      if (!isMountedRef.current) return;
      // After connected, keep polling to catch partner-disconnected and ICE restarts
      if (callStateRef.current !== 'connected' && callStateRef.current !== 'connecting') return;

      try {
        const { data: signals } = await supabase
          .from('room_signals')
          .select('*')
          .eq('room_id', roomId)
          .neq('sender_channel', channelId)
          .order('created_at', { ascending: true });

        if (!signals) return;

        for (const sig of signals) {
          // ✅ Deduplicate by ID — never by timestamp
          if (processedSignalIds.current.has(sig.id)) continue;
          processedSignalIds.current.add(sig.id);

          const pc = pcRef.current;

          if (sig.signal_type === 'voice-mode') {
            if (isMountedRef.current) setPartnerIsVoiceMode(sig.payload?.enabled ?? false);
            continue;
          }

          if (!pc) continue;

          console.log('[useVideoChat] received signal:', sig.signal_type);

          if (sig.signal_type === 'offer') {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await sendSignal(roomId, channelId, 'answer', answer);
            } catch (err) {
              console.warn('[useVideoChat] offer handling error:', err);
            }
          } else if (sig.signal_type === 'answer') {
            if (pc.signalingState === 'have-local-offer') {
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
              } catch (err) {
                console.warn('[useVideoChat] answer handling error:', err);
              }
            }
          } else if (sig.signal_type === 'ice-candidate') {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(sig.payload));
            } catch (err) {
              console.warn('[useVideoChat] ice-candidate error:', err);
            }
          } else if (sig.signal_type === 'partner-disconnected') {
            handlePartnerLeft(voiceMode);
          }
        }
      } catch (err) {
        console.warn('[useVideoChat] startSignalPolling error:', err);
      }
    }, interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendSignal]);

  // ─── Partner topics ───────────────────────────────────────────────────────────
  const fetchPartnerTopics = useCallback(async (partnerId: string) => {
    try {
      const { data } = await supabase
        .from('pinned_topics')
        .select('topics(text)')
        .eq('user_id', partnerId);
      if (data) {
        const texts = data.map((row: any) => row.topics?.text).filter(Boolean) as string[];
        if (isMountedRef.current) setPartnerTopics(texts);
      }
    } catch (_) {}
  }, []);

  // ─── Match polling ────────────────────────────────────────────────────────────
  const startMatchPolling = useCallback((genderPreference: string, voiceMode: boolean) => {
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }

    pollIntervalRef.current = setInterval(async () => {
      if (!isMountedRef.current) return;
      const memberId = memberIdRef.current;
      if (!memberId) return;

      console.log('[useVideoChat] polling with memberId:', memberId);

      try {
        const { data, error } = await supabase.functions.invoke('videocall-match', {
          body: { type: 'poll', memberId },
        });

        if (error) {
          console.log('[useVideoChat] poll error:', JSON.stringify(error));
          return;
        }

        console.log('[useVideoChat] poll raw response:', JSON.stringify(data));

        const room = data?.room;
        if (!room?.id) return;

        // Room found — stop match polling
        if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }

        const roomId = room.id;
        const partnerId = room.member1 === memberId ? room.member2 : room.member1;
        roomIdRef.current = roomId;
        partnerIdRef.current = partnerId;
        setPartnerId(partnerId);
        setPartnerIsVoiceMode(false); // reset on new match
        if (partnerId) fetchPartnerTopics(partnerId);

        if (partnerId) {
          supabase.from('members').select('gender').eq('id', partnerId).maybeSingle().then(({ data: pd }) => {
            if (pd?.gender && isMountedRef.current) setPartnerGender(pd.gender);
          });
        }

        updateCallState('connecting');

        // ✅ POLLER = OFFERER: Create PC, start signaling, then send offer
        const pc = createPeerConnection(roomId, channelIdRef.current, voiceMode);
        startSignalPolling(roomId, channelIdRef.current, voiceMode);

        console.log('[useVideoChat] poller creating offer...');
        const offer = await pc.createOffer({});
        await pc.setLocalDescription(offer);
        await sendSignal(roomId, channelIdRef.current, 'offer', offer);

        // Broadcast our voice mode status to partner
        await sendSignal(roomId, channelIdRef.current, 'voice-mode', { enabled: voiceMode });

      } catch (err) {
        console.warn('[useVideoChat] startMatchPolling error:', err);
      }
    }, 2000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createPeerConnection, startSignalPolling, sendSignal, fetchPartnerTopics, updateCallState]);

  // ─── Join ─────────────────────────────────────────────────────────────────────
  const join = useCallback(async (genderPreference: string, voiceMode: boolean) => {
    const memberId = memberIdRef.current;
    if (!memberId) return;

    genderPrefRef.current = genderPreference;
    isVoiceModeRef.current = voiceMode;

    // Fresh channel ID and signal dedup for this session
    channelIdRef.current = generateUUID();
    processedSignalIds.current.clear();
    sessionIdRef.current = generateUUID();

    updateCallState('waiting');

    // ✅ Acquire local stream BEFORE joining queue
    if (!localStreamRef.current || isVoiceModeRef.current !== voiceMode) {
      await getLocalStream(voiceMode);
    }

    try {
      const { data } = await supabase.functions.invoke('videocall-match', {
        body: {
          type: 'join',
          memberId,
          channelId: channelIdRef.current,
          genderPreference,
          memberGender: profile?.gender || 'Unknown',
          voiceMode,
        },
      });

      if (!isMountedRef.current) return;

      console.log('[useVideoChat] join response:', data?.message);

      if (data?.message === 'partner_found' && data?.roomId) {
        const roomId = data.roomId;
        const partnerId = data.partnerId;
        roomIdRef.current = roomId;
        partnerIdRef.current = partnerId;
        setPartnerId(partnerId);
        if (partnerId) fetchPartnerTopics(partnerId);

        if (partnerId) {
          supabase.from('members').select('gender').eq('id', partnerId).maybeSingle().then(({ data: pd }) => {
            if (pd?.gender && isMountedRef.current) setPartnerGender(pd.gender);
          });
        }

        updateCallState('connecting');

        // ✅ PARTNER_FOUND = ANSWERER: Create PC, start signaling, WAIT for offer from poller
        createPeerConnection(roomId, channelIdRef.current, voiceMode);
        startSignalPolling(roomId, channelIdRef.current, voiceMode);
        console.log('[useVideoChat] partner_found — waiting for offer from poller...');

        // Broadcast our voice mode to the poller
        await sendSignal(roomId, channelIdRef.current, 'voice-mode', { enabled: voiceMode });

      } else if (data?.message === 'added_to_queue') {
        // ✅ ADDED_TO_QUEUE = POLLER: Will create offer when match is found
        console.log('[useVideoChat] added to queue — polling for match...');
        startMatchPolling(genderPreference, voiceMode);

      } else {
        // Fallback: legacy format
        const roomId = data?.room_id || data?.roomId;
        const partnerId = data?.partner_id || data?.partnerId;
        if ((data?.partner_found || data?.status === 'matched') && roomId) {
          roomIdRef.current = roomId;
          partnerIdRef.current = partnerId;
          setPartnerId(partnerId);
          if (partnerId) fetchPartnerTopics(partnerId);
          updateCallState('connecting');
          createPeerConnection(roomId, channelIdRef.current, voiceMode);
          startSignalPolling(roomId, channelIdRef.current, voiceMode);
          // Broadcast our voice mode (legacy path)
          await sendSignal(roomId, channelIdRef.current, 'voice-mode', { enabled: voiceMode });

        } else if (data?.added_to_queue || data?.status === 'added_to_queue') {
          startMatchPolling(genderPreference, voiceMode);
        }
      }
    } catch (err) {
      console.warn('[useVideoChat] join error:', err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.gender, getLocalStream, createPeerConnection, startSignalPolling, startMatchPolling, sendSignal, fetchPartnerTopics, updateCallState]);

  // ─── Handle partner left (seamless reconnect) ────────────────────────────────
  const handlePartnerLeft = useCallback(async (voiceMode?: boolean) => {
    if (autoReconnectingRef.current) return;
    autoReconnectingRef.current = true;

    const gp = genderPrefRef.current;
    const oldRoomId = roomIdRef.current;

    // ✅ Reset UI immediately so the screen responds on the first frame
    partnerIdRef.current = null;
    roomIdRef.current = null;
    connectionStartTimeRef.current = null;
    sessionIdRef.current = generateUUID();
    channelIdRef.current = generateUUID();
    processedSignalIds.current.clear();

    if (isMountedRef.current) {
      setRemoteStream(null);
      setPartnerGender(null);
      setPartnerTopics([]);
      setPartnerId(null);
      updateCallState('waiting');
    }

    // Stop polling & clean up PC
    if (signalIntervalRef.current) { clearInterval(signalIntervalRef.current); signalIntervalRef.current = null; }
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    cleanupPC();

    // 🔥 Run all backend cleanup in parallel (non-blocking relative to join)
    const cleanupPromise = Promise.all([
      flushMinutes(),
      memberIdRef.current
        ? supabase.functions.invoke('videocall-match', {
            body: { type: 'disconnect', memberId: memberIdRef.current },
          }).catch(() => {})
        : Promise.resolve(),
      oldRoomId
        ? (async () => { try { await supabase.from('room_signals').delete().eq('room_id', oldRoomId); } catch (_) {} })()
        : Promise.resolve(),
    ]);

    autoReconnectingRef.current = false;

    // Jump straight back to waiting — no idle
    if (isMountedRef.current) {
      const vm = voiceMode !== undefined ? voiceMode : isVoiceModeRef.current;
      // Start join immediately, let cleanup finish in background
      join(gp, vm);
      await cleanupPromise;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanupPC, flushMinutes, join]);

  // ─── handleNext ───────────────────────────────────────────────────────────────
  const handleNext = useCallback(async (
    genderPreference: string,
    voiceMode: boolean,
  ): Promise<{ penalized: boolean; count: number }> => {
    // handleNext intentionally reconnects — make sure the flag is clear
    isStoppingRef.current = false;
    const connectedDuration = connectionStartTimeRef.current
      ? (Date.now() - connectionStartTimeRef.current) / 1000
      : 999;

    let result = { penalized: false, count: 0 };

    // Use useSkipPenalty for correct threshold (30s), amount (1 min) and param name (amount)
    const penalized = await checkAndApplyPenalty(connectedDuration);
    if (penalized) {
      skipPenaltyCountRef.current += 1;
      setSkipPenaltyCount(skipPenaltyCountRef.current);
      result = { penalized: true, count: skipPenaltyCountRef.current };
      refreshBalance();
    }

    genderPrefRef.current = genderPreference;
    isVoiceModeRef.current = voiceMode;

    await handlePartnerLeft(voiceMode);
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkAndApplyPenalty, handlePartnerLeft, refreshBalance]);

  // ─── handleStop ───────────────────────────────────────────────────────────────
  const handleStop = useCallback(async () => {
    const oldRoomId = roomIdRef.current;

    // Signal intentional stop — prevents onconnectionstatechange from auto-reconnecting
    isStoppingRef.current = true;

    clearAllIntervals();

    // Notify partner
    if (oldRoomId && channelIdRef.current) {
      try {
        await sendSignal(oldRoomId, channelIdRef.current, 'partner-disconnected', {});
      } catch (_) {}
    }

    cleanupPC();

    // Stop local stream
    if (localStreamRef.current) {
      try { localStreamRef.current.getTracks?.()?.forEach((t: any) => t.stop()); } catch (_) {}
      localStreamRef.current = null;
    }

    // Flush partial minutes via useCallMinutes
    await flushMinutes();

    // Backend cleanup
    if (memberIdRef.current) {
      try {
        await supabase.functions.invoke('videocall-match', {
          body: { type: 'disconnect', memberId: memberIdRef.current },
        });
        await supabase.functions.invoke('videocall-match', {
          body: { type: 'leave_queue', memberId: memberIdRef.current },
        });
      } catch (_) {}
    }

    // Delete room signals
    if (oldRoomId) {
      try {
        await supabase.from('room_signals').delete().eq('room_id', oldRoomId);
      } catch (_) {}
    }

    // Reset everything
    roomIdRef.current = null;
    partnerIdRef.current = null;
    setPartnerId(null);
    connectionStartTimeRef.current = null;
    autoReconnectingRef.current = false;
    isStoppingRef.current = false;

    if (isMountedRef.current) {
      setLocalStream(null);
      setRemoteStream(null);
      setPartnerGender(null);
      setPartnerTopics([]);
      updateCallState('idle');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendSignal, cleanupPC, flushMinutes, updateCallState]);

  // ─── startCall (public entry point) ──────────────────────────────────────────
  const startCall = useCallback(async (genderPreference: string, voiceMode: boolean) => {
    genderPrefRef.current = genderPreference;
    isVoiceModeRef.current = voiceMode;
    // Ensure fresh stream
    await getLocalStream(voiceMode);
    await join(genderPreference, voiceMode);
  }, [getLocalStream, join]);

  // ─── Toggle controls ──────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks?.()?.forEach((t: any) => {
        t.enabled = !t.enabled;
      });
    }
    setIsMuted(prev => !prev);
  }, []);

  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks?.()?.forEach((t: any) => {
        t.enabled = !t.enabled;
      });
    }
    setIsCameraOff(prev => !prev);
  }, []);

  const toggleVoiceMode = useCallback(async () => {
    const newVoiceMode = !isVoiceModeRef.current;
    isVoiceModeRef.current = newVoiceMode;
    setIsVoiceMode(newVoiceMode);
    // Re-acquire stream with new constraints
    await getLocalStream(newVoiceMode);
    // Notify partner of voice mode change
    if (roomIdRef.current && channelIdRef.current) {
      await sendSignal(roomIdRef.current, channelIdRef.current, 'voice-mode', { enabled: newVoiceMode });
    }
  }, [getLocalStream, sendSignal]);

  // Restart camera preview (called when screen is focused)
  const restartPreview = useCallback(async () => {
    if (callStateRef.current === 'idle') {
      await getLocalStream(isVoiceModeRef.current);
    }
  }, [getLocalStream]);

  const setShowCapPopup = useCallback((v: boolean) => {
    if (!v) dismissCapPopup();
  }, [dismissCapPopup]);

  // ─── Fetch initial balance via useCallMinutes refreshBalance ──────────────────
  useEffect(() => {
    refreshBalance();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return {
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
    adPoints,
    isFrozen,
    elapsedSeconds,
    partnerGender,
    partnerTopics,
    partnerId,
    minutesLost,
    showPenaltyToast,
    dismissPenaltyToast: dismissToast,
    toggleMute,
    toggleCamera,
    toggleVoiceMode,
    startCall,
    handleNext,
    handleStop,
    setShowCapPopup,
    restartPreview,
  };
}