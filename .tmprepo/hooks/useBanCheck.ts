import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export interface BanRecord {
  id: string;
  user_id: string;
  ban_type: string;
  reason: string | null;
  is_active: boolean;
  unban_payment_session: string | null;
  unbanned_at: string | null;
  created_at: string;
  updated_at: string;
}

interface UseBanCheckResult {
  isBanned: boolean;
  banData: BanRecord | null;
  banLoading: boolean;
  recheckBan: () => Promise<void>;
  clearBan: () => void;
}

export function useBanCheck(): UseBanCheckResult {
  const { user, session } = useAuth();
  const [isBanned, setIsBanned] = useState(false);
  const [banData, setBanData] = useState<BanRecord | null>(null);
  const [banLoading, setBanLoading] = useState(false);

  const checkBan = useCallback(async () => {
    if (!user?.id || !session) {
      setIsBanned(false);
      setBanData(null);
      return;
    }

    setBanLoading(true);
    try {
      // Always fresh query — never cached
      const { data, error } = await supabase
        .from("user_bans")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn("[useBanCheck] Error querying user_bans:", error.message);
        setIsBanned(false);
        setBanData(null);
        return;
      }

      if (data) {
        setIsBanned(true);
        setBanData(data as BanRecord);
      } else {
        setIsBanned(false);
        setBanData(null);
      }
    } catch (err) {
      console.error("[useBanCheck] Unexpected error:", err);
      setIsBanned(false);
      setBanData(null);
    } finally {
      setBanLoading(false);
    }
  }, [user?.id, session]);

  // Run ban check whenever user/session changes
  useEffect(() => {
    checkBan();
  }, [checkBan]);

  const clearBan = useCallback(() => {
    setIsBanned(false);
    setBanData(null);
  }, []);

  return {
    isBanned,
    banData,
    banLoading,
    recheckBan: checkBan,
    clearBan,
  };
}