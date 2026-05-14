/**
 * Google Sign In helper that bypasses the Supabase JS client's client-side
 * nonce check. The check runs BEFORE the request reaches the server, so
 * server-side skip_nonce_check cannot help.
 *
 * Google Sign In v16 embeds a random nonce in the ID token but gives us no
 * way to know the raw value. The Supabase client refuses to proceed unless we
 * pass the correct raw nonce. We work around this by calling the Supabase
 * /auth/v1/token REST endpoint directly and then setting the session manually.
 */

import { supabase } from "@/lib/supabase";

const SUPABASE_URL = "https://ncpbiymnafxdfsvpxirb.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA";

export async function signInWithGoogleIdToken(idToken: string): Promise<{ error: string | null }> {
  try {
    // Call the REST API directly — no client-side nonce check here
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
          gotrue_meta_security: {},
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("[GoogleAuth] REST error:", data);
      return { error: data.error_description || data.msg || "Google Sign In failed" };
    }

    // Manually set the session so the Supabase client picks it up
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });

    if (sessionError) {
      console.error("[GoogleAuth] setSession error:", sessionError.message);
      return { error: sessionError.message };
    }

    return { error: null };
  } catch (err: any) {
    console.error("[GoogleAuth] Unexpected error:", err);
    return { error: err.message || "Google Sign In failed" };
  }
}