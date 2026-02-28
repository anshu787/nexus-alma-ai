import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone, PhoneOff, Mic, MicOff, Volume2, Loader2,
  MessageSquare, Activity, Bot, User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TranscriptEntry {
  role: "assistant" | "user";
  text: string;
  timestamp: Date;
}

export default function VapiVoiceAssistant() {
  const { user, session } = useAuth();
  const [callStatus, setCallStatus] = useState<"idle" | "connecting" | "active" | "ending">("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [callDuration, setCallDuration] = useState(0);
  const vapiRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  // Call duration timer
  useEffect(() => {
    if (callStatus === "active") {
      timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (callStatus === "idle") setCallDuration(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callStatus]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, "0")}`;
  };

  const startCall = useCallback(async () => {
    if (!user || !session) {
      toast.error("Please log in first");
      return;
    }

    setCallStatus("connecting");
    setTranscript([]);

    try {
      // Dynamically import Vapi
      const { default: Vapi } = await import("@vapi-ai/web");

      // Get public key from edge function
      const { data: configData, error: configError } = await supabase.functions.invoke("vapi-session", {
        body: { action: "get-config" }
      });

      if (configError || !configData?.publicKey) {
        throw new Error("Failed to get voice configuration");
      }

      const vapi = new Vapi(configData.publicKey);
      vapiRef.current = vapi;

      // Set up event listeners
      vapi.on("call-start", () => {
        setCallStatus("active");
        toast.success("Voice session started");
      });

      vapi.on("call-end", () => {
        setCallStatus("idle");
        vapiRef.current = null;
        toast.info("Voice session ended");
      });

      vapi.on("speech-start", () => setIsSpeaking(true));
      vapi.on("speech-end", () => setIsSpeaking(false));

      vapi.on("volume-level", (level: number) => {
        setVolumeLevel(level);
      });

      vapi.on("message", (msg: any) => {
        if (msg.type === "transcript") {
          if (msg.transcriptType === "final") {
            setTranscript(prev => [...prev, {
              role: msg.role,
              text: msg.transcript,
              timestamp: new Date()
            }]);
          }
        } else if (msg.type === "function-call") {
          // Log tool calls
          setTranscript(prev => [...prev, {
            role: "assistant",
            text: `⚡ Executing: ${msg.functionCall?.name || "action"}`,
            timestamp: new Date()
          }]);
        }
      });

      vapi.on("error", (err: any) => {
        console.error("Vapi error:", err);
        toast.error("Voice error occurred");
        setCallStatus("idle");
      });

      // Build the assistant configuration with tools
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const agentToolsUrl = `${supabaseUrl}/functions/v1/agent-tools`;

      await vapi.start({
        name: "AI Mentor Assistant",
        model: {
          provider: "openai",
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are the AI Mentor Assistant for the Alumni Intelligence Platform. You are speaking with an authenticated user.

USER CONTEXT:
- User ID: ${user.id}
- Email: ${user.email}

YOUR CAPABILITIES:
1. **Profile Management** - Update user skills, view profile information
2. **Mentor Discovery** - Find mentors by skill area, recommend matches
3. **Mentorship Scheduling** - Book sessions with mentors
4. **Opportunities** - Search jobs, internships, and opportunities
5. **Events** - Check upcoming events, RSVP to events
6. **Messaging** - Send messages to other alumni
7. **Success Stories** - Help users share their achievements

CONVERSATION RULES:
- Be warm, professional, and concise
- Always confirm before making changes (updating skills, sending messages, RSVPing)
- When listing items, summarize the top 3-5 results verbally
- Use the user's name when you know it
- If an action fails, explain what happened without technical jargon
- Maintain conversation context - remember what was discussed earlier
- For scheduling, always confirm the mentor and time before creating

GREETING:
Start by greeting the user and fetching their profile to personalize the conversation. Ask how you can help with their career development today.`
            }
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "get_profile",
                description: "Get the current user's profile including skills, company, and bio",
                parameters: {
                  type: "object",
                  properties: {
                    user_id: { type: "string", description: "The user ID to fetch profile for" }
                  },
                  required: ["user_id"]
                }
              },
              server: { url: agentToolsUrl },
              messages: [
                { type: "request-start", content: "Let me pull up your profile..." },
                { type: "request-complete", content: "Got your profile information." }
              ]
            },
            {
              type: "function",
              function: {
                name: "update_skills",
                description: "Add new skills to the user's profile",
                parameters: {
                  type: "object",
                  properties: {
                    user_id: { type: "string", description: "The user ID" },
                    new_skills: { type: "array", items: { type: "string" }, description: "Array of new skills to add" }
                  },
                  required: ["user_id", "new_skills"]
                }
              },
              server: { url: agentToolsUrl },
              messages: [
                { type: "request-start", content: "Updating your skills..." },
                { type: "request-complete", content: "Skills have been updated." }
              ]
            },
            {
              type: "function",
              function: {
                name: "find_mentors",
                description: "Find mentors, optionally filtered by skill area",
                parameters: {
                  type: "object",
                  properties: {
                    skill_area: { type: "string", description: "Optional skill area to filter mentors" }
                  }
                }
              },
              server: { url: agentToolsUrl },
              messages: [
                { type: "request-start", content: "Searching for mentors..." },
                { type: "request-complete", content: "Found some mentor matches." }
              ]
            },
            {
              type: "function",
              function: {
                name: "check_opportunities",
                description: "Check active job opportunities and internships",
                parameters: { type: "object", properties: {} }
              },
              server: { url: agentToolsUrl },
              messages: [
                { type: "request-start", content: "Looking up opportunities..." },
                { type: "request-complete", content: "Here are the latest opportunities." }
              ]
            },
            {
              type: "function",
              function: {
                name: "check_events",
                description: "Check upcoming events",
                parameters: { type: "object", properties: {} }
              },
              server: { url: agentToolsUrl },
              messages: [
                { type: "request-start", content: "Checking upcoming events..." },
                { type: "request-complete", content: "Found some events." }
              ]
            },
            {
              type: "function",
              function: {
                name: "schedule_mentorship",
                description: "Schedule a mentorship session with a mentor",
                parameters: {
                  type: "object",
                  properties: {
                    user_id: { type: "string", description: "The student's user ID" },
                    mentor_user_id: { type: "string", description: "The mentor's user ID" },
                    mentor_name: { type: "string", description: "The mentor's name" },
                    preferred_time: { type: "string", description: "Preferred time for the session" }
                  },
                  required: ["user_id", "mentor_user_id"]
                }
              },
              server: { url: agentToolsUrl },
              messages: [
                { type: "request-start", content: "Scheduling your mentorship session..." },
                { type: "request-complete", content: "Session has been scheduled." }
              ]
            },
            {
              type: "function",
              function: {
                name: "send_message",
                description: "Send a message to another user on the platform",
                parameters: {
                  type: "object",
                  properties: {
                    sender_id: { type: "string", description: "The sender's user ID" },
                    recipient_name: { type: "string", description: "The recipient's name" },
                    message: { type: "string", description: "The message content" }
                  },
                  required: ["sender_id", "recipient_name", "message"]
                }
              },
              server: { url: agentToolsUrl },
              messages: [
                { type: "request-start", content: "Sending your message..." },
                { type: "request-complete", content: "Message sent." }
              ]
            },
            {
              type: "function",
              function: {
                name: "rsvp_event",
                description: "RSVP to an upcoming event",
                parameters: {
                  type: "object",
                  properties: {
                    user_id: { type: "string", description: "The user's ID" },
                    event_id: { type: "string", description: "The event ID to RSVP to" }
                  },
                  required: ["user_id", "event_id"]
                }
              },
              server: { url: agentToolsUrl },
              messages: [
                { type: "request-start", content: "RSVPing to the event..." },
                { type: "request-complete", content: "You're registered for the event." }
              ]
            }
          ]
        },
        voice: {
          provider: "11labs",
          voiceId: "21m00Tcm4TlvDq8ikWAM",
        },
        firstMessage: `Hello! I'm your AI Mentor Assistant. Let me quickly pull up your profile so I can help you better.`,
      });

    } catch (err: any) {
      console.error("Failed to start Vapi call:", err);
      toast.error(err.message || "Failed to start voice session");
      setCallStatus("idle");
    }
  }, [user, session]);

  const endCall = useCallback(() => {
    if (vapiRef.current) {
      setCallStatus("ending");
      vapiRef.current.stop();
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (vapiRef.current) {
      const newMuted = !isMuted;
      vapiRef.current.setMuted(newMuted);
      setIsMuted(newMuted);
    }
  }, [isMuted]);

  // Waveform bars
  const bars = 24;
  const waveformHeights = Array.from({ length: bars }, (_, i) => {
    if (callStatus !== "active") return 4;
    const base = Math.sin(i * 0.5 + Date.now() * 0.003) * 0.5 + 0.5;
    return 4 + base * volumeLevel * 40;
  });

  return (
    <div className="space-y-4">
      {/* Main Call Card */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-card">
        {/* Header */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                callStatus === "active" ? "bg-success/10" : "bg-accent/10"
              }`}>
                <Bot className={`h-6 w-6 ${callStatus === "active" ? "text-success" : "text-accent"}`} />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-card-foreground">AI Mentor Assistant</h3>
                <p className="text-xs text-muted-foreground">
                  {callStatus === "idle" && "Ready to assist"}
                  {callStatus === "connecting" && "Connecting..."}
                  {callStatus === "active" && `Active — ${formatTime(callDuration)}`}
                  {callStatus === "ending" && "Ending session..."}
                </p>
              </div>
            </div>
            {callStatus === "active" && (
              <Badge variant="outline" className="bg-success/10 text-success border-success/20 animate-pulse">
                <Activity className="h-3 w-3 mr-1" /> Live
              </Badge>
            )}
          </div>
        </div>

        {/* Waveform Visualization */}
        <div className="px-5 py-6 flex items-center justify-center gap-[3px] min-h-[80px] bg-secondary/30">
          {waveformHeights.map((h, i) => (
            <motion.div
              key={i}
              className={`w-1.5 rounded-full ${
                callStatus === "active"
                  ? isSpeaking ? "bg-accent" : "bg-primary/60"
                  : "bg-muted-foreground/20"
              }`}
              animate={{ height: h }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            />
          ))}
        </div>

        {/* Call Controls */}
        <div className="p-5 flex items-center justify-center gap-4">
          {callStatus === "idle" ? (
            <Button
              size="lg"
              className="bg-success hover:bg-success/90 text-success-foreground gap-2 px-8 rounded-full"
              onClick={startCall}
            >
              <Phone className="h-5 w-5" /> Call AI Mentor Assistant
            </Button>
          ) : callStatus === "connecting" ? (
            <Button size="lg" disabled className="gap-2 px-8 rounded-full">
              <Loader2 className="h-5 w-5 animate-spin" /> Connecting...
            </Button>
          ) : (
            <>
              <Button
                size="icon"
                variant={isMuted ? "destructive" : "outline"}
                className="h-12 w-12 rounded-full"
                onClick={toggleMute}
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              <Button
                size="icon"
                variant="destructive"
                className="h-14 w-14 rounded-full"
                onClick={endCall}
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="h-12 w-12 rounded-full"
                disabled
              >
                <Volume2 className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Live Transcript */}
      <AnimatePresence>
        {transcript.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="bg-card border border-border rounded-xl shadow-card overflow-hidden"
          >
            <div className="p-4 border-b border-border flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-accent" />
              <h4 className="font-heading font-semibold text-sm text-card-foreground">Live Transcript</h4>
              <Badge variant="outline" className="text-[10px] ml-auto">{transcript.length} messages</Badge>
            </div>
            <ScrollArea className="h-64">
              <div className="p-4 space-y-3" ref={scrollRef}>
                {transcript.map((entry, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: entry.role === "user" ? 12 : -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex gap-2 ${entry.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                      entry.role === "user" ? "bg-primary/10" : "bg-accent/10"
                    }`}>
                      {entry.role === "user"
                        ? <User className="h-3.5 w-3.5 text-primary" />
                        : <Bot className="h-3.5 w-3.5 text-accent" />
                      }
                    </div>
                    <div className={`rounded-xl px-3 py-2 max-w-[80%] ${
                      entry.role === "user"
                        ? "bg-primary/10 text-foreground"
                        : entry.text.startsWith("⚡")
                          ? "bg-accent/10 text-accent border border-accent/20"
                          : "bg-secondary text-foreground"
                    }`}>
                      <p className="text-sm">{entry.text}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {entry.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Capabilities Info */}
      {callStatus === "idle" && (
        <div className="bg-card border border-border rounded-xl p-4 shadow-card">
          <h4 className="font-heading font-semibold text-sm text-card-foreground mb-3">What you can say</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              "\"I learned Python and machine learning\"",
              "\"Find mentors for data science\"",
              "\"Show me internship opportunities\"",
              "\"What events are coming up?\"",
              "\"Schedule a session with the first mentor\"",
              "\"Send a message to John about our meeting\"",
              "\"RSVP to the next event\"",
              "\"Show me my profile\"",
            ].map((example, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mic className="h-3 w-3 text-accent shrink-0" />
                <span>{example}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
