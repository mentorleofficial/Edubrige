import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { application_id, admin_notes } = body || {};
    if (!application_id) {
      return new Response(JSON.stringify({ error: "application_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The whole approval (role, user, mentor profile, application status, history
    // cleanup, audit, sync event) runs in ONE database transaction, so a failure
    // part-way can never leave a mentor activated with a still-"pending" application.
    const { data: result, error: txErr } = await admin.rpc("approve_mentor_application_tx", {
      _application_id: application_id,
      _admin_id: userData.user.id,
      _admin_notes: admin_notes ?? null,
    });
    if (txErr) {
      const msg = txErr.message ?? "Approval failed";
      const status = /not found|no user account/i.test(msg) ? 404 : /already reviewed/i.test(msg) ? 400 : 500;
      return new Response(JSON.stringify({ error: msg }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const mentorUserId = (result as { mentor_user_id?: string } | null)?.mentor_user_id ?? null;

    // Fire decision email (don't fail approval if email fails)
    try {
      await admin.functions.invoke("mentor-application-decision-email", {
        body: { application_id, decision: "approved", notes: admin_notes ?? "" },
        headers: { Authorization: authHeader },
      });
    } catch (e) {
      console.warn("decision email failed", e);
    }

    return new Response(JSON.stringify({ success: true, mentor_user_id: mentorUserId }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
