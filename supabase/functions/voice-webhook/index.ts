import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// Helper: build a <Play> URL for ElevenLabs TTS instead of <Say voice="Polly.Joanna">
function playUrl(text: string): string {
  const baseUrl = Deno.env.get("SUPABASE_URL")!;
  return `${baseUrl}/functions/v1/twiml-tts?text=${encodeURIComponent(text)}`;
}

function twimlResponse(twiml: string) {
  return new Response(twiml, {
    headers: { ...corsHeaders, "Content-Type": "text/xml" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getSupabaseAdmin();
  const url = new URL(req.url);
  const action = url.pathname.split("/").pop() || "";

  const formData = await req.formData().catch(() => null);
  const body: Record<string, string> = {};
  if (formData) {
    formData.forEach((value, key) => { body[key] = String(value); });
  }

  const callSid = body.CallSid || "";
  const digits = body.Digits || "";
  const speechResult = body.SpeechResult || "";

  try {
    // ── INITIAL CALL ──
    if (action === "incoming" || action === "voice-webhook") {
      await supabase.from("call_sessions").insert({
        twilio_call_sid: callSid,
        status: "greeting",
        call_type: "inbound",
      });

      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${playUrl("Welcome to the Alumni Intelligence Platform. I am your AI operator.")}</Play>
  <Pause length="1"/>
  <Play>${playUrl("Please speak or enter your 6-digit access code to authenticate.")}</Play>
  <Gather input="dtmf speech" numDigits="6" timeout="10" speechTimeout="5" action="/voice-webhook/authenticate">
    <Play>${playUrl("I'm listening for your access code.")}</Play>
  </Gather>
  <Play>${playUrl("I didn't receive an access code. Goodbye.")}</Play>
</Response>`);
    }

    // ── AUTHENTICATION ──
    if (action === "authenticate") {
      const accessCode = digits || speechResult.replace(/\s/g, "");

      const { data: codeRecord } = await supabase
        .from("voice_access_codes")
        .select("*")
        .eq("access_code", accessCode)
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (!codeRecord) {
        await supabase.from("call_sessions").update({ status: "auth_failed" }).eq("twilio_call_sid", callSid);

        return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${playUrl("I couldn't verify that access code. Let me try again.")}</Play>
  <Gather input="dtmf speech" numDigits="6" timeout="10" speechTimeout="5" action="/voice-webhook/authenticate">
    <Play>${playUrl("Please speak or enter your access code.")}</Play>
  </Gather>
  <Play>${playUrl("Authentication failed. Goodbye.")}</Play>
</Response>`);
      }

      const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", codeRecord.user_id).single();

      await supabase.from("call_sessions").update({ user_id: codeRecord.user_id, status: "authenticated" }).eq("twilio_call_sid", callSid);

      const userName = profile?.full_name || "there";

      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${playUrl(`Welcome back, ${userName}. You are now authenticated.`)}</Play>
  <Pause length="1"/>
  <Play>${playUrl("How can I help you today? You can say things like: update my skills, find a mentor, schedule a session, check opportunities, or send a message.")}</Play>
  <Gather input="speech" timeout="10" speechTimeout="3" action="/voice-webhook/process-intent">
    <Play>${playUrl("I'm listening.")}</Play>
  </Gather>
  <Play>${playUrl("I didn't hear anything. Goodbye.")}</Play>
</Response>`);
    }

    // ── INTENT PROCESSING ──
    if (action === "process-intent") {
      const speech = speechResult.toLowerCase();

      const { data: session } = await supabase.from("call_sessions").select("user_id, metadata").eq("twilio_call_sid", callSid).single();
      if (!session?.user_id) {
        return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Play>${playUrl("Your session has expired. Please call again.")}</Play></Response>`);
      }

      const userId = session.user_id;

      // UPDATE SKILLS
      if (speech.includes("skill") || speech.includes("learn") || speech.includes("update")) {
        await supabase.from("call_sessions").update({ intent: "update_skills" }).eq("twilio_call_sid", callSid);
        return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${playUrl("Sure, I can update your skills. Please tell me the skills you'd like to add to your profile.")}</Play>
  <Gather input="speech" timeout="15" speechTimeout="4" action="/voice-webhook/update-skills">
    <Play>${playUrl("Go ahead, I'm listening.")}</Play>
  </Gather>
</Response>`);
      }

      // FIND MENTOR
      if (speech.includes("mentor") || speech.includes("find") || speech.includes("guidance")) {
        await supabase.from("call_sessions").update({ intent: "find_mentor" }).eq("twilio_call_sid", callSid);

        const { data: mentors } = await supabase.from("profiles").select("user_id, full_name, skills, company, designation").eq("is_mentor", true).limit(5);

        const sessData = await supabase.from("call_sessions").select("id").eq("twilio_call_sid", callSid).single();
        await supabase.from("call_action_logs").insert({
          call_session_id: sessData.data?.id,
          action: "find_mentors",
          endpoint: "GET /profiles?is_mentor=true",
          response_status: 200,
          response_summary: `Found ${mentors?.length || 0} mentors`,
        });

        if (!mentors || mentors.length === 0) {
          return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${playUrl("I couldn't find any mentors available right now. Would you like to do something else?")}</Play>
  <Gather input="speech" timeout="10" speechTimeout="3" action="/voice-webhook/process-intent">
    <Play>${playUrl("What would you like to do?")}</Play>
  </Gather>
</Response>`);
        }

        await supabase.from("call_sessions").update({
          metadata: { ...(session.metadata as Record<string, unknown> || {}), mentors: mentors.map((m, i) => ({ index: i + 1, ...m })) },
        }).eq("twilio_call_sid", callSid);

        let mentorList = "";
        mentors.forEach((m, i) => {
          mentorList += `<Play>${playUrl(`Option ${i + 1}: ${m.full_name}, ${m.designation || "Professional"} at ${m.company || "their organization"}.`)}</Play><Pause length="1"/>`;
        });

        return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${playUrl(`I found ${mentors.length} mentors for you. Here they are:`)}</Play>
  <Pause length="1"/>
  ${mentorList}
  <Play>${playUrl("Which mentor would you like to connect with? Say the option number, or say schedule to set up a session.")}</Play>
  <Gather input="speech dtmf" numDigits="1" timeout="10" speechTimeout="3" action="/voice-webhook/select-mentor">
    <Play>${playUrl("I'm waiting for your selection.")}</Play>
  </Gather>
</Response>`);
      }

      // CHECK OPPORTUNITIES
      if (speech.includes("opportunit") || speech.includes("job") || speech.includes("career")) {
        await supabase.from("call_sessions").update({ intent: "check_opportunities" }).eq("twilio_call_sid", callSid);
        const { data: opps } = await supabase.from("opportunities").select("title, company, type, location").eq("is_active", true).limit(3);

        if (!opps || opps.length === 0) {
          return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${playUrl("There are no active opportunities right now. Would you like to do something else?")}</Play>
  <Gather input="speech" timeout="10" speechTimeout="3" action="/voice-webhook/process-intent">
    <Play>${playUrl("What else can I help with?")}</Play>
  </Gather>
</Response>`);
        }

        let oppList = "";
        opps.forEach((o, i) => {
          oppList += `<Play>${playUrl(`${i + 1}. ${o.title} at ${o.company}, located in ${o.location || "remote"}.`)}</Play><Pause length="1"/>`;
        });

        return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${playUrl("Here are the latest opportunities:")}</Play>
  ${oppList}
  <Play>${playUrl("Would you like more details, or is there anything else I can help with?")}</Play>
  <Gather input="speech" timeout="10" speechTimeout="3" action="/voice-webhook/process-intent">
    <Play>${playUrl("I'm listening.")}</Play>
  </Gather>
