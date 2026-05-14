import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const respond = (body: object) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate caller via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return respond({ success: false, error: "Missing Authorization header" });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token);

    if (authError || !user?.id) {
      console.error("[delete-account] Auth error:", authError?.message);
      return respond({ success: false, error: "Not authenticated" });
    }

    console.log(`[delete-account] Starting deletion for user: ${user.id}`);

    // Step 1: Delete all public schema data via RPC (SECURITY DEFINER)
    const { error: rpcError } = await supabaseAdmin.rpc("delete_user_account_data", {
      target_user_id: user.id,
    });

    if (rpcError) {
      console.error("[delete-account] RPC error:", rpcError.message, rpcError.details, rpcError.hint);
      return respond({ success: false, error: `Failed to delete user data: ${rpcError.message}` });
    }

    console.log(`[delete-account] RPC succeeded. Deleting auth user: ${user.id}`);

    // Step 2: Delete auth.users entry
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteUserError) {
      console.error("[delete-account] Auth delete error:", deleteUserError.message);
      return respond({ success: false, error: `Failed to delete auth user: ${deleteUserError.message}` });
    }

    console.log(`[delete-account] Successfully deleted user: ${user.id}`);
    return respond({ success: true, message: "Account deleted successfully" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[delete-account] Unexpected error:", msg);
    return respond({ success: false, error: msg });
  }
});