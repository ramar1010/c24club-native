import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl) throw new Error("SUPABASE_URL env var is missing");

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user?.id) throw new Error("Not authenticated");

    const body = await req.json();
    const { action, purchaseToken, platform, session_id } = body;

    const isTestMode = Deno.env.get("STRIPE_TEST_MODE") === "true";
    const stripeKey = isTestMode ? Deno.env.get("STRIPE_KEY_TEST") : Deno.env.get("STRIPE_KEY_LIVE");

    // Existing Stripe Actions (Implemented based on AGENTS.md requirements)
    if (action === "create-checkout") {
      if (!stripeKey) throw new Error("Stripe key not configured");
      
      const params: Record<string, string> = {
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][product_data][name]": "Ban Appeal Processing Fee",
        "line_items[0][price_data][unit_amount]": "1000",
        "line_items[0][quantity]": "1",
        "mode": "payment",
        "success_url": `https://c24club.com/unban?status=success&session_id={CHECKOUT_SESSION_ID}`,
        "cancel_url": `https://c24club.com/unban?status=canceled`,
        "metadata[user_id]": user.id,
        "metadata[action]": "unban",
      };

      const sessionRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: Object.entries(params)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join("&"),
      });
      const session = await sessionRes.json();
      if (!sessionRes.ok) throw new Error(session?.error?.message || "Stripe session error");

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify-payment") {
      if (!stripeKey) throw new Error("Stripe key not configured");
      if (!session_id) throw new Error("No session ID");

      const sessionRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, {
        headers: { Authorization: `Bearer ${stripeKey}` },
      });
      const session = await sessionRes.json();
      if (!sessionRes.ok) throw new Error(session?.error?.message || "Stripe session error");

      if (session.payment_status === "paid" && session.metadata?.action === "unban") {
        const userIdFromMetadata = session.metadata.user_id;
        if (userIdFromMetadata !== user.id) throw new Error("User mismatch");

        // Update user_bans: set is_active = false, unbanned_at = now()
        const { error: updateError } = await supabaseAdmin
          .from("user_bans")
          .update({
            is_active: false,
            unbanned_at: new Date().toISOString(),
            unban_payment_session: session_id,
          })
          .eq("user_id", user.id)
          .eq("is_active", true);

        if (updateError) throw updateError;

        return new Response(JSON.stringify({ success: true, unbanned: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        return new Response(JSON.stringify({ success: false, reason: "not_paid" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // New IAP Action
    if (action === "verify-iap") {
      if (!purchaseToken) throw new Error("Missing purchaseToken");
      if (!platform) throw new Error("Missing platform");

      let verified = false;
      const GOOGLE_SERVICE_ACCOUNT_KEY = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
      const IOS_SHARED_SECRET = Deno.env.get("IOS_SHARED_SECRET");

      if (platform === "android") {
        // Handle Google Play verification
        if (!GOOGLE_SERVICE_ACCOUNT_KEY) {
          console.warn("GOOGLE_SERVICE_ACCOUNT_KEY not set. Skipping server-side verification (stub).");
          verified = !!purchaseToken; // Trust the token exists for now
        } else {
          // Stub for Google Play Developer API verification
          // In a real implementation, we would use the service account to get an access token
          // and then call the Android Publisher API.
          verified = !!purchaseToken;
        }
      } else if (platform === "ios") {
        // Handle Apple App Store verification
        if (!IOS_SHARED_SECRET) {
          console.warn("IOS_SHARED_SECRET not set. Skipping server-side verification (stub).");
          verified = !!purchaseToken; // Trust the receipt exists for now
        } else {
          const verifyUrl = "https://buy.itunes.apple.com/verifyReceipt";
          const sandboxUrl = "https://sandbox.itunes.apple.com/verifyReceipt";

          const verifyReceipt = async (url: string) => {
            const res = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                "receipt-data": purchaseToken,
                "password": IOS_SHARED_SECRET,
                "exclude-old-transactions": true,
              }),
            });
            return await res.json();
          };

          let result = await verifyReceipt(verifyUrl);

          // Auto-retry on sandbox if production returns status 21007
          if (result.status === 21007) {
            result = await verifyReceipt(sandboxUrl);
          }

          if (result.status === 0) {
            verified = true;
          } else {
            throw new Error(`Apple verification failed with status: ${result.status}`);
          }
        }
      }

      if (verified) {
        // Update user_bans: set is_active = false, unbanned_at = now()
        const { error: updateError } = await supabaseAdmin
          .from("user_bans")
          .update({
            is_active: false,
            unbanned_at: new Date().toISOString(),
            unban_payment_session: purchaseToken,
          })
          .eq("user_id", user.id)
          .eq("is_active", true);

        if (updateError) throw updateError;

        return new Response(JSON.stringify({ success: true, unbanned: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        return new Response(JSON.stringify({ success: false, error: "Verification failed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    throw new Error("Invalid action");
  } catch (error) {
    console.error("Error in unban-payment function:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});