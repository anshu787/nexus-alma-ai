const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// GET-accessible TTS endpoint so Twilio <Play> can fetch ElevenLabs audio
// Usage: <Play>https://...functions/v1/twiml-tts?text=Hello&voice=JBFqnCBsd6RMkjVDRZzb</Play>
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return new Response("TTS not configured", { status: 500 });
    }

    const url = new URL(req.url);
    let text: string | null = null;
    let voiceId: string | null = null;

    if (req.method === "GET") {
      text = url.searchParams.get("text");
      voiceId = url.searchParams.get("voice");
    } else {
      const body = await req.json().catch(() => ({}));
      text = body.text;
      voiceId = body.voice || body.voiceId;
    }

    if (!text) {
      return new Response("text parameter required", { status: 400 });
    }

    const voice = voiceId || "JBFqnCBsd6RMkjVDRZzb"; // George

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.6,
            similarity_boost: 0.75,
            style: 0.2,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error("ElevenLabs TTS error:", await response.text());
      return new Response("TTS generation failed", { status: 500 });
    }

    const audioBuffer = await response.arrayBuffer();
    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("twiml-tts error:", error);
    return new Response("Internal error", { status: 500 });
  }
});
