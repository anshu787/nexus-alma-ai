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
  const url = new URL(req.url);
  const action = url.pathname.split("/").pop() || "";

  try {
    // ── CALL STARTED (ElevenLabs webhook) ──
    // ElevenLabs sends this when a conversation begins on a phone call
    if (action === "call-started" || (req.method === "POST" && action === "elevenlabs-call-webhook")) {
      const body = await req.json().catch(() => ({}));

      const {
        conversation_id,
        agent_id,
        call_sid,        // Twilio call SID if available
        caller_number,   // The phone number that called
        called_number,   // The Twilio number that was called
        direction,       // inbound or outbound
      } = body;

      const { data, error } = await supabase.from("call_sessions").insert({
        twilio_call_sid: call_sid || conversation_id || `el_${Date.now()}`,
        status: "authenticated",
        call_type: direction || "inbound",
        intent: "elevenlabs_agent",
        metadata: {
          conversation_id,
          agent_id,
          caller_number,
          called_number,
          source: "elevenlabs_agent",
        },
      }).select("id").single();

      console.log("Call session created:", data, error);

      return json({
        success: true,
        session_id: data?.id,
        message: "Call session logged",
      });
    }

    // ── CALL ENDED (ElevenLabs webhook) ──
    if (action === "call-ended") {
      const body = await req.json().catch(() => ({}));

      const {
        conversation_id,
        call_sid,
        duration_seconds,
        transcript,
        summary,
        recording_url,
      } = body;

      const identifier = call_sid || conversation_id;
      if (!identifier) return json({ error: "conversation_id or call_sid required" }, 400);

      // Try to find by twilio_call_sid first, then by conversation_id in metadata
      let updateQuery = supabase
        .from("call_sessions")
        .update({
          status: "completed",
          ended_at: new Date().toISOString(),
          duration_seconds: duration_seconds || null,
          transcript: transcript || null,
          summary: summary || null,
          recording_url: recording_url || null,
        })
        .eq("twilio_call_sid", identifier);

      const { data, error } = await updateQuery.select("id").single();

      if (error) {
        // Fallback: search by conversation_id in metadata
        const { data: sessions } = await supabase
          .from("call_sessions")
          .select("id")
          .contains("metadata", { conversation_id })
          .limit(1);

        if (sessions && sessions.length > 0) {
          await supabase.from("call_sessions").update({
            status: "completed",
            ended_at: new Date().toISOString(),
            duration_seconds: duration_seconds || null,
            transcript: transcript || null,
            summary: summary || null,
            recording_url: recording_url || null,
          }).eq("id", sessions[0].id);
        }
      }

      return json({ success: true, message: "Call session updated" });
    }

    // ── TOOL EXECUTION LOG ──
    // Log when the agent executes a tool during a phone call
    if (action === "log-tool") {
      const body = await req.json().catch(() => ({}));
      const { conversation_id, call_sid, tool_name, parameters, result } = body;

      const identifier = call_sid || conversation_id;

      // Find session
      const { data: session } = await supabase
        .from("call_sessions")
        .select("id")
        .eq("twilio_call_sid", identifier)
        .single();

      if (session) {
        await supabase.from("call_action_logs").insert({
          call_session_id: session.id,
          action: tool_name,
          endpoint: `POST /agent-tools`,
          request_body: parameters,
          response_status: 200,
          response_summary: typeof result === "string" ? result : JSON.stringify(result)?.slice(0, 200),
        });
      }

      return json({ success: true });
    }

    // ── MAKE OUTBOUND CALL VIA ELEVENLABS ──
    if (action === "outbound") {
      const body = await req.json();
      const { phone_number, agent_id, user_id } = body;

      if (!phone_number || !agent_id) {
        return json({ error: "phone_number and agent_id required" }, 400);
      }

      const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
      if (!ELEVENLABS_API_KEY) {
        return json({ error: "ELEVENLABS_API_KEY not configured" }, 500);
      }

      // Use ElevenLabs API to initiate outbound call
      // First, we need the phone number ID from ElevenLabs
      // Get imported phone numbers
      const numbersRes = await fetch(
        "https://api.elevenlabs.io/v1/convai/phone-numbers",
        { headers: { "xi-api-key": ELEVENLABS_API_KEY } }
      );

      if (!numbersRes.ok) {
        const err = await numbersRes.text();
        return json({ error: "Failed to fetch phone numbers from ElevenLabs", details: err }, 500);
      }

      const numbersData = await numbersRes.json();
      const phoneNumbers = numbersData.phone_numbers || numbersData || [];

      if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
        return json({
          error: "No phone numbers imported in ElevenLabs. Import your Twilio number first.",
          help: "Go to ElevenLabs → Conversational AI → Phone Numbers → Import Twilio Number",
        }, 400);
      }

      // Use the first available phone number
      const fromNumber = phoneNumbers[0];
      const phoneNumberId = fromNumber.phone_number_id || fromNumber.id;

      // Initiate outbound call
      const callRes = await fetch(
        `https://api.elevenlabs.io/v1/convai/phone-numbers/${phoneNumberId}/outbound-call`,
        {
          method: "POST",
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agent_id,
            to: phone_number,
          }),
        }
      );

      if (!callRes.ok) {
        const err = await callRes.text();
        console.error("Outbound call error:", err);
        return json({ error: "Failed to initiate outbound call", details: err }, callRes.status);
      }

      const callData = await callRes.json();

      // Log the call session
      await supabase.from("call_sessions").insert({
        user_id: user_id || null,
        twilio_call_sid: callData.call_sid || callData.conversation_id || `el_out_${Date.now()}`,
        status: "initiated",
        call_type: "outbound",
        intent: "elevenlabs_agent",
        metadata: {
          conversation_id: callData.conversation_id,
          agent_id,
          target_number: phone_number,
          source: "elevenlabs_outbound",
          phone_number_id: phoneNumberId,
        },
      });

      return json({
        success: true,
        message: `Outbound call initiated to ${phone_number}`,
        call_data: callData,
      });
    }

    // ── LIST IMPORTED PHONE NUMBERS ──
    if (action === "phone-numbers") {
      const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
      if (!ELEVENLABS_API_KEY) {
        return json({ error: "ELEVENLABS_API_KEY not configured" }, 500);
      }

      const res = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", {
        headers: { "xi-api-key": ELEVENLABS_API_KEY },
      });

      if (!res.ok) {
        return json({ error: "Failed to fetch phone numbers", details: await res.text() }, 500);
      }

      const data = await res.json();
      return json(data);
    }

    return json({ error: "Unknown action. Use: call-started, call-ended, log-tool, outbound, phone-numbers" }, 400);
  } catch (error) {
    console.error("Call webhook error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
