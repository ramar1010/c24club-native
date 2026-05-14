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

const IAP_FUNCTION_URL =
  "https://kgottezwtlxgqaizuddp.supabase.co/functions/v1/iap-purchases";

const IAP_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtnb3R0ZXp3dGx4Z3FhaXp1ZGRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxMjM3NjcsImV4cCI6MjA2MTY5OTc2N30.MkJMoI7FPfLOWJhVorEVMlPUgcHWb-uC6hflb8QRbLQ";

/**
 * Invoke the iap-purchases edge function on CatDoes Cloud.
 * Uses the user's active Lovable JWT so the function can authenticate
 * the user against the Lovable Supabase instance.
 */
export const invokeIAP = async (
  body: Record<string, unknown>
): Promise<{ data: any; error: Error | null }> => {
  try {
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