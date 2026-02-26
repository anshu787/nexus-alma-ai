import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceKey);

  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Find inactive users (last_login > 90 days or null)
    const { data: inactiveProfiles, error } = await adminClient
      .from("profiles")
      .select("user_id, full_name, last_login, skills, interests, industry")
      .or(`last_login.is.null,last_login.lt.${ninetyDaysAgo}`)
      .limit(50);

    if (error) return json({ error: error.message }, 400);
    if (!inactiveProfiles || inactiveProfiles.length === 0) {
      return json({ message: "No inactive users found", notified: 0 });
    }

    // Get upcoming events for suggestions
    const { data: upcomingEvents } = await adminClient
      .from("events")
      .select("id, title, event_type, start_date")
      .gte("start_date", new Date().toISOString())
      .order("start_date")
      .limit(5);

    // Get active opportunities
    const { data: activeOpps } = await adminClient
      .from("opportunities")
      .select("id, title, company, type")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(5);

    // Get available mentors
    const { data: mentors } = await adminClient
      .from("profiles")
      .select("user_id, full_name, company, designation")
      .eq("is_mentor", true)
      .limit(5);

    let notifiedCount = 0;

    // Check if we already sent a notification recently (avoid spam)
    for (const profile of inactiveProfiles) {
      const { data: recentNotif } = await adminClient
        .from("notifications")
        .select("id")
        .eq("user_id", profile.user_id)
        .eq("type", "reengagement")
        .gte("created_at", thirtyDaysAgo)
        .limit(1);

      if (recentNotif && recentNotif.length > 0) continue; // Already notified recently

      // Build personalized message
      const suggestions: string[] = [];
      if (upcomingEvents && upcomingEvents.length > 0) {
        suggestions.push(`📅 ${upcomingEvents[0].title} is coming up`);
      }
      if (activeOpps && activeOpps.length > 0) {
        suggestions.push(`💼 New opportunity: ${activeOpps[0].title} at ${activeOpps[0].company}`);
      }
      if (mentors && mentors.length > 0) {
        suggestions.push(`👥 Connect with ${mentors[0].full_name} (${mentors[0].designation})`);
      }

      const message = suggestions.length > 0
        ? `We've missed you! Here's what's new:\n${suggestions.join("\n")}`
        : "We've missed you! Check out new events, opportunities, and mentors waiting for you.";

      const { error: insertError } = await adminClient
        .from("notifications")
        .insert({
          user_id: profile.user_id,
          type: "reengagement",
          title: `Welcome back, ${profile.full_name || "Alumni"}! 🎉`,
          message,
          link: "/dashboard",
        });

      if (!insertError) notifiedCount++;
    }

    return json({
      message: `Predictive alerts sent`,
      inactive_found: inactiveProfiles.length,
      notified: notifiedCount,
      skipped: inactiveProfiles.length - notifiedCount,
    });
  } catch (e) {
    console.error("predictive-alerts error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
