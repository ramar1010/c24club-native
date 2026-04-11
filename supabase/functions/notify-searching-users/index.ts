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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── 1. Check if anyone is in the waiting queue ────────────────────────────
    const { data: queueRows, error: queueErr } = await supabaseAdmin
      .from("waiting_queue")
      .select("member_id")
      .limit(1);

    if (queueErr) {
      console.error("[notify-searching-users] queue fetch error:", queueErr.message);
      return new Response(
        JSON.stringify({ success: false, reason: queueErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!queueRows || queueRows.length === 0) {
      console.log("[notify-searching-users] Queue is empty, nothing to do.");
      return new Response(
        JSON.stringify({ success: true, notified: 0, reason: "Queue is empty" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 2. Find eligible users to notify ─────────────────────────────────────
    // Eligible: notify_enabled=true, last active between 30 min and 24 h ago,
    // and NOT currently in an active room
    const now = new Date();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const { data: activeRoomMembers } = await supabaseAdmin
      .from("rooms")
      .select("member1, member2")
      .eq("status", "active");

    const activeMemberIds = new Set<string>();
    if (activeRoomMembers) {
      for (const room of activeRoomMembers) {
        if (room.member1) activeMemberIds.add(room.member1);
        if (room.member2) activeMemberIds.add(room.member2);
      }
    }

    const { data: candidates, error: candidateErr } = await supabaseAdmin
      .from("members")
      .select("id")
      .eq("notify_enabled", true)
      .lt("last_active_at", thirtyMinAgo)
      .gt("last_active_at", twentyFourHoursAgo)
      .limit(50);

    if (candidateErr) {
      console.error("[notify-searching-users] candidate fetch error:", candidateErr.message);
      return new Response(
        JSON.stringify({ success: false, reason: candidateErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!candidates || candidates.length === 0) {
      console.log("[notify-searching-users] No eligible candidates.");
      return new Response(
        JSON.stringify({ success: true, notified: 0, reason: "No eligible users" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Filter out users currently in an active room
    const eligible = candidates.filter((m) => !activeMemberIds.has(m.id));
    console.log(`[notify-searching-users] Eligible users to notify: ${eligible.length}`);

    // ── 3. Send push notifications (fire-and-forget per user) ────────────────
    let notified = 0;
    const results = await Promise.allSettled(
      eligible.map((user) =>
        supabaseAdmin.functions.invoke("send-push-notification", {
          body: {
            user_id: user.id,
            title: "💬 Someone is waiting to chat!",
            body: "A user is searching for a video chat — jump back in!",
            data: { deepLink: "/(tabs)/chat" },
            notification_type: "user_searching",
            cooldown_minutes: 120,
          },
        })
      ),
    );

    for (const result of results) {
      if (result.status === "fulfilled") notified++;
      else console.error("[notify-searching-users] invoke error:", result.reason);
    }

    console.log(`[notify-searching-users] Done. Notified ${notified}/${eligible.length} users.`);
    return new Response(
      JSON.stringify({ success: true, notified, total: eligible.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    console.error("[notify-searching-users] Unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, reason: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});