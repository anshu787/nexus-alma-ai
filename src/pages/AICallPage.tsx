import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CallWaveform from "@/components/ai-call/CallWaveform";
import CallTranscript, { TranscriptMessage } from "@/components/ai-call/CallTranscript";
import CallControls from "@/components/ai-call/CallControls";
import { useWebSpeech } from "@/hooks/useWebSpeech";
import { useIntentEngine } from "@/hooks/useIntentEngine";
import { moderateContent } from "@/lib/contentModerator";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

type CallState = "idle" | "connecting" | "active" | "ended";

export default function AICallPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [callState, setCallState] = useState<CallState>("idle");
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [partialText, setPartialText] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const processingRef = useRef(false);
  const msgIdRef = useRef(0);

  const { detectIntent, executeIntent, resetMemory } = useIntentEngine();

  const addMessage = useCallback((role: "user" | "assistant", text: string) => {
    msgIdRef.current++;
    setMessages((prev) => [
      ...prev,
      { id: `msg-${msgIdRef.current}`, role, text, timestamp: new Date() },
    ]);
  }, []);

  const handleTranscript = useCallback(
    async (text: string, isFinal: boolean) => {
      if (!isFinal) {
        setPartialText(text);
        return;
      }
      setPartialText("");
      if (!text.trim()) return;

      addMessage("user", text);

      // Process intent
      if (processingRef.current) return;
      processingRef.current = true;

      // Check for negative institutional content first
      const moderation = moderateContent(text);
      if (moderation.isNegativeInstitutional) {
        const positiveResponse = `I understand your feelings. ${moderation.moderatedText} ${moderation.moderationNote}`;
        addMessage("assistant", positiveResponse);
        await speech.speak(positiveResponse);
        processingRef.current = false;
        return;
      }

      const detected = detectIntent(text);
      if (detected) {
        const result = await executeIntent(detected.intent, detected.params);
        addMessage("assistant", result.response);
        await speech.speak(result.response);
      } else {
        const fallback =
          "I can help you update your skills, find mentors, check opportunities, browse events, schedule mentorship sessions, send messages, or create posts. Just tell me what you'd like to do.";
        addMessage("assistant", fallback);
        await speech.speak(fallback);
      }
      processingRef.current = false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const speech = useWebSpeech({
    onTranscript: handleTranscript,
  });

  // Call timer
  useEffect(() => {
    if (callState === "active") {
      timerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [callState]);

  const startCall = useCallback(async () => {
    if (!user) {
      toast.error("Please log in first");
      return;
    }
    if (!speech.supported) {
      toast.error("Speech recognition is not supported in this browser. Please use Chrome.");
      return;
    }

    setCallState("connecting");
    setMessages([]);
    setCallDuration(0);
    resetMemory();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      setAudioStream(stream);

      // Simulate connection delay
      await new Promise((r) => setTimeout(r, 1500));

      setCallState("active");
      speech.startListening();

      const greeting =
        "Hello! I'm your AI Mentor Assistant. How can I help you today? You can ask me to find mentors, update your skills, check opportunities, browse events, or schedule mentorship sessions.";
      addMessage("assistant", greeting);
      await speech.speak(greeting);
    } catch (err) {
      toast.error("Could not access microphone");
      setCallState("idle");
    }
  }, [user, speech, resetMemory, addMessage]);

  const endCall = useCallback(() => {
    speech.stopListening();
    speech.cancelSpeech();
    audioStream?.getTracks().forEach((t) => t.stop());
    setAudioStream(null);
    setCallState("ended");

    setTimeout(() => setCallState("idle"), 3000);
  }, [speech, audioStream]);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      speech.startListening();
    } else {
      speech.stopListening();
    }
    setIsMuted(!isMuted);
    // Mute/unmute the actual stream
    audioStream?.getAudioTracks().forEach((t) => {
      t.enabled = isMuted; // Toggle (isMuted is the old value)
    });
  }, [isMuted, speech, audioStream]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <span className="font-heading font-semibold text-sm">AI Voice Assistant</span>
        </div>
        <div className="w-16" />
      </div>

      {/* Main Call Area */}
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 py-6 gap-4">
        {/* Call status */}
        <div className="text-center space-y-3">
          <AnimatePresence mode="wait">
            {callState === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="space-y-6 py-8"
              >
                <div className="relative mx-auto w-32 h-32">
                  <motion.div
                    className="absolute inset-0 rounded-full bg-accent/20"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <motion.div
                    className="absolute inset-2 rounded-full bg-accent/30"
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                  />
                  <div className="absolute inset-4 rounded-full bg-accent flex items-center justify-center shadow-lg">
                    <Phone className="h-10 w-10 text-accent-foreground" />
                  </div>
                </div>
                <div>
                  <h2 className="text-xl font-heading font-bold text-foreground">
                    AI Mentor Assistant
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Start a voice conversation to manage your profile, find mentors, and more
                  </p>
                </div>
                <Button
                  size="lg"
                  className="rounded-full px-8 bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg"
                  onClick={startCall}
                >
                  <Phone className="h-5 w-5 mr-2" />
                  Call AI Assistant
                </Button>
              </motion.div>
            )}

            {callState === "connecting" && (
              <motion.div
                key="connecting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-8 space-y-4"
              >
                <motion.div
                  className="mx-auto w-24 h-24 rounded-full bg-accent/20 flex items-center justify-center"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                >
                  <Phone className="h-8 w-8 text-accent" />
                </motion.div>
                <p className="text-muted-foreground animate-pulse">Connecting...</p>
              </motion.div>
            )}

            {callState === "ended" && (
              <motion.div
                key="ended"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-8 space-y-3"
              >
                <PhoneOff className="h-10 w-10 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">Call ended</p>
                <p className="text-xs text-muted-foreground/60">
                  Duration: {Math.floor(callDuration / 60)}m {callDuration % 60}s
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {callState === "active" && (
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    speech.isSpeaking
                      ? "bg-accent/10 text-accent border-accent/30"
                      : speech.isListening
                      ? "bg-success/10 text-success border-success/30"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse mr-1.5 inline-block" />
                  {speech.isSpeaking ? "AI Speaking" : speech.isListening ? "Listening" : "Paused"}
                </Badge>
                {isMuted && (
                  <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/30">
                    Muted
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Waveform */}
        {callState === "active" && (
          <CallWaveform
            stream={audioStream}
            isActive={speech.isListening && !isMuted}
            isSpeaking={speech.isSpeaking}
          />
        )}

        {/* Transcript */}
        {(callState === "active" || (callState === "idle" && messages.length > 0)) && (
          <div className="flex-1 min-h-0 bg-card border border-border rounded-2xl p-4 flex flex-col overflow-hidden">
            <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
              Transcript
            </h3>
            <CallTranscript
              messages={messages}
              partialText={partialText}
              isListening={speech.isListening}
            />
          </div>
        )}

        {/* Controls */}
        <CallControls
          isActive={callState === "active"}
          isMuted={isMuted}
          isSpeaking={speech.isSpeaking}
          onToggleMute={toggleMute}
          onEndCall={endCall}
          callDuration={callDuration}
        />
      </div>
    </div>
  );
}
