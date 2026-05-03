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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const sightengineUser = Deno.env.get("SIGHTENGINE_API_USER") ?? "";
    const sightengineSecret = Deno.env.get("SIGHTENGINE_API_SECRET") ?? "";

    if (!sightengineUser || !sightengineSecret) {
      return new Response(
        JSON.stringify({ flagged: false, error: "Sightengine credentials not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user?.id) throw new Error("Not authenticated");

    const { frame, reported_user_id } = await req.json();
    if (!frame || !reported_user_id) throw new Error("Missing frame or reported_user_id");

    // Convert base64 to blob and send to Sightengine
    const binaryStr = atob(frame);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "image/jpeg" });

    const formData = new FormData();
    formData.append("media", blob, "frame.jpg");
    formData.append("models", "nudity-2.0,offensive,gore");
    formData.append("api_user", sightengineUser);
    formData.append("api_secret", sightengineSecret);

    const moderationRes = await fetch("https://api.sightengine.com/1.0/check.json", {
      method: "POST",
      body: formData,
    });

    if (!moderationRes.ok) {
      const errText = await moderationRes.text();
      console.error("Sightengine error:", errText);
      return new Response(
        JSON.stringify({ flagged: false, error: "Sightengine API error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const result = await moderationRes.json();

    // Check thresholds
    const nudityActivity = result?.nudity?.sexual_activity ?? 0;
    const nudityDisplay = result?.nudity?.sexual_display ?? 0;
    const nudityVeryS = result?.nudity?.very_suggestive ?? 0;
    const offensive = result?.offensive?.prob ?? 0;
    const gore = result?.gore?.prob ?? 0;

    const isFlagged =
      nudityActivity > 0.5 ||
      nudityDisplay > 0.5 ||
      nudityVeryS > 0.7 ||
      offensive > 0.7 ||
      gore > 0.7;

    if (isFlagged) {
      const scores: Record<string, number> = {
        nudity_sexual_activity: nudityActivity,
        nudity_sexual_display: nudityDisplay,
        nudity_very_suggestive: nudityVeryS,
        offensive: offensive,
        gore: gore,
      };
      const topReason = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
      const topScore = scores[topReason];

      // Auto-report always
      const { error: reportError } = await supabaseAdmin.from("user_reports").insert({
        reporter_id: user.id,
        reported_user_id,
        reason: "AI_AUTO_MODERATION",
        details: `Auto-detected: ${topReason} (score: ${topScore.toFixed(2)}). Full result: ${JSON.stringify(result)}`,
      });

      if (reportError) {
        console.error("Failed to insert report:", reportError.message);
      }

      // ── Increment NSFW strike count (shadowban tracking) ──────────────────
      // Uses the increment_nsfw_strike() Postgres function (SECURITY DEFINER)
      // so the counter is updated atomically without a read-modify-write race.
      const { error: strikeError } = await supabaseAdmin.rpc("increment_nsfw_strike", {
        target_user_id: reported_user_id,
      });

      if (strikeError) {
        console.error("Failed to increment nsfw_strike_count:", strikeError.message);
      } else {
        console.log(`NSFW strike recorded for user ${reported_user_id} (${topReason}, score: ${topScore.toFixed(2)})`);
      }

      // Auto-ban if score is very high confidence (> 0.9)
      if (topScore > 0.9) {
        const { error: banError } = await supabaseAdmin.from("user_bans").insert({
          user_id: reported_user_id,
          ban_type: "explicit_content",
          reason: `AI auto-ban: ${topReason} detected with score ${topScore.toFixed(2)}. Triggered during video chat.`,
          is_active: true,
          ban_source: "ai_moderation",
        });

        if (banError) {
          console.error("Failed to insert ban:", banError.message);
        } else {
          console.log(`Auto-banned user ${reported_user_id} for ${topReason} (score: ${topScore.toFixed(2)})`);
        }
      }

      return new Response(
        JSON.stringify({ flagged: true, reason: topReason, score: topScore, autoBanned: topScore > 0.9 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({ flagged: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (err: any) {
    console.error("moderate-frame error:", err.message);
    return new Response(
      JSON.stringify({ flagged: false, error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
});