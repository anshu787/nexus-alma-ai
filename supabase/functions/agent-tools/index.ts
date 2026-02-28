import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getSupabaseAdmin();

  try {
    const body = await req.json();
    
    // Support both direct calls and Vapi's tool call format
    let tool_name: string;
    let parameters: any;
    
    if (body.message?.type === "function-call" && body.message?.functionCall) {
      // Vapi format
      tool_name = body.message.functionCall.name;
      parameters = body.message.functionCall.parameters || {};
    } else {
      // Direct format
      tool_name = body.tool_name;
      parameters = body.parameters || {};
    }

    // ── AUTHENTICATE USER BY ACCESS CODE ──
    if (tool_name === "authenticate_user") {
      const { access_code } = parameters;
      const { data: codeRecord } = await supabase
        .from("voice_access_codes")
        .select("user_id")
        .eq("access_code", access_code)
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (!codeRecord) {
        return json({ success: false, message: "Invalid or expired access code. Please try again." });
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, skills, company, designation")
        .eq("user_id", codeRecord.user_id)
        .single();

      return json({
        success: true,
        user_id: codeRecord.user_id,
        user_name: profile?.full_name || "User",
        current_skills: profile?.skills || [],
        company: profile?.company || "",
        designation: profile?.designation || "",
      });
    }

    // ── FIND MENTORS ──
    if (tool_name === "find_mentors") {
      const { skill_area } = parameters || {};
      let query = supabase
        .from("profiles")
        .select("user_id, full_name, skills, company, designation, bio")
        .eq("is_mentor", true)
        .limit(5);

      const { data: mentors } = await query;

      if (!mentors || mentors.length === 0) {
        return json({ mentors: [], message: "No mentors available right now." });
      }

      // Filter by skill if provided
      let filtered = mentors;
      if (skill_area) {
        const keyword = skill_area.toLowerCase();
        filtered = mentors.filter(m =>
          (m.skills || []).some((s: string) => s.toLowerCase().includes(keyword)) ||
          (m.bio || "").toLowerCase().includes(keyword)
        );
        if (filtered.length === 0) filtered = mentors;
      }

      return json({
        mentors: filtered.map((m, i) => ({
          number: i + 1,
          name: m.full_name,
          designation: m.designation || "Professional",
          company: m.company || "Independent",
          skills: (m.skills || []).slice(0, 5).join(", "),
          user_id: m.user_id,
        })),
        message: `Found ${filtered.length} mentors.`,
      });
    }

    // ── UPDATE SKILLS ──
    if (tool_name === "update_skills") {
      const { user_id, new_skills } = parameters;
      if (!user_id || !new_skills || !Array.isArray(new_skills)) {
        return json({ success: false, message: "user_id and new_skills array required." });
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("skills")
        .eq("user_id", user_id)
        .single();

      const existing = (profile?.skills || []) as string[];
      const merged = [...new Set([...existing, ...new_skills])];

      await supabase.from("profiles").update({ skills: merged }).eq("user_id", user_id);

      return json({
        success: true,
        message: `Skills updated. Added: ${new_skills.join(", ")}. Total skills: ${merged.length}.`,
        all_skills: merged,
      });
    }

    // ── CHECK OPPORTUNITIES ──
    if (tool_name === "check_opportunities") {
      const { data: opps } = await supabase
        .from("opportunities")
        .select("title, company, type, location, salary_range, employment_type")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(5);

      return json({
        opportunities: (opps || []).map((o, i) => ({
          number: i + 1,
          title: o.title,
          company: o.company,
          type: o.type,
          location: o.location || "Remote",
          salary: o.salary_range || "Not specified",
          employment_type: o.employment_type || "Full-time",
        })),
        message: opps?.length ? `Found ${opps.length} active opportunities.` : "No active opportunities right now.",
      });
    }

    // ── CHECK EVENTS ──
    if (tool_name === "check_events") {
      const { data: events } = await supabase
        .from("events")
        .select("id, title, start_date, location, is_virtual, event_type")
        .gte("start_date", new Date().toISOString())
        .order("start_date")
        .limit(5);

      return json({
        events: (events || []).map((e, i) => ({
          number: i + 1,
          title: e.title,
          date: new Date(e.start_date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }),
          location: e.is_virtual ? "Virtual" : (e.location || "TBD"),
          type: e.event_type,
          id: e.id,
        })),
        message: events?.length ? `Found ${events.length} upcoming events.` : "No upcoming events.",
      });
    }

    // ── SCHEDULE MENTORSHIP SESSION ──
    if (tool_name === "schedule_mentorship") {
      const { user_id, mentor_user_id, mentor_name, preferred_time } = parameters;
      if (!user_id || !mentor_user_id) {
        return json({ success: false, message: "user_id and mentor_user_id required." });
      }

      const startDate = new Date(Date.now() + 86400000).toISOString();

      await supabase.from("events").insert({
        title: `Mentorship: ${mentor_name || "Mentor"}`,
        start_date: startDate,
        event_type: "mentoring",
        created_by: user_id,
        is_virtual: true,
        description: `Voice-scheduled mentorship session. Preferred time: ${preferred_time || "flexible"}`,
      });

      return json({
        success: true,
        message: `Mentorship session with ${mentor_name || "the mentor"} has been scheduled. Details will appear in the dashboard.`,
      });
    }

    // ── SEND MESSAGE ──
    if (tool_name === "send_message") {
      const { sender_id, recipient_name, message } = parameters;
      if (!sender_id || !recipient_name || !message) {
        return json({ success: false, message: "sender_id, recipient_name, and message required." });
      }

      const { data: matches } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .ilike("full_name", `%${recipient_name}%`)
        .limit(1);

      if (!matches || matches.length === 0) {
        return json({ success: false, message: `Could not find anyone named "${recipient_name}".` });
      }

      await supabase.from("messages").insert({
        sender_id,
        receiver_id: matches[0].user_id,
        content: `[Voice message] ${message}`,
      });

      return json({
        success: true,
        message: `Message sent to ${matches[0].full_name}.`,
      });
    }

    // ── RSVP TO EVENT ──
    if (tool_name === "rsvp_event") {
      const { user_id, event_id } = parameters;
      if (!user_id || !event_id) {
        return json({ success: false, message: "user_id and event_id required." });
      }

      await supabase.from("event_rsvps").upsert({
        user_id,
        event_id,
        status: "attending",
      }, { onConflict: "user_id,event_id" }).select();

      return json({ success: true, message: "You've been RSVP'd to the event." });
    }

    // ── GET USER PROFILE ──
    if (tool_name === "get_profile") {
      const { user_id } = parameters;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, skills, company, designation, bio, location, interests, experience_years, engagement_score")
        .eq("user_id", user_id)
        .single();

      return json({
        profile: profile || null,
        message: profile ? `Profile for ${profile.full_name}.` : "Profile not found.",
      });
    }

    return json({ error: "Unknown tool_name", available_tools: [
      "authenticate_user", "find_mentors", "update_skills", "check_opportunities",
      "check_events", "schedule_mentorship", "send_message", "rsvp_event", "get_profile"
    ]}, 400);

  } catch (error) {
    console.error("Agent tools error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
