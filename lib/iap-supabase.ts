/**
 * IAP verification helper — calls the iap-purchases edge function on
 * CatDoes Cloud using the user's current Lovable Supabase JWT.
 *
 * Problem: iapSupabase client would have its own separate session storage,
 * so it would never have the user's token. Instead, we grab the active
 * session from the main Lovable supabase client and pass it explicitly
 * via fetch to the CatDoes Cloud function URL.
 */
import { supabase } from "@/lib/supabase";
import Constants from "expo-constants";

const IAP_FUNCTION_URL =
  "https://ncpbiymnafxdfsvpxirb.supabase.co/functions/v1/iap-purchases";

const IAP_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA";

/**
 * Bounty webhook endpoints live on the Lovable (C24 Club) Supabase instance.
 * They verify the IAP receipt, upgrade VIP status, and award referral bounties
 * for male subscribers. They authenticate via the user's Lovable JWT.
 */
const APPLE_BOUNTY_URL =
  "https://ncpbiymnafxdfsvpxirb.supabase.co/functions/v1/apple-bounty-webhook";

const GOOGLE_BOUNTY_URL =
  "https://ncpbiymnafxdfsvpxirb.supabase.co/functions/v1/google-bounty-webhook";

// Anon key for the Lovable (C24 Club) Supabase instance — required as the
// `apikey` header when calling its edge functions.
const LOVABLE_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA";

const readNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeEpochValue = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
      const numeric = Number(trimmed);
      return Number.isFinite(numeric) ? numeric : null;
    }

    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }

  return null;
};

export const normalizeSubscriptionEnd = (value: unknown): string | null => {
  const epoch = normalizeEpochValue(value);
  if (epoch == null) return null;

  const millis = epoch < 1e11 ? epoch * 1000 : epoch;
  const date = new Date(millis);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const getIAPOriginalTransactionId = (
  purchase: Record<string, unknown> | null | undefined
): string | null => {
  if (!purchase) return null;

  const candidates = [
    purchase["original_transaction_id"],
    purchase["originalTransactionId"],
    purchase["originalTransactionIdentifierIOS"],
    purchase["originalTransactionIdentifier"],
  ];

  for (const candidate of candidates) {
    const normalized = readNonEmptyString(candidate);
    if (normalized) return normalized;
  }

  return null;
};

export const getIAPSubscriptionEnd = (
  purchase: Record<string, unknown> | null | undefined
): string | null => {
  if (!purchase) return null;

  const candidates = [
    purchase["subscription_end"],
    purchase["p_subscription_end"],
    purchase["subscriptionEnd"],
    purchase["subscriptionEndIOS"],
    purchase["subscriptionExpirationDate"],
    purchase["subscriptionExpirationDateIOS"],
    purchase["expirationDateIOS"],
    purchase["expirationDate"],
    purchase["expiresAt"],
    purchase["expires_at"],
  ];

  for (const candidate of candidates) {
    const normalized = normalizeSubscriptionEnd(candidate);
    if (normalized) return normalized;
  }

  return null;
};

/**
 * Invoke the iap-purchases edge function on CatDoes Cloud.
 * Uses the user's active Lovable JWT so the function can authenticate
 * the user against the Lovable Supabase instance.
 */
export const invokeIAP = async (
  body: Record<string, unknown>
): Promise<{ data: any; error: Error | null }> => {
  try {
    if (!IAP_SUPABASE_ANON_KEY) {
      return {
        data: null,
        error: new Error("Missing EXPO_PUBLIC_SUPABASE_ANON_KEY for CatDoes IAP requests"),
      };
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const authToken = session?.access_token ?? IAP_SUPABASE_ANON_KEY;

    const response = await fetch(IAP_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
        apikey: IAP_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return { data: null, error: new Error(data?.error ?? `HTTP ${response.status}`) };
    }

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: new Error(err?.message ?? "Network error calling iap-purchases") };
  }
};

/**
 * Invoke the platform-specific Bounty webhook on the Lovable (C24 Club)
 * Supabase instance to verify a subscription receipt, upgrade VIP status,
 * and award referral bounties for male subscribers.
 *
 * Uses the same auth pattern as invokeIAP: the user's active Lovable JWT is
 * sent as the Bearer token so the function can authenticate the user.
 *
 * @param platform - "ios" (Apple) or "android" (Google); other values default to Apple.
 * @param body - request payload, must include `sku` and `purchaseToken`.
 */
export const invokeBountyWebhook = async (
  platform: string,
  body: Record<string, unknown>
): Promise<{ data: any; error: Error | null }> => {
  const url = platform === "android" ? GOOGLE_BOUNTY_URL : APPLE_BOUNTY_URL;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const authToken = session?.access_token ?? LOVABLE_SUPABASE_ANON_KEY;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
        apikey: LOVABLE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return { data: null, error: new Error(data?.error ?? `HTTP ${response.status}`) };
    }

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: new Error(err?.message ?? "Network error calling bounty webhook") };
  }
};