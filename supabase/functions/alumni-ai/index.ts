import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Get alumni data from database for context
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("full_name, company, designation, industry, skills, location, is_hiring, is_mentor, batch, department")
      .limit(100);

    const { data: opportunities } = await supabase
      .from("opportunities")
      .select("title, company, type, location, skills_required")
      .eq("is_active", true)
      .limit(50);

    const { data: events } = await supabase
      .from("events")
      .select("title, event_type, start_date, location")
      .gte("start_date", new Date().toISOString())
      .limit(20);

    const alumniContext = profiles?.map(p =>
      `${p.full_name} | ${p.designation || ''} at ${p.company || 'N/A'} | ${p.industry || ''} | Skills: ${(p.skills || []).join(', ')} | Location: ${p.location || ''} | Hiring: ${p.is_hiring} | Mentor: ${p.is_mentor} | Batch: ${p.batch || ''} | Dept: ${p.department || ''}`
    ).join('\n') || 'No alumni data available yet.';

    const oppsContext = opportunities?.map(o =>
      `${o.title} at ${o.company} (${o.type}) | Location: ${o.location || 'Remote'} | Skills: ${(o.skills_required || []).join(', ')}`
    ).join('\n') || 'No opportunities available yet.';

    const eventsContext = events?.map(e =>
      `${e.title} (${e.event_type}) | ${e.start_date} | ${e.location || 'Virtual'}`
    ).join('\n') || 'No upcoming events.';

    const systemPrompt = `You are AlumniOS AI Assistant — an intelligent alumni network assistant. You help users find alumni, mentors, job opportunities, events, and career guidance.

ALUMNI DATABASE:
${alumniContext}

ACTIVE OPPORTUNITIES:
${oppsContext}

UPCOMING EVENTS:
${eventsContext}

INSTRUCTIONS:
- Answer natural language queries about alumni, mentors, jobs, and events
- When asked to find alumni, search the database above and return matches
- Suggest mentors based on skills and industry alignment
- Recommend opportunities based on user interests
- Be concise, helpful, and professional
- If no data matches, say so honestly and suggest the user check back later
- Format responses with markdown for readability`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("alumni-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
