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

  // Parse form data from Twilio
  const formData = await req.formData().catch(() => null);
  const body: Record<string, string> = {};
  if (formData) {
    formData.forEach((value, key) => {
      body[key] = String(value);
    });
  }

  const callSid = body.CallSid || "";
  const digits = body.Digits || "";
  const speechResult = body.SpeechResult || "";

  try {
    // ── INITIAL CALL HANDLER ──
    if (action === "incoming" || action === "voice-webhook") {
      // Create call session
      await supabase.from("call_sessions").insert({
        twilio_call_sid: callSid,
        status: "greeting",
        call_type: "inbound",
      });

      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Welcome to the Alumni Intelligence Platform. I am your AI operator.</Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna">Please speak or enter your 6-digit access code to authenticate.</Say>
  <Gather input="dtmf speech" numDigits="6" timeout="10" speechTimeout="5" action="/voice-webhook/authenticate">
    <Say voice="Polly.Joanna">I'm listening for your access code.</Say>
  </Gather>
  <Say voice="Polly.Joanna">I didn't receive an access code. Goodbye.</Say>
</Response>`);
    }

    // ── AUTHENTICATION ──
    if (action === "authenticate") {
      const accessCode = digits || speechResult.replace(/\s/g, "");

      // Look up access code
      const { data: codeRecord } = await supabase
        .from("voice_access_codes")
        .select("*")
        .eq("access_code", accessCode)
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (!codeRecord) {
        // Update session
        await supabase
          .from("call_sessions")
          .update({ status: "auth_failed" })
          .eq("twilio_call_sid", callSid);

        return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">I couldn't verify that access code. Let me try again.</Say>
  <Gather input="dtmf speech" numDigits="6" timeout="10" speechTimeout="5" action="/voice-webhook/authenticate">
    <Say voice="Polly.Joanna">Please speak or enter your access code.</Say>
  </Gather>
  <Say voice="Polly.Joanna">Authentication failed. Goodbye.</Say>
</Response>`);
      }

      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", codeRecord.user_id)
        .single();

      // Update session with user
      await supabase
        .from("call_sessions")
        .update({
          user_id: codeRecord.user_id,
          status: "authenticated",
        })
        .eq("twilio_call_sid", callSid);

      const userName = profile?.full_name || "there";

      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Welcome back, ${userName}. You are now authenticated.</Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna">How can I help you today? You can say things like: update my skills, find a mentor, schedule a session, check opportunities, or send a message.</Say>
  <Gather input="speech" timeout="10" speechTimeout="3" action="/voice-webhook/process-intent">
    <Say voice="Polly.Joanna">I'm listening.</Say>
  </Gather>
  <Say voice="Polly.Joanna">I didn't hear anything. Goodbye.</Say>