</Response>`);
      }

      // CHECK EVENTS
      if (speech.includes("event") || speech.includes("meetup") || speech.includes("gathering")) {
        const { data: events } = await supabase.from("events").select("title, start_date, location, is_virtual").gte("start_date", new Date().toISOString()).order("start_date").limit(3);

        let eventList = "";
        (events || []).forEach((e, i) => {
          const date = new Date(e.start_date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
          eventList += `<Play>${playUrl(`${i + 1}. ${e.title} on ${date}, ${e.is_virtual ? "virtual event" : `at ${e.location || "location TBD"}`}.`)}</Play><Pause length="1"/>`;
        });

        return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${playUrl(events?.length ? `Here are ${events.length} upcoming events:` : "There are no upcoming events.")}</Play>
  ${eventList}
  <Play>${playUrl("Would you like to RSVP to any event, or is there anything else?")}</Play>
  <Gather input="speech" timeout="10" speechTimeout="3" action="/voice-webhook/process-intent">
    <Play>${playUrl("What would you like to do?")}</Play>
  </Gather>
</Response>`);
      }

      // SEND MESSAGE
      if (speech.includes("message") || speech.includes("send") || speech.includes("contact")) {
        return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${playUrl("Who would you like to send a message to? Please say their name.")}</Play>
  <Gather input="speech" timeout="10" speechTimeout="3" action="/voice-webhook/find-recipient">
    <Play>${playUrl("I'm listening for the name.")}</Play>
  </Gather>
</Response>`);
      }

      // END CALL
      if (speech.includes("bye") || speech.includes("end") || speech.includes("done") || speech.includes("thank")) {
        await supabase.from("call_sessions").update({ status: "completed", ended_at: new Date().toISOString() }).eq("twilio_call_sid", callSid);
        return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Play>${playUrl("Thank you for using the Alumni Intelligence Platform. Have a great day!")}</Play></Response>`);
      }

      // FALLBACK
      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${playUrl("I'm sorry, I didn't quite understand that. You can say: update skills, find a mentor, check opportunities, view events, or send a message.")}</Play>
  <Gather input="speech" timeout="10" speechTimeout="3" action="/voice-webhook/process-intent">
    <Play>${playUrl("What would you like to do?")}</Play>
  </Gather>
