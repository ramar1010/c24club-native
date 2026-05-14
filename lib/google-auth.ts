/**
 * Google Sign In helper that bypasses the Supabase JS client's client-side
 * nonce check. The check runs BEFORE the request reaches the server, so
 * server-side skip_nonce_check cannot help when using signInWithIdToken().
 *
 * We call the Supabase REST API directly instead. skip_nonce_check is ON
 * on this project so the server will accept the token without any nonce.
 */

import { supabase } from "@/lib/supabase";

const SUPABASE_URL = "https://ncpbiymnafxdfsvpxirb.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA";

export async function signInWithGoogleIdToken(idToken: string): Promise<{ error: string | null }> {
  try {
    console.log("[GoogleAuth] Calling Supabase REST API directly (skip_nonce_check=ON)...");

    // Call the REST API directly — no nonce sent at all.
    // skip_nonce_check is enabled on this Supabase project so the server
    // accepts the token even though Google v16 embeds a nonce in it.
    const response = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=id_token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          provider: "google",
          id_token: idToken,
          // No nonce — skip_nonce_check=true means the server ignores nonce entirely
        }),
      }
    );

    const data = await response.json();
    console.log("[GoogleAuth] REST response status:", response.status);

    if (!response.ok) {
      console.error("[GoogleAuth] REST error:", JSON.stringify(data));
      return { error: data.error_description || data.msg || data.error || "Google Sign In failed" };
    }

    // Manually set the session so the Supabase JS client picks it up
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });

    if (sessionError) {
      console.error("[GoogleAuth] setSession error:", sessionError.message);
      return { error: sessionError.message };
    }

    console.log("[GoogleAuth] Sign in successful!");
    return { error: null };
  } catch (err: any) {
    console.error("[GoogleAuth] Unexpected error:", err);
    return { error: err.message || "Google Sign In failed" };
  }
}