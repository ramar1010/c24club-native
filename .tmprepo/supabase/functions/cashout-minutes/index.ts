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

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.id) throw new Error("Not authenticated");

    const { action, minutes_amount, paypal_email } = await req.json();

    if (action === "request-cashout") {
      if (!minutes_amount || minutes_amount <= 0) throw new Error("Invalid minutes amount");
      if (!paypal_email) throw new Error("PayPal email is required");

      // Fetch cashout settings
      const { data: settings } = await supabaseAdmin
        .from("cashout_settings")
        .select("min_cashout_minutes, max_cashout_minutes, rate_per_minute")
        .limit(1)
        .maybeSingle();

      const minCashout = settings?.min_cashout_minutes ?? 100;
      const maxCashout = settings?.max_cashout_minutes ?? 5000;
      const ratePerMinute = settings?.rate_per_minute ?? 0.02;

      if (minutes_amount < minCashout) {
        throw new Error(`Minimum cashout is ${minCashout} gifted minutes`);
      }
      if (minutes_amount > maxCashout) {
        throw new Error(`Maximum cashout is ${maxCashout} gifted minutes`);
      }

      // Check for existing pending cashout
      const { data: pendingRequest } = await supabaseAdmin
        .from("cashout_requests")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .maybeSingle();

      if (pendingRequest) {
        throw new Error("You already have a pending cashout request");
      }

      // Fetch current gifted_minutes balance ONLY — never touch earned minutes
      const { data: memberMinutes, error: fetchError } = await supabaseAdmin
        .from("member_minutes")
        .select("gifted_minutes, minutes")
        .eq("user_id", user.id)
        .single();

      if (fetchError || !memberMinutes) throw new Error("Could not fetch your balance");

      const giftedBalance = memberMinutes.gifted_minutes ?? 0;

      if (giftedBalance < minutes_amount) {
        throw new Error(
          `Insufficient gifted minutes. You have ${giftedBalance} gifted minutes available.`,
        );
      }

      // Deduct ONLY from gifted_minutes — never touch the `minutes` (earned chatting) column
      const { error: updateError } = await supabaseAdmin
        .from("member_minutes")
        .update({
          gifted_minutes: giftedBalance - minutes_amount,
          // `minutes` (earned chatting) is intentionally NOT modified here
        })
        .eq("user_id", user.id);

      if (updateError) throw new Error("Failed to deduct gifted minutes: " + updateError.message);

      // Calculate cash value
      const cashAmount = minutes_amount * ratePerMinute;

      // Insert cashout request for admin processing
      const { error: insertError } = await supabaseAdmin
        .from("cashout_requests")
        .insert({
          user_id: user.id,
          minutes_amount,
          paypal_email,
          cashout_amount: cashAmount,
          status: "pending",
        });

      if (insertError) {
        // Rollback the deduction if insert fails
        await supabaseAdmin
          .from("member_minutes")
          .update({ gifted_minutes: giftedBalance })
          .eq("user_id", user.id);
        throw new Error("Failed to create cashout request: " + insertError.message);
      }

      return new Response(
        JSON.stringify({
          success: true,
          minutes_cashed_out: minutes_amount,
          cash_amount: cashAmount,
          paypal_email,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    throw new Error("Invalid action");
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});