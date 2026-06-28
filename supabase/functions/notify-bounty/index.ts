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
    const { female_id, male_id, amount_minutes, source, streak_awarded, streak_amount } = await req.json();

    if (!female_id || !male_id) {
      return new Response(
        JSON.stringify({ success: false, reason: "Missing required fields: female_id, male_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // This function reads from the Lovable Supabase instance where the app data lives.
    // We prefer LOVABLE_ variables if they are set, as they point to the primary database.
    const supabaseUrl = Deno.env.get("LOVABLE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("LOVABLE_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase env vars");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // For invoking other Edge Functions on the SAME project (like send-push-notification),
    // we should use the default SUPABASE_URL and SERVICE_ROLE_KEY.
    const localAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Fetch male user's name
    const { data: maleUser } = await supabaseAdmin
      .from("members")
      .select("name")
      .eq("id", male_id)
      .maybeSingle();
    
    const maleName = maleUser?.name ?? "A member";

    // 2. Prepare Notification Message
    let title = "🎉 Bounty Awarded!";
    let body = `${maleName} just subscribed to VIP! You earned a ${amount_minutes} minute bounty.`;
    
    if (source === "renewal") {
      title = "♻️ Bounty Renewal!";
      body = `${maleName} renewed their VIP! You earned a ${amount_minutes} minute bounty.`;
    }

    if (streak_awarded) {
      body += ` 🔥 Plus a ${streak_amount} minute streak bonus!`;
    }

    // 3. Send Push Notification
    console.log(`[notify-bounty] Sending push to female: ${female_id}`);
    const { data: pushData, error: pushError } = await localAdmin.functions.invoke("send-push-notification", {
      body: {
        user_id: female_id,
        title,
        body,
        data: {
          screen: "/(tabs)/profile",
          type: "bounty_award",
        },
        notification_type: "bounty_award",
        cooldown_minutes: 0,
      },
    });

    if (pushError) {
      console.error("[notify-bounty] Failed to send push notification:", pushError);
    } else {
      console.log("[notify-bounty] Push notification sent successfully:", pushData);
    }

    // 4. Find or Create Conversation
    console.log(`[notify-bounty] Resolving conversation between ${male_id} and ${female_id}`);
    let { data: convo } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .or(`and(participant_1.eq.${male_id},participant_2.eq.${female_id}),and(participant_1.eq.${female_id},participant_2.eq.${male_id})`)
      .maybeSingle();

    if (!convo) {
      const { data: newConvo, error: convoErr } = await supabaseAdmin
        .from("conversations")
        .insert({ participant_1: male_id, participant_2: female_id })
        .select("id")
        .single();
      
      if (convoErr) {
        console.error("[notify-bounty] Failed to create conversation:", convoErr.message);
      } else {
        convo = newConvo;
      }
    }

    // 5. Insert DM Message (as a system notification appearing from the male user)
    if (convo) {
      console.log(`[notify-bounty] Inserting DM into conversation: ${convo.id}`);
      const { error: msgErr } = await supabaseAdmin
        .from("dm_messages")
        .insert({
          conversation_id: convo.id,
          sender_id: male_id,
          content: `🎉 [System] I just subscribed to VIP! You earned a ${amount_minutes} minute bounty.${streak_awarded ? ` 🔥 Plus a ${streak_amount} minute streak bonus!` : ""}`,
        });

      if (msgErr) {
        console.error("[notify-bounty] Failed to insert DM:", msgErr.message);
      } else {
        // Update conversation last_message_at
        await supabaseAdmin
          .from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", convo.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    console.error("[notify-bounty] Unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, reason: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});