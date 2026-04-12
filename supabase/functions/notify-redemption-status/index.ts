import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    // Support both direct calls and Supabase DB webhook (record wrapper)
    const record = payload.record ?? payload;

    const {
      user_id,
      status,
      reward_title,
      shipping_tracking_url,
    } = record;

    if (!user_id || !status) {
      return new Response(
        JSON.stringify({ success: false, reason: "Missing user_id or status" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Only fire for shipped or cancelled
    if (status !== "Order shipped" && status !== "cancelled") {
      return new Response(
        JSON.stringify({ success: false, skipped: true, reason: "Status not actionable" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const title =
      status === "Order shipped"
        ? "🚚 Your order has shipped!"
        : "❌ Your order has been cancelled";

    const rewardLabel = reward_title ? `"${reward_title}"` : "Your reward";

    const body =
      status === "Order shipped"
        ? `${rewardLabel} is on its way! Tap to track your package.`
        : `${rewardLabel} order was cancelled. Contact support if you have questions.`;

    const data: Record<string, string> = {
      type: "redemption_status",
      status,
      screen: "/(tabs)/profile",
    };

    if (status === "Order shipped" && shipping_tracking_url) {
      data.tracking_url = shipping_tracking_url;
    }

    // Call the central send-push-notification function
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const resp = await fetch(
      `${supabaseUrl}/functions/v1/send-push-notification`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          user_id,
          title,
          body,
          data,
          notification_type: "redemption_status",
          force_send: true,
        }),
      },
    );

    const result = await resp.json();
    console.log("[notify-redemption-status] push result:", JSON.stringify(result));

    return new Response(
      JSON.stringify({ success: true, push: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[notify-redemption-status] error:", err);
    return new Response(
      JSON.stringify({ success: false, reason: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});