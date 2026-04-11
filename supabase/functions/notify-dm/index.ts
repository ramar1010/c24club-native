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
    const { message_id } = await req.json();

    if (!message_id) {
      return new Response(
        JSON.stringify({ success: false, reason: "Missing message_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── 1. Fetch the message ──────────────────────────────────────────────────
    const { data: message, error: msgErr } = await supabaseAdmin
      .from("dm_messages")
      .select("id, conversation_id, sender_id, content, created_at")
      .eq("id", message_id)
      .maybeSingle();

    if (msgErr || !message) {
      console.error("[notify-dm] message fetch error:", msgErr?.message);
      return new Response(
        JSON.stringify({ success: false, reason: msgErr?.message ?? "Message not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 2. Find the recipient via conversations table ─────────────────────────
    const { data: conversation, error: convErr } = await supabaseAdmin
      .from("conversations")
      .select("participant_1, participant_2")
      .eq("id", message.conversation_id)
      .maybeSingle();

    if (convErr || !conversation) {
      console.error("[notify-dm] conversation fetch error:", convErr?.message);
      return new Response(
        JSON.stringify({ success: false, reason: "Conversation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Recipient is whichever participant is NOT the sender
    const recipientId =
      conversation.participant_1 === message.sender_id
        ? conversation.participant_2
        : conversation.participant_1;

    if (!recipientId) {
      return new Response(
        JSON.stringify({ success: false, reason: "Could not determine recipient" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 2.5 Block check ───────────────────────────────────────────────────────
    const { data: blockRecord } = await supabaseAdmin
      .from('blocked_users')
      .select('id')
      .eq('blocker_id', recipientId)
      .eq('blocked_id', message.sender_id)
      .maybeSingle();

    if (blockRecord) {
      console.log("[notify-dm] Skipping push: Recipient has blocked the sender");
      return new Response(JSON.stringify({ skipped: 'blocked' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── 3. Look up sender name ────────────────────────────────────────────────
    const { data: sender } = await supabaseAdmin
      .from("members")
      .select("name")
      .eq("id", message.sender_id)
      .maybeSingle();

    const senderName = sender?.name ?? "Someone";

    // ── 4. Check how many unread messages since last notification ─────────────
    //    This drives the grouping: if the cooldown in send-push-notification
    //    is still active (< 30s), the send will be skipped automatically.
    //    When the 30s window reopens, we count all unread messages and show
    //    the grouped count.
    const notificationType = `dm_${message.conversation_id}`;

    const { data: logEntry } = await supabaseAdmin
      .from("push_notification_log")
      .select("last_sent_at")
      .eq("user_id", recipientId)
      .eq("notification_type", notificationType)
      .maybeSingle();

    // Count unread messages from sender since last notification (or all if never notified)
    let unreadCount = 1;
    if (logEntry?.last_sent_at) {
      const { count } = await supabaseAdmin
        .from("dm_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", message.conversation_id)
        .eq("sender_id", message.sender_id)
        .gt("created_at", logEntry.last_sent_at);

      unreadCount = count ?? 1;
    }

    // ── 5. Build notification content ─────────────────────────────────────────
    const title = `💬 ${senderName}`;
    let body: string;

    if (unreadCount > 1) {
      body = `You have ${unreadCount} unread messages`;
    } else {
      // Truncate message preview to 80 chars
      const preview = (message.content ?? "").slice(0, 80);
      body = preview || "Sent you a message";
    }

    // ── 6. Send push notification (with 30s grouping cooldown) ────────────────
    const { data: sendResult, error: sendErr } = await supabaseAdmin.functions.invoke(
      "send-push-notification",
      {
        body: {
          user_id: recipientId,
          title,
          body,
          data: {
            screen: `/messages/${message.conversation_id}`,
            conversationId: message.conversation_id,
            senderId: message.sender_id,
          },
          notification_type: notificationType,
          cooldown_minutes: 0.5, // 30 second grouping window
        },
      },
    );

    if (sendErr) {
      console.error("[notify-dm] send-push-notification error:", sendErr.message);
    } else {
      console.log("[notify-dm] send result:", JSON.stringify(sendResult));
    }

    return new Response(
      JSON.stringify({ success: true, recipientId, unreadCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    console.error("[notify-dm] Unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, reason: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});