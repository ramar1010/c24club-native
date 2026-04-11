/**
 * useWebRTC.ts — Web-compatible WebRTC hook (matches native implementation)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import {
  RTCPeerConnection,
  mediaDevices,
  RTCIceCandidate,
  RTCSessionDescription,
} from '@/lib/webrtc';

// ─── Platform guard ───────────────────────────────────────────────────────────
export const isWebRTCAvailable: boolean = true; // Enabled for web preview

// ─── ICE Servers (matches web app exactly) ───────────────────────────────────
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

// ─── Types ────────────────────────────────────────────────────────────────────
export type CallState = 'idle' | 'waiting' | 'connecting' | 'connected';

interface UseWebRTCOptions {
  memberId: string;
  genderPreference: 'Female' | 'Both' | 'Male';
  memberGender?: string;
}

export interface UseWebRTCResult {
  callState: CallState;
  error: string | null;
  isWebRTCAvailable: boolean;
  currentPartnerId: string | null;
  localStream: any | null;
  remoteStream: any | null;
  startCall: () => Promise<void>;
  next: () => Promise<void>;
  stop: () => Promise<void>;
}

function generateUUID(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── DB Signaling helpers ─────────────────────────────────────────────────────
async function dbSendSignal(roomId: string, senderChannel: string, signalType: string, payload: any) {
  try {
    await supabase.from('room_signals').insert({
      room_id: roomId,
      sender_channel: senderChannel,
      signal_type: signalType,
      payload,
    } as any);
  } catch (e) {
    console.warn('[WebRTC Web] dbSendSignal error:', e);
  }
}

async function cleanupRoomSignals(roomId: string) {
  try {
    await supabase.from('room_signals').delete().eq('room_id', roomId);
  } catch {}
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useWebRTC({ memberId, genderPreference, memberGender }: UseWebRTCOptions): UseWebRTCResult {
  const [callState, setCallState] = useState<CallState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [currentPartnerId, setCurrentPartnerId] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);

  const localStreamRef = useRef<any>(null);
  const pcRef = useRef<any>(null);
  const roomIdRef = useRef<string | null>(null);
  const channelIdRef = useRef<string>(generateUUID());
  const pollIntervalRef = useRef<any>(null);
  const signalPollIntervalRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const autoReconnectingRef = useRef(false);

  const memberIdRef = useRef(memberId);
  const genderPreferenceRef = useRef(genderPreference);
  const memberGenderRef = useRef(memberGender);

  useEffect(() => { memberIdRef.current = memberId; }, [memberId]);
  useEffect(() => { genderPreferenceRef.current = genderPreference; }, [genderPreference]);
  useEffect(() => { memberGenderRef.current = memberGender; }, [memberGender]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const safeSet = useCallback(<T>(setter: (v: T) => void, value: T) => {
    if (isMountedRef.current) setter(value);
  }, []);

  const clearMatchPolling = useCallback(() => {
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
  }, []);

  const clearSignalPolling = useCallback(() => {
    if (signalPollIntervalRef.current) { clearInterval(signalPollIntervalRef.current); signalPollIntervalRef.current = null; }
  }, []);

  const cleanupPC = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.oniceconnectionstatechange = null;
      try { pcRef.current.close(); } catch { /**/ }
      pcRef.current = null;
    }
    safeSet(setRemoteStream, null);
  }, [safeSet]);

  const getLocalStream = useCallback(async (): Promise<any> => {
    if (localStreamRef.current) return localStreamRef.current;
    if (!mediaDevices) throw new Error('mediaDevices not available');
    const stream = await mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: true,
    });
    // In web, add toURL shim to the stream
    if (stream && !stream.toURL) {
      stream.toURL = () => stream;
    }
    localStreamRef.current = stream;
    safeSet(setLocalStream, stream);
    return stream;
  }, [safeSet]);

  const startSignalPolling = useCallback((roomId: string) => {
    clearSignalPolling();
    const processedIds = new Set<string>();

    signalPollIntervalRef.current = setInterval(async () => {
      if (!isMountedRef.current) { clearSignalPolling(); return; }

      try {
        const { data: signals } = await supabase
          .from('room_signals')
          .select('*')
          .eq('room_id', roomId)
          .neq('sender_channel', channelIdRef.current)
          .order('created_at', { ascending: true }) as any;

        if (!signals) return;

        for (const sig of signals) {
          if (processedIds.has(sig.id)) continue;
          processedIds.add(sig.id);

          const pc = pcRef.current;
          if (!pc) continue;

          if (sig.signal_type === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await dbSendSignal(roomId, channelIdRef.current, 'answer', answer);
          } else if (sig.signal_type === 'answer') {
            if (pc.signalingState === 'have-local-offer') {
              await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
            }
          } else if (sig.signal_type === 'ice-candidate') {
            try { await pc.addIceCandidate(new RTCIceCandidate(sig.payload)); } catch { /**/ }
          } else if (sig.signal_type === 'partner-disconnected') {
            handlePartnerLeft();
          }
        }
      } catch (e) {
        console.warn('[WebRTC Web] Signal poll error:', e);
      }
    }, 1000);
  }, [clearSignalPolling]); // eslint-disable-line

  const createPeerConnection = useCallback((roomId: string) => {
    cleanupPC();
    if (!RTCPeerConnection) throw new Error('RTCPeerConnection not available');
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track: any) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.ontrack = (event: any) => {
      const stream = event.streams?.[0];
      if (stream) {
        // In web, add toURL shim to the remote stream too
        if (!stream.toURL) {
          stream.toURL = () => stream;
        }
        safeSet(setRemoteStream, stream);
        safeSet(setCallState, 'connected');
      }
    };

    pc.onicecandidate = (event: any) => {
      if (!event.candidate || !roomIdRef.current) return;
      const candidateJson = event.candidate.toJSON ? event.candidate.toJSON() : event.candidate;
      dbSendSignal(roomIdRef.current, channelIdRef.current, 'ice-candidate', candidateJson).catch(() => {});
    };

    const onStateChange = () => {
      const state = pc.connectionState || pc.iceConnectionState;
      if (state === 'connected' || state === 'completed') {
        clearSignalPolling();
        safeSet(setCallState, 'connected');
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        handlePartnerLeft();
      }
    };

    pc.onconnectionstatechange = onStateChange;
    pc.oniceconnectionstatechange = onStateChange;

    return pc;
  }, [cleanupPC, safeSet, clearSignalPolling]); // eslint-disable-line

  const handlePartnerLeft = useCallback(async () => {
    if (autoReconnectingRef.current) return;
    autoReconnectingRef.current = true;

    const oldRoomId = roomIdRef.current;
    clearMatchPolling();
    clearSignalPolling();
    cleanupPC();

    if (oldRoomId) cleanupRoomSignals(oldRoomId);

    await supabase.functions.invoke('videocall-match', {
      body: { type: 'disconnect', memberId: memberIdRef.current },
    }).catch(() => {});

    roomIdRef.current = null;
    safeSet(setCurrentPartnerId, null);
    channelIdRef.current = generateUUID();
    safeSet(setCallState, 'waiting');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('videocall-match', {
        body: {
          type: 'join',
          memberId: memberIdRef.current,
          channelId: channelIdRef.current,
          genderPreference: genderPreferenceRef.current,
          memberGender: memberGenderRef.current,
        },
      });

      if (fnError) throw fnError;

      if (data?.message === 'partner_found') {
        roomIdRef.current = data.roomId;
        safeSet(setCurrentPartnerId, data.partnerId);
        safeSet(setCallState, 'connecting');
        createPeerConnection(data.roomId);
        startSignalPolling(data.roomId);
      } else if (data?.message === 'added_to_queue') {
        pollForMatch();
      }
    } catch {
      safeSet(setCallState, 'idle');
    } finally {
      autoReconnectingRef.current = false;
    }
  }, [clearMatchPolling, clearSignalPolling, cleanupPC, safeSet, createPeerConnection, startSignalPolling]); // eslint-disable-line

  const pollForMatch = useCallback(() => {
    clearMatchPolling();

    pollIntervalRef.current = setInterval(async () => {
      if (!isMountedRef.current) { clearMatchPolling(); return; }

      try {
        const { data } = await supabase.functions.invoke('videocall-match', {
          body: { type: 'poll', memberId: memberIdRef.current },
        });

        if (!data?.room) return;

        const room = data.room;
        clearMatchPolling();

        roomIdRef.current = room.id;
        const pid = room.member1 === memberIdRef.current ? room.member2 : room.member1;
        safeSet(setCurrentPartnerId, pid);
        safeSet(setCallState, 'connecting');

        const pc = createPeerConnection(room.id);
        startSignalPolling(room.id);

        const offer = await pc.createOffer({});
        await pc.setLocalDescription(offer);
        await dbSendSignal(room.id, channelIdRef.current, 'offer', offer);

      } catch (e) {
        console.error('[WebRTC Web] poll error:', e);
      }
    }, 2000);
  }, [clearMatchPolling, safeSet, createPeerConnection, startSignalPolling]);

  const startCall = useCallback(async () => {
    try {
      safeSet(setError, null);
      safeSet(setCallState, 'waiting');
      channelIdRef.current = generateUUID();

      await getLocalStream();

      const { data, error: fnError } = await supabase.functions.invoke('videocall-match', {
        body: {
          type: 'join',
          memberId: memberIdRef.current,
          channelId: channelIdRef.current,
          genderPreference: genderPreferenceRef.current,
          memberGender: memberGenderRef.current,
        },
      });

      if (fnError) throw fnError;

      if (data?.message === 'partner_found') {
        roomIdRef.current = data.roomId;
        safeSet(setCurrentPartnerId, data.partnerId);
        safeSet(setCallState, 'connecting');
        createPeerConnection(data.roomId);
        startSignalPolling(data.roomId);
      } else if (data?.message === 'added_to_queue') {
        pollForMatch();
      }
    } catch (e: any) {
      console.error('[WebRTC Web] startCall error:', e);
      safeSet(setError, e?.message ?? 'Failed to start call');
      safeSet(setCallState, 'idle');
    }
  }, [safeSet, getLocalStream, createPeerConnection, startSignalPolling, pollForMatch]);

  const stop = useCallback(async () => {
    const rid = roomIdRef.current;
    if (rid) {
      dbSendSignal(rid, channelIdRef.current, 'partner-disconnected', {}).catch(() => {});
    }
    clearMatchPolling();
    clearSignalPolling();
    cleanupPC();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t: any) => t.stop());
      localStreamRef.current = null;
      safeSet(setLocalStream, null);
    }
    await supabase.functions.invoke('videocall-match', {
      body: { type: 'disconnect', memberId: memberIdRef.current },
    }).catch(() => {});
    if (rid) cleanupRoomSignals(rid);
    await supabase.functions.invoke('videocall-match', {
      body: { type: 'leave_queue', memberId: memberIdRef.current },
    }).catch(() => {});
    roomIdRef.current = null;
    safeSet(setCurrentPartnerId, null);
    safeSet(setCallState, 'idle');
    safeSet(setError, null);
  }, [clearMatchPolling, clearSignalPolling, cleanupPC, safeSet]);

  const next = useCallback(async () => {
    const rid = roomIdRef.current;
    if (rid) {
      dbSendSignal(rid, channelIdRef.current, 'partner-disconnected', {}).catch(() => {});
    }
    clearMatchPolling();
    clearSignalPolling();
    cleanupPC();
    await supabase.functions.invoke('videocall-match', {
      body: { type: 'disconnect', memberId: memberIdRef.current },
    }).catch(() => {});
    if (rid) cleanupRoomSignals(rid);
    roomIdRef.current = null;
    safeSet(setCurrentPartnerId, null);
    channelIdRef.current = generateUUID();
    safeSet(setCallState, 'waiting');
    await startCall();
  }, [clearMatchPolling, clearSignalPolling, cleanupPC, safeSet, startCall]);

  useEffect(() => {
    return () => {
      clearMatchPolling();
      clearSignalPolling();
      cleanupPC();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t: any) => t.stop());
        localStreamRef.current = null;
      }
    };
  }, []); // eslint-disable-line

  return { callState, error, isWebRTCAvailable, currentPartnerId, localStream, remoteStream, startCall, next, stop };
}