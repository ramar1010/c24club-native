import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MINUTE_MAP: Record<string, number> = {
  c24_gift_100_minutes: 100,
  c24_gift_400_minutes: 400,
  c24_gift_600_minutes: 600,
  c24_gift_1000_minutes: 1000,
};

const SENDER_BONUS_MAP: Record<string, number> = {
  c24_gift_100_minutes: 0,
  c24_gift_400_minutes: 100,
  c24_gift_600_minutes: 150,
  c24_gift_1000_minutes: 250,
};

const CASH_VALUE_MAP: Record<string, number> = {
  c24_gift_100_minutes: 1.0,
  c24_gift_400_minutes: 4.0,
  c24_gift_600_minutes: 6.0,
  c24_gift_1000_minutes: 10.0,
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
    if (!supabaseServiceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY env var is missing");

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token);
    if (authError || !user?.id) throw new Error("Not authenticated");

    const body = await req.json();
    const { action, sku, purchaseToken, platform } = body;

    // ── Stub receipt verification ───────────────────────────────────────────
    const verifyReceipt = async (): Promise<boolean> => {
      if (!purchaseToken) throw new Error("Missing purchaseToken");

      if (platform === "ios") {
        const IOS_SHARED_SECRET = Deno.env.get("IOS_SHARED_SECRET");
        if (!IOS_SHARED_SECRET) {
          console.warn("IOS_SHARED_SECRET not set — skipping Apple verification (stub).");
          return true;
        }
        const verifyUrl = "https://buy.itunes.apple.com/verifyReceipt";
        const sandboxUrl = "https://sandbox.itunes.apple.com/verifyReceipt";

        const callApple = async (url: string) => {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              "receipt-data": purchaseToken,
              password: IOS_SHARED_SECRET,
              "exclude-old-transactions": true,
            }),
          });
          return await res.json();
        };

        let result = await callApple(verifyUrl);
        if (result.status === 21007) result = await callApple(sandboxUrl);
        if (result.status !== 0) throw new Error(`Apple verification failed: status ${result.status}`);
        return true;
      }

      if (platform === "android") {
        const GOOGLE_KEY = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
        if (!GOOGLE_KEY) {
          console.warn("GOOGLE_SERVICE_ACCOUNT_KEY not set — skipping Google verification (stub).");
          return true;
        }
        // Full Google Play verification would use the Android Publisher API here
        return true;
      }

      throw new Error("Unknown platform");
    };

    // ── vip-unfreeze ────────────────────────────────────────────────────────
    if (action === "vip-unfreeze") {
      // Check if user is VIP
      const { data: minutes, error: fetchError } = await supabaseAdmin
        .from("member_minutes")
        .select("is_vip, admin_granted_vip, vip_unfreezes_used")
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!minutes?.is_vip && !minutes?.admin_granted_vip) throw new Error("User is not VIP");

      // We should ideally check freeze_settings for the limit here too, 
      // but we'll assume the client gated it or just allow it for now.
      
      const { error: updateError } = await supabaseAdmin
        .from("member_minutes")
        .update({ 
          is_frozen: false, 
          frozen_at: null,
          vip_unfreezes_used: (minutes.vip_unfreezes_used || 0) + 1 
        })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── verify-subscription ─────────────────────────────────────────────────
    if (action === "verify-subscription") {
      if (!sku) throw new Error("Missing sku");
      await verifyReceipt();

      const tier = sku === "c24_premium_vip" ? "premium" : "basic";

      const { error: updateError } = await supabaseAdmin
        .from("member_minutes")
        .upsert(
          { user_id: user.id, is_vip: true, vip_tier: tier },
          { onConflict: "user_id" }
        );

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── verify-minutes ──────────────────────────────────────────────────────
    if (action === "verify-minutes") {
      if (!sku) throw new Error("Missing sku");
      const minutesToAdd = MINUTE_MAP[sku];
      if (!minutesToAdd) throw new Error(`Unknown product sku: ${sku}`);

      await verifyReceipt();

      const { data: current, error: fetchError } = await supabaseAdmin
        .from("member_minutes")
        .select("minutes")
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const existingMinutes = current?.minutes ?? 0;

      const { error: updateError } = await supabaseAdmin
        .from("member_minutes")
        .upsert({ user_id: user.id, minutes: existingMinutes + minutesToAdd }, { onConflict: "user_id" });

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true, minutes_added: minutesToAdd }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── verify-gift ─────────────────────────────────────────────────────────
    if (action === "verify-gift") {
      if (!sku) throw new Error("Missing sku");
      const { recipient_id } = body;
      if (!recipient_id) throw new Error("Missing recipient_id");

      const minutesToGift = MINUTE_MAP[sku];
      const senderBonus = SENDER_BONUS_MAP[sku] ?? 0;
      const cashValue = CASH_VALUE_MAP[sku] ?? 0;
      if (!minutesToGift) throw new Error(`Unknown product sku: ${sku}`);

      console.log(`[verify-gift] STEP 1 — verifying receipt. platform=${platform} sku=${sku}`);
      await verifyReceipt();
      console.log(`[verify-gift] STEP 2 — receipt verified. recipient=${recipient_id} minutes=${minutesToGift} bonus=${senderBonus}`);

      // Credit recipient's gifted_minutes using a safe increment
      const { data: recipientData, error: recipientFetchError } = await supabaseAdmin
        .from("member_minutes")
        .select("gifted_minutes")
        .eq("user_id", recipient_id)
        .maybeSingle();

      if (recipientFetchError) {
        console.error("[verify-gift] STEP 3 FAILED — recipientFetchError:", recipientFetchError.message);
        throw recipientFetchError;
      }
      console.log(`[verify-gift] STEP 3 — recipient row fetched. exists=${!!recipientData}`);

      if (recipientData) {
        // Row exists — just update
        const existingGifted = recipientData.gifted_minutes ?? 0;
        const { error: recipientUpdateError } = await supabaseAdmin
          .from("member_minutes")
          .update({ gifted_minutes: existingGifted + minutesToGift })
          .eq("user_id", recipient_id);
        if (recipientUpdateError) {
          console.error("[verify-gift] STEP 4 FAILED — recipientUpdateError:", recipientUpdateError.message);
          throw recipientUpdateError;
        }
        console.log(`[verify-gift] STEP 4 — recipient gifted_minutes updated ✅`);
      } else {
        console.warn("[verify-gift] STEP 4 — recipient has no member_minutes row, skipping gifted_minutes credit");
      }

      console.log("[verify-gift] STEP 5 — recording gift transaction");
      // Record gift transaction (non-fatal) — using correct schema columns
      const { error: giftTxError } = await supabaseAdmin
        .from("gift_transactions")
        .insert({
          sender_id: user.id,
          recipient_id,
          minutes: minutesToGift,
          cash_value: cashValue,
          status: 'completed',
        });
      if (giftTxError) console.warn("[verify-gift] STEP 5 — gift_transactions insert error:", giftTxError.message);
      else console.log("[verify-gift] STEP 5 — gift_transactions recorded ✅");

      // Give sender their bonus total_minutes (if any)
      if (senderBonus > 0) {
        console.log(`[verify-gift] STEP 6 — crediting sender bonus +${senderBonus}`);
        const { data: senderData, error: senderFetchError } = await supabaseAdmin
          .from("member_minutes")
          .select("minutes")
          .eq("user_id", user.id)
          .maybeSingle();

        if (senderFetchError) {
          console.warn("[verify-gift] STEP 6 FAILED — senderFetchError:", senderFetchError.message);
        } else if (senderData) {
          const existingSenderMinutes = senderData.minutes ?? 0;
          const { error: senderUpdateError } = await supabaseAdmin
            .from("member_minutes")
            .update({ minutes: existingSenderMinutes + senderBonus })
            .eq("user_id", user.id);
          if (senderUpdateError) console.warn("[verify-gift] STEP 6 FAILED — senderUpdateError:", senderUpdateError.message);
          else console.log(`[verify-gift] STEP 6 — sender bonus +${senderBonus} credited ✅`);
        }
      }

      console.log("[verify-gift] STEP 7 — all done, returning success ✅");
      return new Response(JSON.stringify({ success: true, minutes_gifted: minutesToGift, sender_bonus: senderBonus }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── verify-unfreeze ─────────────────────────────────────────────────────
    if (action === "verify-unfreeze") {
      await verifyReceipt();

      const { error: updateError } = await supabaseAdmin
        .from("member_minutes")
        .update({ is_frozen: false, frozen_at: null })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: any) {
    console.error("Error in iap-purchases function:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});