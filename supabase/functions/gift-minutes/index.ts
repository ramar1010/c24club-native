import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GIFT_TIERS = {
  "100": {
    price_id: "price_1TA0FzA5n8uAZoY1b3jUsE4G",
    minutes: 100,
    cents: 199,
    cash_value_cents: 100, // $1.00
    sender_bonus: 0,
  },
  "400": {
    price_id: "price_1TA0GjA5n8uAZoY1rrg7cW9q",
    minutes: 400,
    cents: 499,
    cash_value_cents: 400, // $4.00
    sender_bonus: 100,
  },
  "600": {
    price_id: "price_1TCLHKA5n8uAZoY1ENfhv2PI",
    minutes: 600,
    cents: 799,
    cash_value_cents: 600, // $6.00
    sender_bonus: 150,
  },
  "1000": {
    price_id: "price_1TCLI0A5n8uAZoY146CTVt6v",
    minutes: 1000,
    cents: 1299,
    cash_value_cents: 1000, // $10.00
    sender_bonus: 250,
  },
};

const APP_ORIGIN = "https://c24club.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("Not authenticated");

    const { action, tier, recipient_id, session_id, minutes_amount, is_direct_call } = await req.json();

    // Direct/private call gifts give recipient a 20% bonus
    const DIRECT_CALL_BONUS_RATE = 0.2;

    if (action === "create-checkout") {
      const giftTier = GIFT_TIERS[tier as keyof typeof GIFT_TIERS];
      if (!giftTier) throw new Error("Invalid gift tier");
      if (!recipient_id) throw new Error("No recipient specified");
      if (recipient_id === user.id) throw new Error("Cannot gift yourself");

      const isTestMode = Deno.env.get("STRIPE_TEST_MODE") === "true";
      const stripeKey = isTestMode ? Deno.env.get("STRIPE_SECRET_KEY_TEST")! : Deno.env.get("STRIPE_SECRET_KEY")!;

      const stripe = new Stripe(stripeKey, {
        apiVersion: "2025-08-27.basil",
      });

      // Check for existing Stripe customer
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      let customerId;
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }

      // Create gift transaction record
      const { data: gift, error: giftError } = await supabaseAdmin
        .from("gift_transactions")
        .insert({
          sender_id: user.id,
          recipient_id,
          minutes_amount: giftTier.minutes,
          price_cents: giftTier.cents,
          status: "pending",
        })
        .select("id")
        .single();

      if (giftError) throw new Error("Failed to create gift record");

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [{ price: giftTier.price_id, quantity: 1 }],
        mode: "payment",
        success_url: `${APP_ORIGIN}/gift-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${APP_ORIGIN}/gift-success?cancelled=true`,
        metadata: {
          gift_id: gift.id,
          recipient_id,
          minutes_amount: String(giftTier.minutes),
          cash_value_cents: String(giftTier.cash_value_cents),
          sender_bonus: String(giftTier.sender_bonus),
          is_direct_call: is_direct_call ? "true" : "false",
        },
      });

      // Store session ID
      await supabaseAdmin.from("gift_transactions").update({ stripe_session_id: session.id }).eq("id", gift.id);

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      if (!session_id) throw new Error("No session ID");

      const isTestMode = Deno.env.get("STRIPE_TEST_MODE") === "true";
      const stripeKey = isTestMode ? Deno.env.get("STRIPE_SECRET_KEY_TEST")! : Deno.env.get("STRIPE_SECRET_KEY")!;

      const stripe = new Stripe(stripeKey, {
        apiVersion: "2025-08-27.basil",
      });

      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (session.payment_status !== "paid") {
        return new Response(JSON.stringify({ success: false, reason: "not_paid" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const giftId = session.metadata?.gift_id;
      if (!giftId) throw new Error("No gift ID in session");

      // Check if already processed
      const { data: gift } = await supabaseAdmin.from("gift_transactions").select("*").eq("id", giftId).single();

      if (!gift) throw new Error("Gift not found");
      if (gift.status === "completed") {
        return new Response(JSON.stringify({ success: true, already_processed: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const minutesAmount = parseInt(session.metadata?.minutes_amount || "0");
      const cashValueCents = parseInt(session.metadata?.cash_value_cents || "0");
      const senderBonus = parseInt(session.metadata?.sender_bonus || "0");
      const recipientId = session.metadata?.recipient_id;
      const isDirectCall = session.metadata?.is_direct_call === "true";

      // Apply 20% bonus for direct/private call gifts (on calling minutes only)
      const directCallBonus = isDirectCall ? Math.floor(minutesAmount * DIRECT_CALL_BONUS_RATE) : 0;
      const totalMinutesForRecipient = minutesAmount + directCallBonus;

      // Calculate cashable gifted minutes based on actual cash value and cashout rate
      const { data: cashoutSettings } = await supabaseAdmin
        .from("cashout_settings")
        .select("rate_per_minute")
        .limit(1)
        .single();

      const ratePerMinute = cashoutSettings?.rate_per_minute || 0.01;
      const cashValue = cashValueCents / 100;
      // Include direct call bonus on cash value too (20% more cash value)
      const totalCashValue = isDirectCall ? cashValue * (1 + DIRECT_CALL_BONUS_RATE) : cashValue;
      const cashableGiftedMinutes = Math.floor(totalCashValue / ratePerMinute);

      // Credit recipient: full calling minutes + only cashable gifted minutes
      const { data: recipientMinutes } = await supabaseAdmin
        .from("member_minutes")
        .select("minutes, gifted_minutes")
        .eq("user_id", recipientId)
        .single();

      if (recipientMinutes) {
        await supabaseAdmin
          .from("member_minutes")
          .update({
            minutes: (recipientMinutes.minutes || 0) + totalMinutesForRecipient,
            gifted_minutes: (recipientMinutes.gifted_minutes || 0) + cashableGiftedMinutes,
          })
          .eq("user_id", recipientId);
      }

      // Credit sender bonus if applicable
      if (senderBonus > 0) {
        const { data: senderMinutes } = await supabaseAdmin
          .from("member_minutes")
          .select("minutes")
          .eq("user_id", gift.sender_id)
          .single();

        if (senderMinutes) {
          await supabaseAdmin
            .from("member_minutes")
            .update({ minutes: (senderMinutes.minutes || 0) + senderBonus })
            .eq("user_id", gift.sender_id);
        }
      }

      // Mark gift as completed
      await supabaseAdmin
        .from("gift_transactions")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", giftId);

      // Send gift notification email to recipient
      try {
        const { data: recipientMember } = await supabaseAdmin
          .from("members")
          .select("name, email")
          .eq("id", recipientId)
          .single();

        const { data: senderMember } = await supabaseAdmin
          .from("members")
          .select("name")
          .eq("id", gift.sender_id)
          .single();

        if (recipientMember?.email) {
          const senderName = senderMember?.name || "Someone";
          const recipientName = recipientMember.name || "there";
          const subject = `🎁 ${senderName} just sent you $${totalCashValue.toFixed(2)} cash!`;
          const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>body{margin:0;padding:0;font-family:'Inter',Arial,sans-serif;background:#f4f4f5}
.wrap{max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;margin-top:24px;margin-bottom:24px}
.header{background:#18181b;padding:24px;text-align:center}
.header img{height:32px}
.content{padding:32px 24px}
h1{color:#18181b;font-size:22px;margin:0 0 16px}
p{color:#52525b;font-size:15px;line-height:1.6;margin:0 0 12px}
.highlight{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:20px;text-align:center;margin:20px 0}
.highlight .amount{font-size:36px;font-weight:800;color:#059669}
.highlight .label{font-size:13px;color:#6b7280;margin-top:4px}
.cta{display:inline-block;background:#059669;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px;margin-top:16px}
.footer{padding:20px 24px;text-align:center;color:#a1a1aa;font-size:12px}
</style></head>
<body><div class="wrap">
<div class="header"><img src="https://c24club.com/favicon-96x96.png" alt="C24Club"></div>
<div class="content">
<h1>Hey ${recipientName}! 🎉</h1>
<p><strong>${senderName}</strong> just sent you a cash gift on C24Club!</p>
<div class="highlight">
<div class="amount">$${totalCashValue.toFixed(2)}</div>
<div class="label">Cash value (+ ${totalMinutesForRecipient} calling minutes)</div>
</div>
<p>You can <strong>cash out for real money</strong> via PayPal! Head to <strong>My Rewards</strong> and tap <strong>Cash Out Minutes</strong> to convert them.</p>
<div style="text-align:center">
<a href="https://c24club.com/my-rewards" class="cta">Go to My Rewards</a>
</div>
</div>
<div class="footer">C24Club &bull; You received this because someone gifted you minutes.</div>
</div></body></html>`;

          const messageId = crypto.randomUUID();

          await supabaseAdmin.from("email_send_log").insert({
            message_id: messageId,
            template_name: "gift-received",
            recipient_email: recipientMember.email,
            status: "pending",
          });

          await supabaseAdmin.rpc("enqueue_email", {
            queue_name: "transactional_emails",
            payload: {
              run_id: crypto.randomUUID(),
              message_id: messageId,
              to: recipientMember.email,
              from: "C24Club <support@c24club.com>",
              sender_domain: "notify.c24club.com",
              subject,
              html: htmlBody,
              text: `Hey ${recipientName}! ${senderName} just sent you $${totalCashValue.toFixed(2)} cash on C24Club! You can cash out via PayPal. Go to My Rewards > Cash Out Minutes to convert them. https://c24club.com/my-rewards`,
              purpose: "transactional",
              label: "gift-received",
              queued_at: new Date().toISOString(),
            },
          });
        }
      } catch (emailErr) {
        // Don't fail the gift if email fails
        console.error("Gift notification email error:", emailErr);
      }

      return new Response(
        JSON.stringify({
          success: true,
          minutes_gifted: minutesAmount,
          cashable_minutes: cashableGiftedMinutes,
          cash_value: totalCashValue,
          sender_bonus: senderBonus,
          direct_call_bonus: directCallBonus,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (action === "gift-from-balance") {
      if (!recipient_id) throw new Error("No recipient specified");
      if (recipient_id === user.id) throw new Error("Cannot gift yourself");

      const giftMinutes = minutes_amount;
      if (!giftMinutes || giftMinutes < 10) throw new Error("Minimum gift is 10 minutes");
      if (giftMinutes > 500) throw new Error("Maximum gift is 500 minutes");

      // Check sender balance
      const { data: senderMinutes } = await supabaseAdmin
        .from("member_minutes")
        .select("total_minutes, gifted_minutes")
        .eq("user_id", user.id)
        .single();

      if (!senderMinutes || senderMinutes.total_minutes < giftMinutes) {
        throw new Error("Insufficient minutes balance");
      }

      // Deduct from sender (reduce gifted_minutes proportionally)
      const senderGifted = senderMinutes.gifted_minutes ?? 0;
      const newSenderTotal = senderMinutes.total_minutes - giftMinutes;
      const newSenderGifted = Math.min(Math.max(0, senderGifted - giftMinutes), newSenderTotal);
      await supabaseAdmin
        .from("member_minutes")
        .update({ total_minutes: newSenderTotal, gifted_minutes: newSenderGifted })
        .eq("user_id", user.id);

      // Credit recipient
      const { data: recipientMins } = await supabaseAdmin
        .from("member_minutes")
        .select("total_minutes")
        .eq("user_id", recipient_id)
        .single();

      if (recipientMins) {
        await supabaseAdmin
          .from("member_minutes")
          .update({ total_minutes: recipientMins.total_minutes + giftMinutes })
          .eq("user_id", recipient_id);
      }

      // Record transaction
      await supabaseAdmin.from("gift_transactions").insert({
        sender_id: user.id,
        recipient_id,
        minutes_amount: giftMinutes,
        price_cents: 0,
        status: "completed",
      });

      // Send gift notification email to recipient
      try {
        const { data: recipientMember } = await supabaseAdmin
          .from("members")
          .select("name, email")
          .eq("id", recipient_id)
          .single();

        const { data: senderMember } = await supabaseAdmin.from("members").select("name").eq("id", user.id).single();

        if (recipientMember?.email) {
          const senderName = senderMember?.name || "Someone";
          const recipientName = recipientMember.name || "there";
          const subject = `🎁 ${senderName} just gifted you ${giftMinutes} minutes!`;
          const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>body{margin:0;padding:0;font-family:'Inter',Arial,sans-serif;background:#f4f4f5}
.wrap{max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;margin-top:24px;margin-bottom:24px}
.header{background:#18181b;padding:24px;text-align:center}
.header img{height:32px}
.content{padding:32px 24px}
h1{color:#18181b;font-size:22px;margin:0 0 16px}
p{color:#52525b;font-size:15px;line-height:1.6;margin:0 0 12px}
.highlight{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:20px;text-align:center;margin:20px 0}
.highlight .amount{font-size:36px;font-weight:800;color:#059669}
.highlight .label{font-size:13px;color:#6b7280;margin-top:4px}
.cta{display:inline-block;background:#059669;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px;margin-top:16px}
.footer{padding:20px 24px;text-align:center;color:#a1a1aa;font-size:12px}
</style></head>
<body><div class="wrap">
<div class="header"><img src="https://c24club.com/favicon-96x96.png" alt="C24Club"></div>
<div class="content">
<h1>Hey ${recipientName}! 🎉</h1>
<p><strong>${senderName}</strong> just sent you a gift on C24Club!</p>
<div class="highlight">
<div class="amount">${giftMinutes} min</div>
<div class="label">Minutes gifted to you</div>
</div>
<p>These gifted minutes can be <strong>cashed out for real money</strong> via PayPal! Head to <strong>My Rewards</strong> and tap <strong>Cash Out Minutes</strong> to convert them.</p>
<div style="text-align:center">
<a href="https://c24club.com/my-rewards" class="cta">Go to My Rewards</a>
</div>
</div>
<div class="footer">C24Club &bull; You received this because someone gifted you minutes.</div>
</div></body></html>`;

          const messageId = crypto.randomUUID();

          await supabaseAdmin.from("email_send_log").insert({
            message_id: messageId,
            template_name: "gift-received",
            recipient_email: recipientMember.email,
            status: "pending",
          });

          await supabaseAdmin.rpc("enqueue_email", {
            queue_name: "transactional_emails",
            payload: {
              run_id: crypto.randomUUID(),
              message_id: messageId,
              to: recipientMember.email,
              from: "C24Club <support@c24club.com>",
              sender_domain: "notify.c24club.com",
              subject,
              html: htmlBody,
              text: `Hey ${recipientName}! ${senderName} just gifted you ${giftMinutes} minutes on C24Club! You can cash these out for real money via PayPal. Go to My Rewards > Cash Out Minutes to convert them. https://c24club.com/my-rewards`,
              purpose: "transactional",
              label: "gift-received",
              queued_at: new Date().toISOString(),
            },
          });
        }
      } catch (emailErr) {
        console.error("Gift notification email error:", emailErr);
      }

      return new Response(JSON.stringify({ success: true, minutes_gifted: giftMinutes }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});