import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const readNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeSubscriptionEnd = (value: unknown): string | null => {
  if (value == null || value === "") return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
      const numeric = Number(trimmed);
      if (!Number.isFinite(numeric)) return null;
      const millis = numeric < 1e11 ? numeric * 1000 : numeric;
      return new Date(millis).toISOString();
    }

    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const millis = value < 1e11 ? value * 1000 : value;
    return new Date(millis).toISOString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("LOVABLE_SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("LOVABLE_SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("LOVABLE_SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const token = authHeader.replace("Bearer ", "");

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user?.id) throw new Error("Not authenticated");

    const body = await req.json();
    const {
      purchaseToken,
      transactionId,
      sku,
      isRenewal = false,
      original_transaction_id,
      originalTransactionId,
      subscription_end,
      p_subscription_end,
    } = body;

    if (!sku) throw new Error("Missing sku");
    if (!purchaseToken) throw new Error("Missing purchaseToken");
    const resolvedTransactionId = readNonEmptyString(transactionId) ?? readNonEmptyString(purchaseToken);
    if (!resolvedTransactionId) throw new Error("Missing transactionId");

    const resolvedOriginalTransactionId =
      readNonEmptyString(original_transaction_id) ?? readNonEmptyString(originalTransactionId);
    const resolvedSubscriptionEnd = normalizeSubscriptionEnd(subscription_end ?? p_subscription_end);

    console.log(`[apple-bounty-webhook] user=${user.id} sku=${sku} purchaseToken=${purchaseToken} transactionId=${resolvedTransactionId} originalTransactionId=${resolvedOriginalTransactionId ?? "n/a"}`);

    // StoreKit 2 is verified on-device. Trust and proceed.
    const tier = (sku.toLowerCase() === "c24_premium_vip" || sku.toLowerCase() === "premiumvip") ? "premium" : "basic";

    // Upgrade user's VIP status
    // 1. Insert into iap_purchases for logging and idempotency
    const idempotencyKey = `iap:apple:${resolvedTransactionId}:${resolvedOriginalTransactionId ?? "none"}`;
    const iapPayload: Record<string, unknown> = {
      user_id: user.id,
      platform: "ios",
      sku,
      action: isRenewal ? "renew" : "subscribe",
      vip_tier: tier,
      purchase_token_hash: idempotencyKey,
    };

    if (resolvedOriginalTransactionId) {
      iapPayload.original_transaction_id = resolvedOriginalTransactionId;
    }

    if (resolvedSubscriptionEnd) {
      iapPayload.subscription_end = resolvedSubscriptionEnd;
    }
    
    const { error: iapError } = await supabaseAdmin.from("iap_purchases").upsert(iapPayload, { onConflict: "purchase_token_hash" });
    
    if (iapError) {
      console.warn("[apple-bounty-webhook] Error inserting into iap_purchases:", iapError);
      // Continue anyway, but this is a red flag
    }

    // 2. Upgrade user's VIP status
    const memberMinutesUpdate: Record<string, unknown> = {
      is_vip: true,
      vip_tier: tier,
    };

    if (resolvedSubscriptionEnd) {
      memberMinutesUpdate.subscription_end = resolvedSubscriptionEnd;
    }

    const { error: upsertError } = await supabaseAdmin.from("member_minutes").update(memberMinutesUpdate).eq("user_id", user.id);

    if (upsertError) {
      console.error("[apple-bounty-webhook] Error updating member_minutes:", upsertError);
      throw upsertError;
    }

    let memberMinutes: Record<string, unknown> | null = null;
    try {
      const { data: refreshedMinutes, error: refreshError } = await supabaseAdmin
        .from("member_minutes")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (refreshError) {
        console.warn("[apple-bounty-webhook] Failed to fetch updated member_minutes:", refreshError);
      } else {
        memberMinutes = refreshedMinutes ?? null;
      }
    } catch (refreshError) {
      console.warn("[apple-bounty-webhook] Failed to read updated member_minutes:", refreshError);
    }

    // 3. Award bounty before responding so the function does not terminate early.
    let bountyAwarded = false;
    try {
      const { data: member } = await supabaseAdmin
        .from("members")
        .select("gender")
        .eq("id", user.id)
        .maybeSingle();

      if (member?.gender?.toLowerCase() === "male") {
        console.log(`[apple-bounty-webhook] User is male. Invoking bounty RPC...`);
        const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc("award_bounty_for_subscription", {
          p_male_id: user.id,
          p_tier: tier,
          p_stripe_subscription_id: idempotencyKey,
          p_is_renewal: isRenewal,
        });

        if (rpcError) {
          console.warn("[apple-bounty-webhook] award_bounty_for_subscription returned error:", rpcError);
        } else {
          const result = rpcResult as { 
            success: boolean, 
            female_id: string, 
            male_id: string, 
            amount_minutes: number, 
            source: string, 
            streak_awarded: boolean, 
            streak_amount: number 
          };
          bountyAwarded = result?.success === true;
          console.log("[apple-bounty-webhook] award_bounty_for_subscription result:", rpcResult);

          if (bountyAwarded) {
            console.log(`[apple-bounty-webhook] Triggering bounty notification for female: ${result.female_id}`);
            const { data: notifyData, error: notifyError } = await supabaseAdmin.functions.invoke("notify-bounty", {
              body: {
                female_id: result.female_id,
                male_id: result.male_id,
                amount_minutes: result.amount_minutes,
                source: result.source,
                streak_awarded: result.streak_awarded,
                streak_amount: result.streak_amount,
              },
            });
            if (notifyError) {
              console.error("[apple-bounty-webhook] Failed to trigger notify-bounty:", notifyError);
            } else {
              console.log("[apple-bounty-webhook] notify-bounty triggered successfully:", notifyData);
            }
          }
        }
      } else {
        console.log(`[apple-bounty-webhook] User gender is not male (${member?.gender}), skipping bounty award.`);
      }
    } catch (bountyError) {
      console.error("[apple-bounty-webhook] Failed to run bounty attribution:", bountyError);
    }

    return new Response(JSON.stringify({ success: true, tier, member_minutes: memberMinutes, bountyAwarded }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[apple-bounty-webhook] error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});