</Response>`);
    }

    // ── INTENT PROCESSING ──
    if (action === "process-intent") {
      const speech = speechResult.toLowerCase();

      // Get session user
      const { data: session } = await supabase
        .from("call_sessions")
        .select("user_id, metadata")
        .eq("twilio_call_sid", callSid)
        .single();

      if (!session?.user_id) {
        return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Your session has expired. Please call again.</Say>
</Response>`);
      }

      const userId = session.user_id;

      // ── INTENT: UPDATE SKILLS ──
      if (speech.includes("skill") || speech.includes("learn") || speech.includes("update")) {
        await supabase.from("call_sessions").update({ intent: "update_skills" }).eq("twilio_call_sid", callSid);

        return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Sure, I can update your skills. Please tell me the skills you'd like to add to your profile.</Say>
  <Gather input="speech" timeout="15" speechTimeout="4" action="/voice-webhook/update-skills">
    <Say voice="Polly.Joanna">Go ahead, I'm listening.</Say>
  </Gather>
</Response>`);
      }

      // ── INTENT: FIND MENTOR ──
      if (speech.includes("mentor") || speech.includes("find") || speech.includes("guidance")) {
        await supabase.from("call_sessions").update({ intent: "find_mentor" }).eq("twilio_call_sid", callSid);

        // Fetch mentors
        const { data: mentors } = await supabase
          .from("profiles")
          .select("user_id, full_name, skills, company, designation")
          .eq("is_mentor", true)
          .limit(5);

        // Log action
        await supabase.from("call_action_logs").insert({
          call_session_id: (await supabase.from("call_sessions").select("id").eq("twilio_call_sid", callSid).single()).data?.id,
          action: "find_mentors",
          endpoint: "GET /profiles?is_mentor=true",
          response_status: 200,
          response_summary: `Found ${mentors?.length || 0} mentors`,
        });

        if (!mentors || mentors.length === 0) {
          return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">I couldn't find any mentors available right now. Would you like to do something else?</Say>
  <Gather input="speech" timeout="10" speechTimeout="3" action="/voice-webhook/process-intent">
    <Say voice="Polly.Joanna">What would you like to do?</Say>
  </Gather>
</Response>`);
        }

        // Store mentors in session metadata
        await supabase
          .from("call_sessions")
          .update({
            metadata: {
              ...(session.metadata as Record<string, unknown> || {}),
              mentors: mentors.map((m, i) => ({ index: i + 1, ...m })),
            },
          })
          .eq("twilio_call_sid", callSid);

        let mentorList = "";
        mentors.forEach((m, i) => {
          mentorList += `<Say voice="Polly.Joanna">Option ${i + 1}: ${m.full_name}, ${m.designation || "Professional"} at ${m.company || "their organization"}.</Say><Pause length="1"/>`;
        });

        return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">I found ${mentors.length} mentors for you. Here they are:</Say>
  <Pause length="1"/>
  ${mentorList}
  <Say voice="Polly.Joanna">Which mentor would you like to connect with? Say the option number, or say schedule to set up a session.</Say>
  <Gather input="speech dtmf" numDigits="1" timeout="10" speechTimeout="3" action="/voice-webhook/select-mentor">
    <Say voice="Polly.Joanna">I'm waiting for your selection.</Say>
  </Gather>
</Response>`);
      }

      // ── INTENT: CHECK OPPORTUNITIES ──
      if (speech.includes("opportunit") || speech.includes("job") || speech.includes("career")) {
        await supabase.from("call_sessions").update({ intent: "check_opportunities" }).eq("twilio_call_sid", callSid);

        const { data: opps } = await supabase
          .from("opportunities")
          .select("title, company, type, location")
          .eq("is_active", true)
          .limit(3);

        if (!opps || opps.length === 0) {
          return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">There are no active opportunities right now. Would you like to do something else?</Say>
  <Gather input="speech" timeout="10" speechTimeout="3" action="/voice-webhook/process-intent">
    <Say voice="Polly.Joanna">What else can I help with?</Say>
  </Gather>
</Response>`);
        }

        let oppList = "";
        opps.forEach((o, i) => {
          oppList += `<Say voice="Polly.Joanna">${i + 1}. ${o.title} at ${o.company}, located in ${o.location || "remote"}.</Say><Pause length="1"/>`;
        });

        return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Here are the latest opportunities:</Say>
  ${oppList}
  <Say voice="Polly.Joanna">Would you like more details, or is there anything else I can help with?</Say>
  <Gather input="speech" timeout="10" speechTimeout="3" action="/voice-webhook/process-intent">
    <Say voice="Polly.Joanna">I'm listening.</Say>
  </Gather>