</Response>`);
    }

    // ── UPDATE SKILLS ──
    if (action === "update-skills") {
      const { data: session } = await supabase.from("call_sessions").select("user_id").eq("twilio_call_sid", callSid).single();

      if (session?.user_id) {
        const newSkills = speechResult.split(/,| and | & /).map((s: string) => s.trim()).filter(Boolean);
        const { data: profile } = await supabase.from("profiles").select("skills").eq("user_id", session.user_id).single();
        const existingSkills = (profile?.skills || []) as string[];
        const mergedSkills = [...new Set([...existingSkills, ...newSkills])];

        await supabase.from("profiles").update({ skills: mergedSkills }).eq("user_id", session.user_id);

        const { data: sess } = await supabase.from("call_sessions").select("id").eq("twilio_call_sid", callSid).single();
        await supabase.from("call_action_logs").insert({
          call_session_id: sess?.id,
          action: "update_skills",
          endpoint: `PUT /profiles/${session.user_id}`,
          request_body: { skills: newSkills },
          response_status: 200,
          response_summary: `Updated skills: ${newSkills.join(", ")}`,
        });

        return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${playUrl(`Your skills have been updated. I've added ${newSkills.join(", ")} to your profile.`)}</Play>
  <Pause length="1"/>
  <Play>${playUrl("Is there anything else I can help you with?")}</Play>
  <Gather input="speech" timeout="10" speechTimeout="3" action="/voice-webhook/process-intent">
    <Play>${playUrl("I'm listening.")}</Play>
  </Gather>
