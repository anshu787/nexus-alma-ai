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

function playUrl(text: string): string {
  const baseUrl = Deno.env.get("SUPABASE_URL")!;
  return `${baseUrl}/functions/v1/twiml-tts?text=${encodeURIComponent(text)}`;
}

async function makeCall(to: string, twimlUrl: string) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
  const fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER")!;

  const params = new URLSearchParams({
    To: to,
    From: fromNumber,
    Url: twimlUrl,
    StatusCallback: `${Deno.env.get("SUPABASE_URL")}/functions/v1/voice-webhook/status-callback`,
    Record: "true",
    RecordingStatusCallback: `${Deno.env.get("SUPABASE_URL")}/functions/v1/voice-webhook/recording-callback`,
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  );

  return response.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getSupabaseAdmin();

  try {
    const { action, user_id, event_id, phone_number, message } = await req.json();

    // ── REMINDER CALL ──
    if (action === "reminder") {
      if (!phone_number || !event_id) return json({ error: "phone_number and event_id required" }, 400);

      const { data: event } = await supabase.from("events").select("title, start_date").eq("id", event_id).single();
      if (!event) return json({ error: "Event not found" }, 404);

      const twimlUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/voice-outbound/reminder-twiml?event_title=${encodeURIComponent(event.title)}&start_date=${encodeURIComponent(event.start_date)}`;
      const callResult = await makeCall(phone_number, twimlUrl);

      await supabase.from("scheduled_calls").update({ status: "called", twilio_call_sid: callResult.sid }).eq("event_id", event_id).eq("user_id", user_id);

      await supabase.from("call_sessions").insert({
        user_id,
        twilio_call_sid: callResult.sid,
        status: "initiated",
        call_type: "reminder",
        intent: "session_reminder",
        metadata: { event_id, event_title: event.title },
      });

      return json({ success: true, call_sid: callResult.sid });
    }

    // ── REMINDER TWIML (served to Twilio) ──
    if (action === "reminder-twiml") {
      const url = new URL(req.url);
      const eventTitle = url.searchParams.get("event_title") || "your session";
      const startDate = url.searchParams.get("start_date");
      const timeStr = startDate
        ? new Date(startDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
        : "shortly";

      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${playUrl("Hello! This is a reminder from the Alumni Intelligence Platform.")}</Play>
  <Pause length="1"/>
  <Play>${playUrl(`Your session, ${eventTitle}, is starting at ${timeStr}.`)}</Play>
  <Pause length="1"/>
  <Play>${playUrl("Are you available? Press 1 for yes, or press 2 to request a reschedule.")}</Play>
  <Gather input="dtmf" numDigits="1" timeout="10" action="${Deno.env.get("SUPABASE_URL")}/functions/v1/voice-outbound/reminder-response">
    <Play>${playUrl("Please press 1 or 2.")}</Play>
  </Gather>
  <Play>${playUrl("I didn't receive a response. We'll assume you're available. See you soon!")}</Play>
</Response>`,
        { headers: { ...corsHeaders, "Content-Type": "text/xml" } }
      );
    }

    // ── REMINDER RESPONSE ──
    if (action === "reminder-response") {
      const formData = await req.formData().catch(() => null);
      const digit = formData?.get("Digits")?.toString() || "";

      if (digit === "1") {
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>
<Response><Play>${playUrl("Great! We'll connect you when the session starts. Thank you!")}</Play></Response>`,
          { headers: { ...corsHeaders, "Content-Type": "text/xml" } }
        );
      }

      if (digit === "2") {
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>
<Response><Play>${playUrl("I understand. We'll notify the other participant about the reschedule. Thank you!")}</Play></Response>`,
          { headers: { ...corsHeaders, "Content-Type": "text/xml" } }
        );
      }
    }

    // ── BRIDGE CALL ──
    if (action === "bridge") {
      if (!phone_number) return json({ error: "phone_number required" }, 400);

      const twimlUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/voice-outbound/bridge-twiml?message=${encodeURIComponent(message || "Connecting you to your mentorship session.")}`;
      const callResult = await makeCall(phone_number, twimlUrl);

      return json({ success: true, call_sid: callResult.sid });
    }

    // ── BRIDGE TWIML ──
    if (action === "bridge-twiml") {
      const url = new URL(req.url);
      const msg = url.searchParams.get("message") || "Connecting you now.";

      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${playUrl(msg)}</Play>
  <Dial timeout="30" timeLimit="1800" record="record-from-answer-dual" recordingStatusCallback="${Deno.env.get("SUPABASE_URL")}/functions/v1/voice-webhook/recording-callback">
    <Conference>mentorship-session</Conference>
  </Dial>
  <Play>${playUrl("The session has ended. Thank you for participating!")}</Play>
</Response>`,
        { headers: { ...corsHeaders, "Content-Type": "text/xml" } }
      );
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("Voice outbound error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