</Response>`);
      }

      // ── INTENT: CHECK EVENTS ──
      if (speech.includes("event") || speech.includes("meetup") || speech.includes("gathering")) {
        const { data: events } = await supabase
          .from("events")
          .select("title, start_date, location, is_virtual")
          .gte("start_date", new Date().toISOString())
          .order("start_date")
          .limit(3);

        let eventList = "";
        (events || []).forEach((e, i) => {
          const date = new Date(e.start_date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
          eventList += `<Say voice="Polly.Joanna">${i + 1}. ${e.title} on ${date}, ${e.is_virtual ? "virtual event" : `at ${e.location || "location TBD"}`}.</Say><Pause length="1"/>`;
        });

        return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${events?.length ? `Here are ${events.length} upcoming events:` : "There are no upcoming events."}</Say>
  ${eventList}
  <Say voice="Polly.Joanna">Would you like to RSVP to any event, or is there anything else?</Say>
  <Gather input="speech" timeout="10" speechTimeout="3" action="/voice-webhook/process-intent">
    <Say voice="Polly.Joanna">What would you like to do?</Say>
  </Gather>
</Response>`);
      }

      // ── INTENT: SEND MESSAGE ──
      if (speech.includes("message") || speech.includes("send") || speech.includes("contact")) {
        return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Who would you like to send a message to? Please say their name.</Say>
  <Gather input="speech" timeout="10" speechTimeout="3" action="/voice-webhook/find-recipient">
    <Say voice="Polly.Joanna">I'm listening for the name.</Say>
  </Gather>
</Response>`);
      }

      // ── INTENT: END CALL ──
      if (speech.includes("bye") || speech.includes("end") || speech.includes("done") || speech.includes("thank")) {
        await supabase
          .from("call_sessions")
          .update({ status: "completed", ended_at: new Date().toISOString() })
          .eq("twilio_call_sid", callSid);

        return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Thank you for using the Alumni Intelligence Platform. Have a great day!</Say>
</Response>`);
      }

      // ── FALLBACK ──
      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">I'm sorry, I didn't quite understand that. You can say: update skills, find a mentor, check opportunities, view events, or send a message.</Say>
  <Gather input="speech" timeout="10" speechTimeout="3" action="/voice-webhook/process-intent">
    <Say voice="Polly.Joanna">What would you like to do?</Say>
  </Gather>
