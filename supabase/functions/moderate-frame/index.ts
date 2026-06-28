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
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY") ?? "";

    if (!geminiApiKey) {
      console.error("GEMINI_API_KEY not configured");
      return new Response(
        JSON.stringify({ flagged: false, error: "Gemini API key not configured" }),
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

    console.log(`[moderate-frame] Processing frame for user: ${reported_user_id}`);

    // Call Gemini API
    const prompt = `Analyze this image for NSFW content (nudity, sexual activity, gore, offensive content). 
Return a JSON object with:
- "flagged": boolean (true if any NSFW content is detected)
- "reason": string (short description of what was detected: "nudity", "sexual_activity", "gore", "offensive", or "none")
- "confidence": number (float between 0 and 1 representing your confidence level)

Strictly return ONLY valid JSON.`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: frame,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            response_mime_type: "application/json",
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error:", errText);
      return new Response(
        JSON.stringify({ flagged: false, error: "Gemini API error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const geminiData = await geminiRes.json();
    const resultText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!resultText) {
      throw new Error("Invalid response from Gemini API");
    }

    let result;
    try {
      result = JSON.parse(resultText);
    } catch (e) {
      console.error("Failed to parse Gemini response as JSON:", resultText);
      throw new Error("Failed to parse Gemini response");
    }

    const { flagged, reason, confidence } = result;

    if (flagged) {
      // Auto-report always
      const { error: reportError } = await supabaseAdmin.from("user_reports").insert({
        reporter_id: user.id,
        reported_user_id,
        reason: "AI_AUTO_MODERATION",
        details: `Auto-detected: ${reason} (confidence: ${confidence}). Full Gemini response: ${JSON.stringify(result)}`,
      });

      if (reportError) {
        console.error("Failed to insert report:", reportError.message);
      }

      const { error: strikeError } = await supabaseAdmin.rpc("increment_nsfw_strike", {
        target_user_id: reported_user_id,
      });

      if (strikeError) {
        console.error("Failed to increment nsfw_strike_count:", strikeError.message);
      }

      // Auto-ban if confidence > 0.9
      if (confidence > 0.9) {
        const { error: banError } = await supabaseAdmin.from("user_bans").insert({
          user_id: reported_user_id,
          ban_type: "explicit_content",
          reason: `AI auto-ban: ${reason} detected with confidence ${confidence}. Triggered during video chat.`,
          is_active: true,
          ban_source: "ai_moderation",
        });

        if (banError) {
          console.error("Failed to insert ban:", banError.message);
        }
      }

      return new Response(
        JSON.stringify({ flagged: true, reason, score: confidence, autoBanned: confidence > 0.9 }),
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