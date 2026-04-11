import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Alert, Linking, Platform, DeviceEventEmitter } from 'react-native';

export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'hangup';

export interface CallInvite {
  id: string;
  inviter_id: string;
  invitee_id: string;
  status: InviteStatus;
  expires_at: string;
  created_at: string;
  // Extra fields that we fetch with join
  inviter?: { name: string; image_url: string; gender: string };
  invitee?: { name: string; image_url: string; gender: string };
}

interface CallContextType {
  activeInvite: CallInvite | null;
  incomingInvite: CallInvite | null;
  startCall: (targetUserId: string, targetGender?: string) => Promise<void>;
  acceptInvite: (inviteId: string) => Promise<void>;
  declineInvite: (inviteId: string) => Promise<void>;
  hangup: () => Promise<void>;
  showVipModal: boolean;
  setShowVipModal: (show: boolean) => void;
}

const CallContext = createContext<CallContextType>({
  activeInvite: null,
  incomingInvite: null,
  startCall: async () => {},
  acceptInvite: async () => {},
  declineInvite: async () => {},
  hangup: async () => {},
  showVipModal: false,
  setShowVipModal: () => {},
});

export function useCall() {
  return useContext(CallContext);
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, minutes, refreshProfile } = useAuth();
  const [activeInvite, setActiveInvite] = useState<CallInvite | null>(null);
  const [incomingInvite, setIncomingInvite] = useState<CallInvite | null>(null);
  const [showVipModal, setShowVipModal] = useState(false);
  const router = useRouter();
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const callerPollingRef = useRef<NodeJS.Timeout | null>(null);

  // ── Handle incoming-call push tap (app was backgrounded) ─────────────────
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('open-incoming-call', async (eventData) => {
      const { inviteId, inviterId, inviterName, inviterImage, expiresAt } = eventData;
      if (!inviteId || incomingInvite || activeInvite) return;

      // Re-fetch the full invite to make sure it's still valid
      try {
        const { data } = await supabase
          .from('direct_call_invites')
          .select('*')
          .eq('id', inviteId)
          .eq('status', 'pending')
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        if (data) {
          setIncomingInvite({
            ...data,
            inviter: {
              name: inviterName || 'User',
              image_url: inviterImage || null,
              gender: null,
            },
          } as any);
        }
      } catch (err) {
        console.warn('[CallContext] open-incoming-call fetch error:', err);
      }
    });

    return () => sub.remove();
  }, [incomingInvite, activeInvite]);

  // Poll for incoming invites
  useEffect(() => {
    if (!user?.id) return;

    const pollIncoming = async () => {
      try {
        const { data, error } = await supabase
          .from('direct_call_invites')
          .select('*')
          .eq('invitee_id', user.id)
          .eq('status', 'pending')
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data && !incomingInvite && !activeInvite) {
          // Separately fetch inviter profile
          const { data: inviterProfile } = await supabase
            .from('members')
            .select('name, image_url, gender')
            .eq('id', data.inviter_id)
            .maybeSingle();

          setIncomingInvite({
            ...data,
            inviter: inviterProfile ?? { name: 'User', image_url: null, gender: null },
          } as any);
        } else if (!data && incomingInvite) {
          setIncomingInvite(null);
        }
      } catch (err) {
        console.error('Error polling incoming invites:', err);
      }
    };

    pollingRef.current = setInterval(pollIncoming, 3000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [user?.id, incomingInvite, activeInvite]);

  // If I'm a caller, poll for acceptance
  useEffect(() => {
    if (!activeInvite || activeInvite.invitee_id === user?.id) return;

    const pollAcceptance = async () => {
      try {
        const { data, error } = await supabase
          .from('direct_call_invites')
          .select('*')
          .eq('id', activeInvite.id)
          .single();

        if (data) {
          if (data.status === 'accepted') {
            // Stop polling immediately and clear activeInvite BEFORE navigating
            // This prevents re-pushing to video-call on subsequent poll ticks
            if (callerPollingRef.current) clearInterval(callerPollingRef.current);
            callerPollingRef.current = null;
            setActiveInvite(null);
            router.push(`/video-call?inviteId=${activeInvite.id}`);
          } else if (data.status === 'declined') {
            if (callerPollingRef.current) clearInterval(callerPollingRef.current);
            callerPollingRef.current = null;
            setActiveInvite(null);
            Alert.alert('Call Declined', 'User declined your call.');
          } else if (data.status === 'expired') {
             if (callerPollingRef.current) clearInterval(callerPollingRef.current);
             callerPollingRef.current = null;
             setActiveInvite(null);
             Alert.alert('No Answer', 'Call was not answered.');
          }
        }
      } catch (err) {
        console.error('Error polling acceptance:', err);
      }
    };

    callerPollingRef.current = setInterval(pollAcceptance, 2000);
    return () => {
      if (callerPollingRef.current) clearInterval(callerPollingRef.current);
    };
  }, [activeInvite, user?.id]);

  const checkVip = useCallback(() => {
    if (minutes?.admin_granted_vip) return true;
    if (minutes?.is_vip) return true;
    return false;
  }, [minutes]);

  const startCall = async (targetUserId: string, targetGender?: string) => {
    if (!user?.id || !profile) return;

    // VIP Gate: Male to Female
    if (profile.gender?.toLowerCase() === 'male' && targetGender?.toLowerCase() === 'female') {
      if (!checkVip()) {
        setShowVipModal(true);
        return;
      }
    }

    try {
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 5);

      // Step 1: Insert the invite (no join — avoids FK/PostgREST join issues)
      const { data: insertedInvite, error } = await supabase
        .from('direct_call_invites')
        .insert({
          inviter_id: user.id,
          invitee_id: targetUserId,
          status: 'pending',
          expires_at: expiresAt.toISOString(),
        })
        .select('*')
        .single();

      if (error) {
        if (error.message.includes('relation "public.direct_call_invites" does not exist')) {
           Alert.alert(
             "Backend Setup Required", 
             "The 'direct_call_invites' table is missing from your Supabase backend. Please run the required SQL migration in your Supabase dashboard to enable direct calling."
           );
           return;
        }
        throw error;
      }

      // Step 2: Separately fetch the invitee profile to enrich the invite object
      const { data: inviteeProfile } = await supabase
        .from('members')
        .select('name, image_url, gender')
        .eq('id', targetUserId)
        .maybeSingle();

      const enrichedInvite = {
        ...insertedInvite,
        invitee: inviteeProfile ?? { name: 'User', image_url: null, gender: null },
      };

      setActiveInvite(enrichedInvite as any);
      
      // ── Fire incoming call push notification ──────────────────────────────
      await supabase.functions.invoke('notify-direct-call', {
        body: { inviteId: insertedInvite.id, action: 'incoming' }
      }).catch(e => console.warn('[CallContext] Incoming push failed:', e));

      // Handle no-answer logic (60 seconds)
      setTimeout(async () => {
         // Check if still pending
         const { data: latest } = await supabase.from('direct_call_invites').select('status').eq('id', insertedInvite.id).single();
         if (latest?.status === 'pending') {
            await supabase.from('direct_call_invites').update({ status: 'expired' }).eq('id', insertedInvite.id);
            await handleMissedCall(enrichedInvite as any);
         }
      }, 60000);

    } catch (err: any) {
      console.error('Error starting call:', err);
      console.error('Error code:', err.code);
      console.error('Error message:', err.message);
      console.error('Error details:', err.details);
      console.error('Error hint:', err.hint);
      Alert.alert('Error', `Failed to initiate call.\n\n${err.message || JSON.stringify(err)}`);
    }
  };

  const handleMissedCall = async (invite: CallInvite) => {
    if (!user?.id) return;
    
    // Auto DM
    try {
      // 1. Check/Create conversation
      let conversationId: string | null = null;
      const { data: convs } = await supabase
        .from('conversations')
        .select('id')
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
        .or(`participant_1.eq.${invite.invitee_id},participant_2.eq.${invite.invitee_id}`);

      // Filter for exact pair
      const existing = convs?.find(c => true); // Simplification, in reality would check participants
      
      if (existing) {
         conversationId = existing.id;
      } else {
         const { data: newConv } = await supabase.from('conversations').insert({
            participant_1: user.id,
            participant_2: invite.invitee_id
         }).select('id').single();
         conversationId = newConv?.id || null;
      }

      if (conversationId) {
         await supabase.from('dm_messages').insert({
            conversation_id: conversationId,
            sender_id: user.id,
            text: `📞 ${profile?.name || 'User'} tried calling you`
         });
      }

      // 2. Push + Email Notifications (parallel)
      await Promise.allSettled([
        supabase.functions.invoke('notify-direct-call', {
          body: { inviteId: invite.id, action: 'missed' }
        }),
        supabase.functions.invoke('missed-call-email', {
          body: { inviteId: invite.id }
        }),
      ]);

    } catch (e) {
      console.warn('Missed call logic failed:', e);
    }
  };

  const acceptInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .from('direct_call_invites')
        .update({ status: 'accepted' })
        .eq('id', inviteId);

      if (error) throw error;
      setIncomingInvite(null);
      DeviceEventEmitter.emit('prepare-direct-call', {});
      router.push(`/video-call?inviteId=${inviteId}`);
    } catch (err: any) {
      console.error('Error accepting invite:', err.message);
      Alert.alert('Error', 'Failed to accept call.');
    }
  };

  const declineInvite = async (inviteId: string) => {
    try {
      await supabase
        .from('direct_call_invites')
        .update({ status: 'declined' })
        .eq('id', inviteId);
      setIncomingInvite(null);

      // Fire missed call notification to the caller
      supabase.functions.invoke('notify-direct-call', {
        body: { inviteId, action: 'missed' }
      }).catch(e => console.warn('[CallContext] decline missed push failed:', e));

    } catch (err: any) {
      console.error('Error declining invite:', err.message);
    }
  };

  const hangup = async () => {
    if (activeInvite) {
      // If still pending (caller hung up before answer) — fire missed call to invitee
      const { data: latest } = await supabase
        .from('direct_call_invites')
        .select('status')
        .eq('id', activeInvite.id)
        .single();

      await supabase.from('direct_call_invites').update({ status: 'hangup' }).eq('id', activeInvite.id);

      if (latest?.status === 'pending') {
        supabase.functions.invoke('notify-direct-call', {
          body: { inviteId: activeInvite.id, action: 'missed' }
        }).catch(e => console.warn('[CallContext] hangup missed push failed:', e));
      }

      setActiveInvite(null);
    }
  };

  return (
    <CallContext.Provider value={{ 
      activeInvite, 
      incomingInvite, 
      startCall, 
      acceptInvite, 
      declineInvite, 
      hangup,
      showVipModal,
      setShowVipModal
    }}>
      {children}
    </CallContext.Provider>
  );
}