</Response>`);
      }
    }

    // ── SELECT MENTOR ──
    if (action === "select-mentor") {
      const { data: session } = await supabase.from("call_sessions").select("user_id, metadata").eq("twilio_call_sid", callSid).single();
      const selection = digits || speechResult.replace(/\D/g, "");
      const mentors = ((session?.metadata as Record<string, unknown>)?.mentors || []) as Array<{ index: number; user_id: string; full_name: string }>;
      const selectedMentor = mentors.find((m) => m.index === parseInt(selection));

      if (!selectedMentor || !session?.user_id) {
        return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${playUrl("I couldn't identify that selection. Please try again.")}</Play>
  <Gather input="speech dtmf" numDigits="1" timeout="10" action="/voice-webhook/select-mentor">
    <Play>${playUrl("Which mentor number?")}</Play>
  </Gather>
</Response>`);
      }

      await supabase.from("call_sessions").update({
        metadata: { ...(session.metadata as Record<string, unknown> || {}), selected_mentor: selectedMentor },
      }).eq("twilio_call_sid", callSid);

      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${playUrl(`You've selected ${selectedMentor.full_name}. Would you like to schedule a mentorship session with them? Say yes or no.`)}</Play>
  <Gather input="speech" timeout="10" speechTimeout="3" action="/voice-webhook/confirm-schedule">
    <Play>${playUrl("Would you like to schedule?")}</Play>
  </Gather>
</Response>`);
    }

    // ── CONFIRM SCHEDULE ──
    if (action === "confirm-schedule") {
      const answer = speechResult.toLowerCase();
      if (answer.includes("yes") || answer.includes("sure") || answer.includes("okay")) {
        return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${playUrl("When would you like to schedule the session? Please say the day and time, for example, tomorrow at 3 PM.")}</Play>
  <Gather input="speech" timeout="15" speechTimeout="5" action="/voice-webhook/schedule-session">
    <Play>${playUrl("I'm listening for the date and time.")}</Play>
  </Gather>
</Response>`);
      }

      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${playUrl("No problem. Is there anything else I can help you with?")}</Play>
  <Gather input="speech" timeout="10" speechTimeout="3" action="/voice-webhook/process-intent">
    <Play>${playUrl("What would you like to do?")}</Play>
  </Gather>
</Response>`);
    }

    // ── SCHEDULE SESSION ──
    if (action === "schedule-session") {
      const { data: session } = await supabase.from("call_sessions").select("user_id, metadata").eq("twilio_call_sid", callSid).single();
      const mentor = (session?.metadata as Record<string, unknown>)?.selected_mentor as { user_id: string; full_name: string } | undefined;

      if (!session?.user_id || !mentor) {
        return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${playUrl("I lost the session context. Let me take you back to the main menu.")}</Play>
  <Gather input="speech" timeout="10" speechTimeout="3" action="/voice-webhook/process-intent">
    <Play>${playUrl("What would you like to do?")}</Play>
  </Gather>
</Response>`);
      }

      // Create event
      const startDate = new Date(Date.now() + 86400000).toISOString();
      await supabase.from("events").insert({
        title: `Mentorship: ${mentor.full_name}`,
        start_date: startDate,
        event_type: "mentoring",
        created_by: session.user_id,
        is_virtual: true,
        description: `Voice-scheduled mentorship session. Requested time: ${speechResult}`,
      });

      const { data: sess } = await supabase.from("call_sessions").select("id").eq("twilio_call_sid", callSid).single();
      await supabase.from("call_action_logs").insert({
        call_session_id: sess?.id,
        action: "schedule_session",
        endpoint: "POST /events",
        response_status: 201,
        response_summary: `Scheduled mentorship with ${mentor.full_name}`,
      });

      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${playUrl(`I've scheduled a mentorship session with ${mentor.full_name}. You mentioned ${speechResult}. The details will appear in your dashboard.`)}</Play>
  <Pause length="1"/>
  <Play>${playUrl("Is there anything else I can help you with?")}</Play>
  <Gather input="speech" timeout="10" speechTimeout="3" action="/voice-webhook/process-intent">
    <Play>${playUrl("I'm listening.")}</Play>
  </Gather>
