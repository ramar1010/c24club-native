import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * notify-direct-call
 *
 * Sends push notifications for direct video call events.
 *
 * Body:
 *   { inviteId: string, action: 'incoming' | 'missed' }
 *
 * - 'incoming' → notifies the INVITEE they are being called (high-priority)
 * - 'missed'   → notifies the INVITEE they missed a call (rate-limited to 3/hr per caller)
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { inviteId, action } = await req.json();

    if (!inviteId || !action) {
      return new Response(
        JSON.stringify({ success: false, reason: "Missing inviteId or action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Helper to invoke internal edge functions with service-role auth
    const invokeFunction = async (name: string, body: unknown) => {
      const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/${name}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify(body),
      });
      return resp.json();
    };

    // ── Fetch invite ──────────────────────────────────────────────────────────
    const { data: invite, error: inviteErr } = await supabaseAdmin
      .from("direct_call_invites")
      .select("id, inviter_id, invitee_id, status, expires_at, created_at")
      .eq("id", inviteId)
      .maybeSingle();

    if (inviteErr || !invite) {
      console.warn("[notify-direct-call] Invite not found:", inviteId);
      return new Response(
        JSON.stringify({ success: false, reason: "Invite not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Fetch caller profile ──────────────────────────────────────────────────
    const { data: caller } = await supabaseAdmin
      .from("members")
      .select("name, image_url, image_status")
      .eq("id", invite.inviter_id)
      .maybeSingle();

    const callerName = caller?.name || "Someone";
    const callerImage =
      caller?.image_status === "approved" && caller?.image_url
        ? caller.image_url
        : null;

    // ── Incoming call notification ────────────────────────────────────────────
    if (action === "incoming") {
      // Only send if invite is still pending
      if (invite.status !== "pending") {
        return new Response(
          JSON.stringify({ success: false, skipped: true, reason: "Invite no longer pending" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await invokeFunction("send-push-notification", {
        user_id: invite.invitee_id,
        title: `📹 ${callerName} wants to video chat!`,
        body: "Tap to accept the call before it expires",
        notification_type: "incoming_direct_call",
        cooldown_minutes: 0,
        channel_id: "incoming_calls",
        priority: "high",
        force_send: true,
        data: {
          screen: "incoming-call",
          type: "incoming_direct_call",
          inviteId: invite.id,
          inviterId: invite.inviter_id,
          inviterName: callerName,
          ...(callerImage ? { inviterImage: callerImage } : {}),
          expiresAt: invite.expires_at,
        },
      });

      console.log("[notify-direct-call] Incoming call push sent to:", invite.invitee_id);
    }

    // ── Missed call notification ──────────────────────────────────────────────
    else if (action === "missed") {
      const inviterId = invite.inviter_id;
      const inviteeId = invite.invitee_id;

      // Check if a conversation already exists between the two users
      const { data: conv } = await supabaseAdmin
        .from("conversations")
        .select("id")
        .or(
          `and(participant_1.eq.${inviterId},participant_2.eq.${inviteeId}),` +
          `and(participant_1.eq.${inviteeId},participant_2.eq.${inviterId})`
        )
        .maybeSingle();

      const screen = conv?.id ? `/messages/${conv.id}` : "/discover";

      await invokeFunction("send-push-notification", {
        user_id: inviteeId,
        title: `📞 Missed call from ${callerName}`,
        body: `${callerName} tried to video call you — tap to call back!`,
        notification_type: `missed_direct_call_${inviterId}`,
        cooldown_minutes: 20,
        data: {
          screen,
          type: "missed_direct_call",
          inviterId,
          inviteId: invite.id,
        },
      });

      console.log("[notify-direct-call] Missed call push sent to:", inviteeId);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[notify-direct-call] Unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, reason: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});