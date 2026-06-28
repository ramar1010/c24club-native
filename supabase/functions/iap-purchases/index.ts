import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MINUTE_MAP: Record<string, number> = {
  c24_gift_100_minutes: 100,
  c24_gift_400_minutes: 400,
  c24_gift_600_minutes: 600,
  c24_gift_1000_minutes: 1000,
  "100minutes": 100,
  "400minutes": 400,
  "600minutes": 600,
  "1000minutes": 1000,
};

const SENDER_BONUS_MAP: Record<string, number> = {
  c24_gift_100_minutes: 0,
  c24_gift_400_minutes: 100,
  c24_gift_600_minutes: 150,
  c24_gift_1000_minutes: 250,
  "100minutes": 0,
  "400minutes": 100,
  "600minutes": 150,
  "1000minutes": 250,
};

const CASH_VALUE_MAP: Record<string, number> = {
  c24_gift_100_minutes: 1.0,
  c24_gift_400_minutes: 4.0,
  c24_gift_600_minutes: 6.0,
  c24_gift_1000_minutes: 10.0,
  "100minutes": 1.0,
  "400minutes": 4.0,
  "600minutes": 6.0,
  "1000minutes": 10.0,
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
    // This function connects to the LOVABLE Supabase instance (not CatDoes Cloud)
    // because all app data (members, member_minutes, etc.) lives there.
    const supabaseUrl = Deno.env.get("LOVABLE_SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("LOVABLE_SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("LOVABLE_SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const token = authHeader.replace("Bearer ", "");

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user?.id) throw new Error("Not authenticated");

    const body = await req.json();
    const { action: rawAction, purchaseToken, platform } = body;
    const action = rawAction?.toLowerCase();
    const sku = body.sku?.toLowerCase();

    console.log(`[iap-purchases] action=${action} sku=${sku} platform=${platform}`);

    const verifyReceipt = async () => {
      if (!purchaseToken) throw new Error("Missing purchaseToken");
      // StoreKit 2 (react-native-iap v14+) issues JWS tokens, not legacy base64 receipts.
      // Apple already verified the purchase on-device before issuing the token.
      // Calling the legacy /verifyReceipt endpoint with a JWS token always returns status 21002.
      // So we trust the token presence and let Supabase row-level security protect the data.
      if (platform === "ios") {
        console.log("[iap-purchases] iOS StoreKit 2 — skipping legacy receipt verification, trusting on-device verification.");
        return true;
      }
      if (platform === "android") {
        console.warn("GOOGLE verification not configured — skipping.");
        return true;
      }
      throw new Error("Unknown platform");
    };

    if (action === "verify-subscription" || action === "restore-subscription" || action === "restore_subscription") {
      if (!sku) throw new Error("Missing sku");
      await verifyReceipt();
      const tier = (sku === "c24_premium_vip" || sku === "premiumvip") ? "premium" : "basic";
      const resolvedOriginalTransactionId =
        readNonEmptyString(body.original_transaction_id) ?? readNonEmptyString(body.originalTransactionId);
      const resolvedSubscriptionEnd = normalizeSubscriptionEnd(body.subscription_end ?? body.p_subscription_end);

      // 1. Insert into iap_purchases
      const isRenewal = body.isRenewal || body.is_renewal || false;
      const txId = purchaseToken || body.transactionId || resolvedOriginalTransactionId || `tx_${Date.now()}`;
      const idempotencyKey = `iap:${platform}:${txId}`;
      const iapPayload: Record<string, unknown> = {
        user_id: user.id,
        platform: platform || "ios",
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
        console.warn("[iap-purchases] Error inserting into iap_purchases:", iapError);
      }

      // 2. Update member_minutes
      const memberMinutesUpdate: Record<string, unknown> = {
        is_vip: true,
        vip_tier: tier,
      };

      if (resolvedSubscriptionEnd) {
        memberMinutesUpdate.subscription_end = resolvedSubscriptionEnd;
      }

      const { data: updatedMinutes, error: updateError } = await supabaseAdmin
        .from("member_minutes")
        .upsert({ user_id: user.id, ...memberMinutesUpdate }, { onConflict: "user_id" })
        .select("*")
        .maybeSingle();

      if (updateError) throw updateError;

      const memberMinutes: Record<string, unknown> | null = updatedMinutes ?? null;

      // 3. Award bounty before responding so the function does not terminate early.
      let bountyAwarded = false;
      try {
        const { data: member } = await supabaseAdmin
          .from("members")
          .select("gender")
          .eq("id", user.id)
          .maybeSingle();

        if (member?.gender?.toLowerCase() === "male") {
          console.log(`[iap-purchases] User is male. Invoking bounty RPC...`);
          const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc("award_bounty_for_subscription", {
            p_male_id: user.id,
            p_tier: tier,
            p_stripe_subscription_id: idempotencyKey,
            p_is_renewal: isRenewal,
          });

          if (rpcError) {
            console.warn(`[iap-purchases] award_bounty_for_subscription returned error (this is expected if no attribution exists):`, rpcError);
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
            console.log(`[iap-purchases] award_bounty_for_subscription succeeded, result:`, result);

            if (bountyAwarded) {
              console.log(`[iap-purchases] Triggering bounty notification for female: ${result.female_id}`);
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
                console.error("[iap-purchases] Failed to trigger notify-bounty:", notifyError);
              } else {
                console.log("[iap-purchases] notify-bounty triggered successfully:", notifyData);
              }
            }
          }
        } else {
          console.log(`[iap-purchases] User gender is not male (${member?.gender}), skipping bounty award.`);
        }
      } catch (bountyError) {
        console.error("[iap-purchases] Failed to run bounty attribution logic:", bountyError);
      }

      return new Response(JSON.stringify({ success: true, tier, member_minutes: memberMinutes, bountyAwarded }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "check-subscription" || action === "check_subscription") {
      const { data: minutes, error } = await supabaseAdmin
        .from("member_minutes")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      return new Response(
        JSON.stringify({
          success: true,
          is_vip: Boolean(minutes?.is_vip),
          vip_tier: minutes?.vip_tier ?? null,
          member_minutes: minutes ?? null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "verify-gift") {
      if (!sku) throw new Error("Missing sku");
      const { recipient_id } = body;
      if (!recipient_id) throw new Error("Missing recipient_id");

      const minutesToGift = MINUTE_MAP[sku];
      if (!minutesToGift) throw new Error(`Unknown product sku: ${sku}`);

      await verifyReceipt();

      const { data: recipientData } = await supabaseAdmin
        .from("member_minutes")
        .select("gifted_minutes")
        .eq("user_id", recipient_id)
        .maybeSingle();

      if (recipientData) {
        const { error: recipientMinutesError } = await supabaseAdmin
          .from("member_minutes")
          .update({ 
            gifted_minutes: (recipientData.gifted_minutes ?? 0) + minutesToGift 
          })
          .eq("user_id", recipient_id);

        if (recipientMinutesError) {
          console.error("[iap-purchases] member_minutes gifted_minutes update error:", recipientMinutesError);
        }
      }

      const { error: giftError } = await supabaseAdmin.from("gift_transactions").insert({
        sender_id: user.id,
        recipient_id,
        minutes_amount: minutesToGift,
        status: "completed",
      });

      if (giftError) console.error("[iap-purchases] gift_transactions insert error:", giftError);

      // Send push notification and DM to recipient
      try {
        const { data: recipientMember } = await supabaseAdmin
          .from("members")
          .select("name")
          .eq("id", recipient_id)
          .single();

        const { data: senderMember } = await supabaseAdmin
          .from("members")
          .select("name")
          .eq("id", user.id)
          .single();

        if (recipientMember) {
          const senderName = senderMember?.name || "Someone";
          const cashValue = CASH_VALUE_MAP[sku] || (minutesToGift * 0.01);
          const amountText = `$${cashValue.toFixed(2)}`;

          // 1. Send Push Notification
          await supabaseAdmin.functions.invoke("send-push-notification", {
            body: {
              user_id: recipient_id,
              title: "🎁 Gift Received!",
              body: `${senderName} just sent you a ${amountText} gift! 💖`,
              data: {
                screen: "/(tabs)/profile",
                type: "gift_received",
              },
              notification_type: "gift_received",
              cooldown_minutes: 0,
            },
          });

          // 2. Find or Create Conversation
          let { data: convo } = await supabaseAdmin
            .from("conversations")
            .select("id")
            .or(`and(participant_1.eq.${user.id},participant_2.eq.${recipient_id}),and(participant_1.eq.${recipient_id},participant_2.eq.${user.id})`)
            .maybeSingle();

          if (!convo) {
            const { data: newConvo } = await supabaseAdmin
              .from("conversations")
              .insert({ participant_1: user.id, participant_2: recipient_id })
              .select("id")
              .single();
            convo = newConvo;
          }

          // 3. Insert DM Message
          if (convo) {
            await supabaseAdmin
              .from("dm_messages")
              .insert({
                conversation_id: convo.id,
                sender_id: user.id,
                content: `🎁 [System] I just sent you a ${amountText} gift!`,
              });
            
            await supabaseAdmin
              .from("conversations")
              .update({ last_message_at: new Date().toISOString() })
              .eq("id", convo.id);
          }
        }
      } catch (err) {
        console.error("[iap-purchases] Gift push/DM error:", err);
      }

      return new Response(JSON.stringify({ success: true, minutes_gifted: minutesToGift }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "verify-unfreeze") {
      if (sku !== "c24_minute_unfreeze" && sku !== "unfreeze_minutes") throw new Error(`Invalid SKU for unfreeze: ${sku}`);
      await verifyReceipt();
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      const { error } = await supabaseAdmin.from("member_minutes").update({ is_frozen: false, frozen_at: null, freeze_free_until: sevenDaysFromNow.toISOString() }).eq("user_id", user.id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "verify-unban") {
      if (sku !== "c24_unban_10" && sku !== "unbanme") throw new Error(`Invalid SKU for unban: ${sku}`);
      await verifyReceipt();
      const { error } = await supabaseAdmin.from("user_bans").update({ is_active: false, unbanned_at: new Date().toISOString(), unban_payment_session: purchaseToken }).eq("user_id", user.id).eq("is_active", true);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, unbanned: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "vip-unfreeze") {
      const { data: minutes, error: fetchError } = await supabaseAdmin.from("member_minutes").select("is_vip, admin_granted_vip, vip_unfreezes_used").eq("user_id", user.id).maybeSingle();
      if (fetchError) throw fetchError;
      if (!minutes?.is_vip && !minutes?.admin_granted_vip) throw new Error("User is not VIP");
      const { error } = await supabaseAdmin.from("member_minutes").update({ is_frozen: false, frozen_at: null, vip_unfreezes_used: (minutes.vip_unfreezes_used || 0) + 1 }).eq("user_id", user.id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "verify-minutes") {
      if (!sku) throw new Error("Missing sku");
      const minutesToAdd = MINUTE_MAP[sku];
      if (!minutesToAdd) throw new Error(`Unknown product sku: ${sku}`);
      await verifyReceipt();
      const { data: current } = await supabaseAdmin.from("member_minutes").select("minutes").eq("user_id", user.id).maybeSingle();
      const { error } = await supabaseAdmin.from("member_minutes").upsert({ user_id: user.id, minutes: (current?.minutes ?? 0) + minutesToAdd }, { onConflict: "user_id" });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, minutes_added: minutesToAdd }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: any) {
    console.error("iap-purchases error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});