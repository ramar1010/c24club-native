import { supabase } from "./supabase";

export interface CashoutSettings {
  min_cashout_minutes: number;
  max_cashout_minutes: number;
  rate_per_minute: number;
}

export const DEFAULT_SETTINGS: CashoutSettings = {
  min_cashout_minutes: 100,
  max_cashout_minutes: 5000,
  rate_per_minute: 0.02,
};

export const fetchCashoutSettings = async (): Promise<CashoutSettings> => {
  try {
    const { data, error } = await supabase
      .from("cashout_settings")
      .select("*")
      .single();

    if (error) {
      if (error.code === 'PGRST116') return DEFAULT_SETTINGS;
      throw error;
    }
    return data;
  } catch (err) {
    console.error("Error fetching cashout settings:", err);
    return DEFAULT_SETTINGS;
  }
};

export const fetchLuckySpinEarnings = async (userId: string): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from("jackpot_payouts")
      .select("amount")
      .eq("user_id", userId)
      .eq("status", "approved");

    if (error) throw error;
    return (data ?? []).reduce((sum, item) => sum + (item.amount ?? 0), 0);
  } catch (err) {
    console.error("Error fetching lucky spin earnings:", err);
    return 0;
  }
};

export const checkPendingCashout = async (userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from("cashout_requests")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .maybeSingle();

    if (error) throw error;
    return !!data;
  } catch (err) {
    console.error("Error checking pending cashout:", err);
    return false;
  }
};

export const requestCashout = async (minutesAmount: number, paypalEmail: string) => {
  try {
    const { data, error } = await supabase.rpc('request_cashout', {
      p_minutes_amount: minutesAmount,
      p_paypal_email: paypalEmail,
    });

    if (error) throw error;
    if (data && data.success === false) throw new Error(data.error);
    return { success: true };
  } catch (err: any) {
    console.error("Cashout request error:", err);
    return { success: false, error: err.message };
  }
};