</Response>`);
    }

    // ── UPDATE SKILLS ──
    if (action === "update-skills") {
      const { data: session } = await supabase
        .from("call_sessions")
        .select("user_id")
        .eq("twilio_call_sid", callSid)
        .single();

      if (session?.user_id) {
        // Parse skills from speech
        const newSkills = speechResult
          .split(/,| and | & /)
          .map((s: string) => s.trim())
          .filter(Boolean);

        // Get existing skills
        const { data: profile } = await supabase
          .from("profiles")
          .select("skills")
          .eq("user_id", session.user_id)
          .single();

        const existingSkills = (profile?.skills || []) as string[];
        const mergedSkills = [...new Set([...existingSkills, ...newSkills])];

        await supabase
          .from("profiles")
          .update({ skills: mergedSkills })
          .eq("user_id", session.user_id);

        // Log action
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
  <Say voice="Polly.Joanna">Your skills have been updated. I've added ${newSkills.join(", ")} to your profile.</Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna">Is there anything else I can help you with?</Say>
  <Gather input="speech" timeout="10" speechTimeout="3" action="/voice-webhook/process-intent">
    <Say voice="Polly.Joanna">I'm listening.</Say>
  </Gather>
</Response>`);
      }
    }

    // ── SELECT MENTOR ──
    if (action === "select-mentor") {
      const { data: session } = await supabase
        .from("call_sessions")
        .select("user_id, metadata")
        .eq("twilio_call_sid", callSid)
        .single();

      const selection = digits || speechResult.replace(/\D/g, "");
      const mentors = ((session?.metadata as Record<string, unknown>)?.mentors || []) as Array<{
        index: number;
        user_id: string;
        full_name: string;
      }>;
      const selectedMentor = mentors.find((m) => m.index === parseInt(selection));

      if (!selectedMentor || !session?.user_id) {
        return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">I couldn't identify that selection. Please try again.</Say>
  <Gather input="speech dtmf" numDigits="1" timeout="10" action="/voice-webhook/select-mentor">
    <Say voice="Polly.Joanna">Which mentor number?</Say>
  </Gather>
</Response>`);
      }

      // Store selected mentor
      await supabase
        .from("call_sessions")
        .update({
          metadata: {
            ...(session.metadata as Record<string, unknown> || {}),
            selected_mentor: selectedMentor,
          },
        })
        .eq("twilio_call_sid", callSid);

      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">You've selected ${selectedMentor.full_name}. Would you like to schedule a mentorship session with them? Say yes or no.</Say>
  <Gather input="speech" timeout="10" speechTimeout="3" action="/voice-webhook/confirm-schedule">
    <Say voice="Polly.Joanna">Would you like to schedule?</Say>
  </Gather>
</Response>`);
    }

    // ── CONFIRM SCHEDULE ──
    if (action === "confirm-schedule") {
      const answer = speechResult.toLowerCase();
      if (answer.includes("yes") || answer.includes("sure") || answer.includes("okay")) {
        return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">When would you like to schedule the session? Please say the day and time, for example, tomorrow at 3 PM.</Say>
  <Gather input="speech" timeout="15" speechTimeout="5" action="/voice-webhook/schedule-session">
    <Say voice="Polly.Joanna">I'm listening for the date and time.</Say>
  </Gather>
</Response>`);
      }

      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">No problem. Is there anything else I can help you with?</Say>
  <Gather input="speech" timeout="10" speechTimeout="3" action="/voice-webhook/process-intent">
    <Say voice="Polly.Joanna">What would you like to do?</Say>
  </Gather>
</Response>`);
    }

    // ── SCHEDULE SESSION ──
    if (action === "schedule-session") {
      const { data: session } = await supabase
        .from("call_sessions")
        .select("user_id, metadata")
        .eq("twilio_call_sid", callSid)
        .single();

      const mentor = (session?.metadata as Record<string, unknown>)?.selected_mentor as { user_id: string; full_name: string } | undefined;

      if (!session?.user_id || !mentor) {
        return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">I lost the session context. Let me take you back to the main menu.</Say>
  <Gather input="speech" timeout="10" speechTimeout="3" action="/voice-webhook/process-intent">
    <Say voice="Polly.Joanna">What would you like to do?</Say>
  </Gather>
</Response>`);
      }

      // Parse time (simple heuristic — production would use NLP)
      const now = new Date();
      let scheduledDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Default: tomorrow
      if (speechResult.toLowerCase().includes("today")) {
        scheduledDate = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      }
      // Set to 3 PM as default time
      scheduledDate.setHours(15, 0, 0, 0);

      // Create connection
      await supabase.from("connections").insert({
        source_user_id: session.user_id,
        target_user_id: mentor.user_id,
        relation_type: "mentor",
        status: "accepted",
      });

      // Create mentorship event
      const { data: event } = await supabase
        .from("events")
        .insert({
          title: `Mentorship Session`,
          description: `Voice-scheduled mentorship session between alumni`,
          start_date: scheduledDate.toISOString(),
          end_date: new Date(scheduledDate.getTime() + 30 * 60 * 1000).toISOString(),
          event_type: "mentorship",
          is_virtual: true,
          created_by: session.user_id,
        })
        .select()
        .single();

      // Send message to mentor
      await supabase.from("messages").insert({
        sender_id: session.user_id,
        receiver_id: mentor.user_id,
        content: `Hi! I've scheduled a mentorship session with you for ${scheduledDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} at ${scheduledDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}. Looking forward to connecting!`,
      });

      // Create notifications
      await supabase.from("notifications").insert({
        user_id: mentor.user_id,
        title: "New Mentorship Session Scheduled",
        message: `A mentorship session has been scheduled via voice call.`,
        type: "mentorship",
        link: "/dashboard/mentorship",
      });

      // Schedule reminder call
      if (event) {
        const reminderTime = new Date(scheduledDate.getTime() - 5 * 60 * 1000);
        await supabase.from("scheduled_calls").insert([
          { user_id: mentor.user_id, event_id: event.id, call_type: "reminder", scheduled_at: reminderTime.toISOString() },
          { user_id: session.user_id, event_id: event.id, call_type: "reminder", scheduled_at: reminderTime.toISOString() },
        ]);
      }

      // Log actions
      const { data: sess } = await supabase.from("call_sessions").select("id").eq("twilio_call_sid", callSid).single();
      await supabase.from("call_action_logs").insert([
        { call_session_id: sess?.id, action: "create_connection", endpoint: "POST /connections", response_status: 201, response_summary: `Mentor connection created` },
        { call_session_id: sess?.id, action: "create_event", endpoint: "POST /events", response_status: 201, response_summary: `Mentorship event created` },
        { call_session_id: sess?.id, action: "send_message", endpoint: "POST /messages", response_status: 201, response_summary: `Notification sent to mentor` },
      ]);

      // Log engagement
      await supabase.from("engagement_logs").insert({
        user_id: session.user_id,
        action: "voice_mentorship_scheduled",
        points: 30,
        metadata: { mentor_id: mentor.user_id, scheduled_at: scheduledDate.toISOString() },
      });

      const dateStr = scheduledDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
      const timeStr = scheduledDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Your mentorship session with ${mentor.full_name} has been scheduled for ${dateStr} at ${timeStr}.</Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna">I've sent a message to your mentor and both of you will receive a reminder call 5 minutes before the session.</Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna">Is there anything else I can help you with?</Say>
  <Gather input="speech" timeout="10" speechTimeout="3" action="/voice-webhook/process-intent">
    <Say voice="Polly.Joanna">I'm listening.</Say>
  </Gather>
