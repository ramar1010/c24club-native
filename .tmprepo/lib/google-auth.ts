/**
 * Google Sign In via Supabase OAuth (browser-based).
 *
 * Replaces the native @react-native-google-signin flow entirely.
 * Browser OAuth has ZERO nonce involvement — no "nonces mismatch" possible.
 *
 * Flow:
 * 1. supabase.auth.signInWithOAuth() generates an OAuth URL
 * 2. expo-web-browser opens it in a secure in-app browser
 * 3. User signs in with Google
 * 4. Supabase redirects back to c24club://auth/callback with tokens
 * 5. supabase.auth.exchangeCodeForSession() picks up the session
 */

import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { supabase } from "@/lib/supabase";
import { Platform } from "react-native";

// Required for iOS — dismisses the browser when redirect completes
WebBrowser.maybeCompleteAuthSession();

export async function signInWithGoogleOAuth(): Promise<{ error: string | null }> {
  try {
    // Build the redirect URI — must match what's configured in Supabase Google provider
    const redirectUri = AuthSession.makeRedirectUri({
      scheme: "c24club",
      path: "auth/callback",
    });

    console.log("[GoogleOAuth] redirectUri:", redirectUri);

    // Get the OAuth URL from Supabase
    const { data, error: urlError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true, // We open the browser ourselves
      },
    });

    if (urlError || !data?.url) {
      console.error("[GoogleOAuth] Failed to get OAuth URL:", urlError?.message);
      return { error: urlError?.message || "Failed to start Google Sign In" };
    }

    console.log("[GoogleOAuth] Opening browser...");

    // Open browser and wait for redirect
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

    console.log("[GoogleOAuth] Browser result type:", result.type);

    if (result.type !== "success") {
      // User cancelled or browser failed — not an error we show to the user
      return { error: result.type === "cancel" ? "cancelled" : "Google Sign In was dismissed" };
    }

    // Extract the code from the redirect URL and exchange it for a session
    const url = result.url;
    console.log("[GoogleOAuth] Redirect URL received, exchanging for session...");

    // Parse the URL to get the code or tokens
    const urlObj = new URL(url);
    const code = urlObj.searchParams.get("code");
    const accessToken = urlObj.searchParams.get("access_token");
    const refreshToken = urlObj.searchParams.get("refresh_token");

    if (code) {
      // PKCE flow — exchange code for session
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(url);
      if (exchangeError) {
        console.error("[GoogleOAuth] Code exchange error:", exchangeError.message);
        return { error: exchangeError.message };
      }
    } else if (accessToken && refreshToken) {
      // Implicit flow — set session directly
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (sessionError) {
        console.error("[GoogleOAuth] setSession error:", sessionError.message);
        return { error: sessionError.message };
      }
    } else {
      // Try exchangeCodeForSession with the full URL anyway
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(url);
      if (exchangeError) {
        console.error("[GoogleOAuth] Session exchange error:", exchangeError.message);
        return { error: exchangeError.message };
      }
    }

    console.log("[GoogleOAuth] Sign in successful!");
    return { error: null };
  } catch (err: any) {
    console.error("[GoogleOAuth] Unexpected error:", err);
    return { error: err.message || "Google Sign In failed" };
  }
}