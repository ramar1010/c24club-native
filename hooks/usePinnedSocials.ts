import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface UsePinnedSocialsResult {
  socials: string[]; // ["platform:username", ...]
  loading: boolean;
}

export function usePinnedSocials(
  partnerId: string | null,
  isConnected: boolean,
): UsePinnedSocialsResult {
  const [socials, setSocials] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log('[PinnedSocials] effect triggered — partnerId:', partnerId, 'isConnected:', isConnected);

    if (!partnerId || !isConnected) {
      setSocials([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const fetchSocials = async () => {
      try {
        // ── Attempt 1: Dedicated RPC ───────────────────────────────────────
        console.log('[PinnedSocials] trying get_partner_pinned_socials RPC with partnerId:', partnerId);
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          'get_partner_pinned_socials',
          { p_partner_id: partnerId },
        );

        console.log('[PinnedSocials] RPC result — data:', JSON.stringify(rpcData), 'error:', rpcError?.message, 'code:', rpcError?.code);

        if (cancelled) return;

        if (!rpcError) {
          const result = Array.isArray(rpcData) && rpcData.length > 0 ? rpcData : [];
          console.log('[PinnedSocials] RPC success, socials:', JSON.stringify(result));
          setSocials(result);
          return;
        }

        const isNotFound =
          rpcError.code === 'PGRST202' ||
          rpcError.message?.includes('does not exist') ||
          rpcError.message?.includes('Could not find');

        console.log('[PinnedSocials] RPC failed, isNotFound:', isNotFound);

        if (!isNotFound) {
          console.warn('[usePinnedSocials] RPC error (non-404):', rpcError.message);
          setSocials([]);
          return;
        }

        // ── Attempt 2: get_vip_user_ids + vip_settings ────────────────────
        console.log('[PinnedSocials] falling back to get_vip_user_ids + vip_settings');

        const [vipRes, settingsRes] = await Promise.all([
          supabase.rpc('get_vip_user_ids'),
          supabase
            .from('vip_settings')
            .select('pinned_socials')
            .eq('user_id', partnerId)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        console.log('[PinnedSocials] get_vip_user_ids — error:', vipRes.error?.message, 'count:', Array.isArray(vipRes.data) ? vipRes.data.length : 'n/a', 'includes partnerId:', Array.isArray(vipRes.data) ? vipRes.data.includes(partnerId) : false);
        console.log('[PinnedSocials] vip_settings — error:', settingsRes.error?.message, 'data:', JSON.stringify(settingsRes.data));

        const vipIds: string[] = Array.isArray(vipRes.data) ? vipRes.data : [];
        const isVip = vipIds.includes(partnerId);

        console.log('[PinnedSocials] isVip:', isVip, 'partnerId in vipIds:', isVip);

        if (!isVip) {
          console.log('[PinnedSocials] partner is not VIP, clearing socials');
          setSocials([]);
          return;
        }

        const pinnedSocials = settingsRes.data?.pinned_socials;
        const result = Array.isArray(pinnedSocials) && pinnedSocials.length > 0 ? pinnedSocials : [];
        console.log('[PinnedSocials] final socials:', JSON.stringify(result));
        setSocials(result);
      } catch (err) {
        console.warn('[usePinnedSocials] Unexpected error:', err);
        if (!cancelled) setSocials([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchSocials();

    return () => {
      cancelled = true;
    };
  }, [partnerId, isConnected]);

  return { socials, loading };
}