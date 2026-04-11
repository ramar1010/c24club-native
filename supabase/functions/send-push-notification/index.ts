import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      user_id,
      title,
      body,
      data = {},
      notification_type,
      cooldown_minutes,
      channel_id,
      priority,
      force_send,
    } = await req.json();

    if (!user_id || !title || !body) {
      return new Response(
        JSON.stringify({ success: false, reason: "Missing required fields: user_id, title, body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── 1. Fetch member's push token and notification preference ──────────────
    const { data: member, error: memberErr } = await supabaseAdmin
      .from("members")
      .select("push_token, notify_enabled")
      .eq("id", user_id)
      .maybeSingle();

    if (memberErr) {
      console.error("[send-push-notification] member fetch error:", memberErr.message);
      return new Response(
        JSON.stringify({ success: false, reason: memberErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!member?.push_token) {
      return new Response(
        JSON.stringify({ success: false, skipped: true, reason: "No push token registered" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Treat null as enabled — only skip if explicitly set to false AND force_send is not set
    if (member.notify_enabled === false && !force_send) {
      return new Response(
        JSON.stringify({ success: false, skipped: true, reason: "Notifications disabled for user" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 2. Cooldown check ─────────────────────────────────────────────────────
    if (cooldown_minutes && notification_type) {
      const { data: logEntry } = await supabaseAdmin
        .from("push_notification_log")
        .select("last_sent_at")
        .eq("user_id", user_id)
        .eq("notification_type", notification_type)
        .maybeSingle();

      if (logEntry?.last_sent_at) {
        const lastSent = new Date(logEntry.last_sent_at).getTime();
        const cooldownMs = cooldown_minutes * 60 * 1000;
        if (Date.now() - lastSent < cooldownMs) {
          return new Response(
            JSON.stringify({ success: false, skipped: true, reason: "Cooldown active" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    }

    // ── 3. Upsert log entry ───────────────────────────────────────────────────
    if (notification_type) {
      await supabaseAdmin
        .from("push_notification_log")
        .upsert(
          {
            user_id,
            notification_type,
            last_sent_at: new Date().toISOString(),
          },
          { onConflict: "user_id,notification_type" },
        );
    }

    // ── 4. Send via Expo Push API (works for both iOS & Android) ─────────────
    const pushToken: string = member.push_token;

    const expoPayload = {
      to: pushToken,
      title,
      body,
      data,
      sound: "default",
      channelId: channel_id ?? "default",
      priority: priority ?? "high",
    };

    console.log("[send-push-notification] Sending via Expo to:", pushToken.substring(0, 20) + "...");

    const expoResp = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(expoPayload),
    });

    const expoBody = await expoResp.json();
    console.log("[send-push-notification] Expo response:", JSON.stringify(expoBody));

    // Handle invalid/unregistered token — clear it so we don't keep trying
    const ticketData = expoBody?.data;
    if (ticketData?.status === "error") {
      const details = ticketData?.details;
      if (details?.error === "DeviceNotRegistered" || details?.error === "InvalidCredentials") {
        console.warn("[send-push-notification] Clearing invalid token for user:", user_id);
        await supabaseAdmin
          .from("members")
          .update({ push_token: null })
          .eq("id", user_id);
      }
      return new Response(
        JSON.stringify({ success: false, reason: ticketData?.message || "Expo push failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, skipped: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    console.error("[send-push-notification] Unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, reason: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});