</Response>`);
    }

    // ── FIND RECIPIENT FOR MESSAGE ──
    if (action === "find-recipient") {
      const { data: session } = await supabase
        .from("call_sessions")
        .select("user_id, metadata")
        .eq("twilio_call_sid", callSid)
        .single();

      const { data: matches } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .ilike("full_name", `%${speechResult}%`)
        .limit(3);

      if (!matches || matches.length === 0) {
        return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">I couldn't find anyone with that name. Please try again.</Say>
  <Gather input="speech" timeout="10" speechTimeout="3" action="/voice-webhook/find-recipient">
    <Say voice="Polly.Joanna">Who would you like to message?</Say>
  </Gather>
</Response>`);
      }

      // Store first match
      await supabase
        .from("call_sessions")
        .update({
          metadata: {
            ...(session?.metadata as Record<string, unknown> || {}),
            message_recipient: matches[0],
          },
        })
        .eq("twilio_call_sid", callSid);

      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">I found ${matches[0].full_name}. What message would you like to send?</Say>
  <Gather input="speech" timeout="15" speechTimeout="5" action="/voice-webhook/send-message">
    <Say voice="Polly.Joanna">Please speak your message.</Say>
  </Gather>
</Response>`);
    }

    // ── SEND MESSAGE ──
    if (action === "send-message") {
      const { data: session } = await supabase
        .from("call_sessions")
        .select("user_id, metadata")
        .eq("twilio_call_sid", callSid)
        .single();

      const recipient = (session?.metadata as Record<string, unknown>)?.message_recipient as { user_id: string; full_name: string } | undefined;

      if (session?.user_id && recipient) {
        await supabase.from("messages").insert({
          sender_id: session.user_id,
          receiver_id: recipient.user_id,
          content: `[Voice Message] ${speechResult}`,
        });

        return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Your message has been sent to ${recipient.full_name}.</Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna">Is there anything else I can help you with?</Say>
  <Gather input="speech" timeout="10" speechTimeout="3" action="/voice-webhook/process-intent">
    <Say voice="Polly.Joanna">I'm listening.</Say>
  </Gather>
</Response>`);
      }
    }

    // ── CALL STATUS CALLBACK ──
    if (action === "status-callback") {
      const callStatus = body.CallStatus || "";
      const duration = body.CallDuration || "0";

      if (callStatus === "completed") {
        await supabase
          .from("call_sessions")
          .update({
            status: "completed",
            ended_at: new Date().toISOString(),
            duration_seconds: parseInt(duration),
          })
          .eq("twilio_call_sid", callSid);
      }

      return new Response("OK", { headers: corsHeaders });
    }

    // ── RECORDING CALLBACK ──
    if (action === "recording-callback") {
      const recordingUrl = body.RecordingUrl || "";
      await supabase
        .from("call_sessions")
        .update({ recording_url: recordingUrl })
        .eq("twilio_call_sid", callSid);

      return new Response("OK", { headers: corsHeaders });
    }

    return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">I'm sorry, something went wrong. Please call again later.</Say>
</Response>`);
  } catch (error) {
    console.error("Voice webhook error:", error);
    return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">I'm sorry, I encountered an issue. Please try again later.</Say>
</Response>`);
  }
});