</Response>`);
    }

    // ── FIND RECIPIENT ──
    if (action === "find-recipient") {
      const { data: session } = await supabase.from("call_sessions").select("user_id, metadata").eq("twilio_call_sid", callSid).single();
      const { data: matches } = await supabase.from("profiles").select("user_id, full_name").ilike("full_name", `%${speechResult}%`).limit(1);

      if (!matches || matches.length === 0) {
        return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${playUrl(`I couldn't find anyone named ${speechResult}. Would you like to try another name?`)}</Play>
  <Gather input="speech" timeout="10" speechTimeout="3" action="/voice-webhook/find-recipient">
    <Play>${playUrl("Say the name.")}</Play>
  </Gather>
</Response>`);
      }

      await supabase.from("call_sessions").update({
        intent: "send_message",
        metadata: { ...(session?.metadata as Record<string, unknown> || {}), recipient: matches[0] },
      }).eq("twilio_call_sid", callSid);

      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${playUrl(`I found ${matches[0].full_name}. What message would you like to send?`)}</Play>
  <Gather input="speech" timeout="15" speechTimeout="5" action="/voice-webhook/send-message">
    <Play>${playUrl("Go ahead with your message.")}</Play>
  </Gather>
</Response>`);
    }

    // ── SEND MESSAGE ──
    if (action === "send-message") {
      const { data: session } = await supabase.from("call_sessions").select("user_id, metadata").eq("twilio_call_sid", callSid).single();
      const recipient = (session?.metadata as Record<string, unknown>)?.recipient as { user_id: string; full_name: string } | undefined;

      if (!session?.user_id || !recipient) {
        return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${playUrl("Something went wrong. Let me take you back.")}</Play>
  <Gather input="speech" timeout="10" speechTimeout="3" action="/voice-webhook/process-intent">
    <Play>${playUrl("What would you like to do?")}</Play>
  </Gather>
</Response>`);
      }

      await supabase.from("messages").insert({
        sender_id: session.user_id,
        receiver_id: recipient.user_id,
        content: `[Voice message] ${speechResult}`,
      });

      const { data: sess } = await supabase.from("call_sessions").select("id").eq("twilio_call_sid", callSid).single();
      await supabase.from("call_action_logs").insert({
        call_session_id: sess?.id,
        action: "send_message",
        endpoint: "POST /messages",
        response_status: 201,
        response_summary: `Sent message to ${recipient.full_name}`,
      });

      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${playUrl(`Your message has been sent to ${recipient.full_name}.`)}</Play>
  <Pause length="1"/>
  <Play>${playUrl("Is there anything else I can help you with?")}</Play>
  <Gather input="speech" timeout="10" speechTimeout="3" action="/voice-webhook/process-intent">
    <Play>${playUrl("I'm listening.")}</Play>
  </Gather>
</Response>`);
    }

    // ── STATUS CALLBACK ──
    if (action === "status-callback") {
      const callStatus = body.CallStatus || "";
      const duration = parseInt(body.CallDuration || "0", 10);

      if (callStatus === "completed" || callStatus === "failed" || callStatus === "no-answer") {
        await supabase.from("call_sessions").update({
          status: "completed",
          ended_at: new Date().toISOString(),
          duration_seconds: duration || null,
        }).eq("twilio_call_sid", callSid);
      }

      return new Response("OK", { headers: corsHeaders });
    }

    // ── RECORDING CALLBACK ──
    if (action === "recording-callback") {
      const recordingUrl = body.RecordingUrl || "";
      if (recordingUrl && callSid) {
        await supabase.from("call_sessions").update({ recording_url: recordingUrl }).eq("twilio_call_sid", callSid);
      }
      return new Response("OK", { headers: corsHeaders });
    }

    return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Play>${playUrl("Something went wrong. Goodbye.")}</Play></Response>`);
  } catch (error) {
    console.error("Voice webhook error:", error);
    return new Response("Error", { status: 500, headers: corsHeaders });
  }
});
