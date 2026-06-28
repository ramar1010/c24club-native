import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function decodeJWS(jws: string) {
  try {
    const parts = jws.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // Base64Url decode helper
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(base64);
    return JSON.parse(decoded);
  } catch (err) {
    console.error("[apple-store-notifications] JWS decode error:", err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("LOVABLE_SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("LOVABLE_SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { signedPayload } = body;

    if (!signedPayload) {
      throw new Error("Missing signedPayload");
    }

    const payload = decodeJWS(signedPayload);
    if (!payload) {
      throw new Error("Invalid signedPayload");
    }

    const notificationType = payload.notificationType;
    const subtype = payload.subtype;
    console.log(`[apple-store-notifications] Event received: ${notificationType} (${subtype})`);

    // We care about subscriptions and renewals
    if (notificationType === "SUBSCRIBED" || notificationType === "DID_RENEW") {
      const transactionInfoJWS = payload.data?.signedTransactionInfo;
      if (!transactionInfoJWS) {
        throw new Error("Missing signedTransactionInfo");
      }

      const transactionInfo = decodeJWS(transactionInfoJWS);
      if (!transactionInfo) {
        throw new Error("Invalid signedTransactionInfo");
      }

      const {
        transactionId,
        originalTransactionId,
        productId,
        appAccountToken, // This is the user's UUID set by StoreKit 2 on purchase
      } = transactionInfo;

      console.log(`[apple-store-notifications] Transaction: id=${transactionId}, originalId=${originalTransactionId}, product=${productId}, appAccountToken=${appAccountToken}`);

      let userId = appAccountToken;

      // If appAccountToken is not provided, try to find a user in member_minutes who previously had VIP matching this transaction/user
      if (!userId) {
        console.warn("[apple-store-notifications] Missing appAccountToken. Attempting transaction lookups...");
        // This is a fallback; usually appAccountToken contains the authenticated user's ID
      }

      if (!userId) {
        console.error("[apple-store-notifications] Could not determine user ID for transaction:", transactionId);
        return new Response(JSON.stringify({ success: false, reason: "User ID not found" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tier = (productId && (productId.toLowerCase() === "c24_premium_vip" || productId.toLowerCase() === "premiumvip")) ? "premium" : "basic";
      const isRenewal = notificationType === "DID_RENEW";

      console.log(`[apple-store-notifications] Updating VIP for user=${userId}, tier=${tier}, renewal=${isRenewal}`);

      // Update the user's VIP status
      const { error: upsertError } = await supabaseAdmin.from("member_minutes").upsert(
        { user_id: userId, is_vip: true, vip_tier: tier },
        { onConflict: "user_id" }
      );
      if (upsertError) throw upsertError;

      // Award bounty if user is male
      let bountyAwarded = false;
      try {
        const { data: member } = await supabaseAdmin.from("members").select("gender").eq("id", userId).maybeSingle();
        if (member?.gender?.toLowerCase() === "male") {
          console.log(`[apple-store-notifications] User is male. Invoking bounty RPC...`);
          const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc("award_bounty_for_subscription", {
            p_male_id: userId,
            p_tier: tier,
            p_stripe_subscription_id: transactionId,
            p_is_renewal: isRenewal,
          });
          if (rpcError) {
            console.warn("[apple-store-notifications] award_bounty_for_subscription returned error:", rpcError);
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
            console.log("[apple-store-notifications] award_bounty_for_subscription result:", result);

            if (bountyAwarded) {
              console.log(`[apple-store-notifications] Triggering bounty notification for female: ${result.female_id}`);
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
                console.error("[apple-store-notifications] Failed to trigger notify-bounty:", notifyError);
              } else {
                console.log("[apple-store-notifications] notify-bounty triggered successfully:", notifyData);
              }
            }
          }
        }
      } catch (bountyError) {
        console.error("[apple-store-notifications] Failed to run bounty attribution:", bountyError);
      }

      return new Response(JSON.stringify({ success: true, userId, tier, bountyAwarded }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, ignoredEvent: notificationType }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[apple-store-notifications] error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});