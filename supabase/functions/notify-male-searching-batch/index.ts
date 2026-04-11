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

    // ── 1. Get all female users in "batched" mode with count > 0 ─────────────
    const { data: batchRows, error: batchErr } = await supabaseAdmin
      .from("male_search_batch_log")
      .select("female_user_id, join_count")
      .gt("join_count", 0);

    if (batchErr) {
      console.error("[notify-male-searching-batch] batch fetch error:", batchErr.message);
      return new Response(
        JSON.stringify({ success: false, reason: batchErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!batchRows || batchRows.length === 0) {
      console.log("[notify-male-searching-batch] No pending batch notifications.");
      return new Response(
        JSON.stringify({ success: true, notified: 0, reason: "No pending counts" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 2. Get active room members to exclude ─────────────────────────────────
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

    // ── 3. For each female user, check preferences and send ───────────────────
    let notified = 0;
    const userIds = batchRows.map((r) => r.female_user_id);

    const { data: members } = await supabaseAdmin
      .from("members")
      .select("id, male_search_notify_mode, notify_enabled, push_token")
      .in("id", userIds)
      .eq("notify_enabled", true)
      .eq("male_search_notify_mode", "batched");

    if (!members || members.length === 0) {
      console.log("[notify-male-searching-batch] No eligible batched users.");
      // Still reset counters
      await supabaseAdmin
        .from("male_search_batch_log")
        .update({ join_count: 0, last_reset_at: new Date().toISOString() })
        .in("female_user_id", userIds);
      return new Response(
        JSON.stringify({ success: true, notified: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results = await Promise.allSettled(
      members
        .filter((m) => !activeMemberIds.has(m.id) && m.push_token)
        .map((member) => {
          const row = batchRows.find((r) => r.female_user_id === member.id);
          const count = row?.join_count ?? 1;
          return supabaseAdmin.functions.invoke("send-push-notification", {
            body: {
              user_id: member.id,
              title: "🔥 Guys are looking to chat!",
              body: `${count} guy${count > 1 ? "s" : ""} searched for a chat in the last 30 min — tap to join!`,
              data: { deepLink: "/(tabs)/chat" },
              notification_type: "male_search_batch",
              cooldown_minutes: 0, // Batching handles its own cooldown
            },
          });
        })
    );

    for (const result of results) {
      if (result.status === "fulfilled") notified++;
      else console.error("[notify-male-searching-batch] invoke error:", result.reason);
    }

    // ── 4. Reset counters ─────────────────────────────────────────────────────
    await supabaseAdmin
      .from("male_search_batch_log")
      .update({ join_count: 0, last_reset_at: new Date().toISOString() })
      .in("female_user_id", userIds);

    console.log(`[notify-male-searching-batch] Done. Notified ${notified} users.`);
    return new Response(
      JSON.stringify({ success: true, notified }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    console.error("[notify-male-searching-batch] Unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, reason: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});