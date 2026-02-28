import { useState, useCallback, useRef, useEffect } from "react";
import { useConversation } from "@elevenlabs/react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Volume2, Loader2, Radio, Captions, CaptionsOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Message {
  role: "user" | "agent";
  text: string;
  timestamp: Date;
  isPartial?: boolean;
}

export default function ElevenLabsVoiceAgent() {
  const [agentId, setAgentId] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  // Realtime STT (Scribe) state
  const [scribeEnabled, setScribeEnabled] = useState(true);
  const [partialCaption, setPartialCaption] = useState("");
  const scribeWsRef = useRef<WebSocket | null>(null);
  const scribeRecorderRef = useRef<MediaRecorder | null>(null);
  const scribeStreamRef = useRef<MediaStream | null>(null);

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, partialCaption]);

  const conversation = useConversation({
    onConnect: () => {
      toast.success("Connected to AI Voice Agent");
    },
    onDisconnect: () => {
      toast.info("Voice agent disconnected");
      stopScribe();
    },
    onMessage: (message: any) => {
      if (message.type === "user_transcript" && message.user_transcription_event) {
        setMessages(prev => [...prev, {
          role: "user",
          text: message.user_transcription_event.user_transcript,
          timestamp: new Date(),
        }]);
      }
      if (message.type === "agent_response" && message.agent_response_event) {
        setMessages(prev => [...prev, {
          role: "agent",
          text: message.agent_response_event.agent_response,
          timestamp: new Date(),
        }]);
      }
    },
    onError: (error: any) => {
      console.error("Voice agent error:", error);
      toast.error("Voice agent error occurred");
    },
  });

  // ── Realtime Scribe via WebSocket ──
  const startScribe = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token");
      if (error || !data?.token) {
        console.error("Scribe token error:", error);
        return;
      }

      const ws = new WebSocket(
        `wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime&token=${data.token}`
      );

      ws.onopen = () => {
        // Configure session
        ws.send(JSON.stringify({
          type: "session_config",
          audio_format: { sample_rate: 16000, encoding: "pcm_s16le" },
          commit_strategy: "vad",
        }));

        // Start capturing mic audio
        startScribeRecording(ws);
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "partial_transcript") {
          setPartialCaption(msg.text || "");
        }
        if (msg.type === "committed_transcript") {
          setPartialCaption("");
          if (msg.text?.trim()) {
            setMessages(prev => [...prev, {
              role: "user",
              text: msg.text,
              timestamp: new Date(),
            }]);
          }
        }
      };

      ws.onerror = (e) => console.error("Scribe WS error:", e);
      ws.onclose = () => {
        setPartialCaption("");
      };

      scribeWsRef.current = ws;
    } catch (err) {
      console.error("Scribe start error:", err);
    }
  }, []);

  const startScribeRecording = async (ws: WebSocket) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      scribeStreamRef.current = stream;

      // Use AudioWorklet / ScriptProcessor to get raw PCM
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const input = e.inputBuffer.getChannelData(0);
        // Convert float32 to int16
        const int16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        // Send as base64
        const bytes = new Uint8Array(int16.buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        ws.send(JSON.stringify({ type: "audio", data: btoa(binary) }));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
    } catch (err) {
      console.error("Scribe recording error:", err);
    }
  };

  const stopScribe = useCallback(() => {
    scribeWsRef.current?.close();
    scribeWsRef.current = null;
    scribeStreamRef.current?.getTracks().forEach(t => t.stop());
    scribeStreamRef.current = null;
    setPartialCaption("");
  }, []);

  const startConversation = useCallback(async () => {
    if (!agentId.trim()) {
      toast.error("Please enter your ElevenLabs Agent ID");
      return;
    }
    setIsConnecting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const { data, error } = await supabase.functions.invoke(
        "elevenlabs-conversation-token",
        { body: { agent_id: agentId } }
      );

      if (error || !data?.token) {
        throw new Error(error?.message || "No token received");
      }

      await conversation.startSession({
        conversationToken: data.token,
        connectionType: "webrtc",
      });

      setMessages([]);

      // Start realtime scribe for live captions
      if (scribeEnabled) {
        setTimeout(() => startScribe(), 500);
      }
    } catch (error: any) {
      console.error("Failed to start:", error);
      toast.error(error.message || "Failed to start conversation");
    } finally {
      setIsConnecting(false);
    }
  }, [conversation, agentId, scribeEnabled, startScribe]);

  const stopConversation = useCallback(async () => {
    stopScribe();
    await conversation.endSession();
  }, [conversation, stopScribe]);

  const isConnected = conversation.status === "connected";

  return (
    <div className="space-y-5">
      {/* Agent Config */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-card space-y-4">
        <h3 className="font-heading font-semibold text-card-foreground flex items-center gap-2">
          <Radio className="h-4 w-4 text-accent" /> ElevenLabs Voice Agent
        </h3>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Agent ID</Label>
          <Input
            placeholder="Enter your ElevenLabs Agent ID..."
            value={agentId}
            onChange={e => setAgentId(e.target.value)}
            disabled={isConnected}
          />
          <p className="text-[10px] text-muted-foreground">
            Create an agent at elevenlabs.io and paste the Agent ID here.
          </p>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {!isConnected ? (
              <Button
                variant="hero"
                onClick={startConversation}
                disabled={isConnecting || !agentId.trim()}
              >
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
                {isConnecting ? "Connecting..." : "Start Conversation"}
              </Button>
            ) : (
              <Button variant="destructive" onClick={stopConversation}>
                <MicOff className="h-4 w-4" /> End Conversation
              </Button>
            )}

            {isConnected && (
              <Badge
                variant="outline"
                className={`text-xs ${
                  conversation.isSpeaking
                    ? "bg-accent/10 text-accent border-accent/20"
                    : "bg-success/10 text-success border-success/20"
                }`}
              >
                {conversation.isSpeaking ? (
                  <><Volume2 className="h-3 w-3 mr-1" /> Agent Speaking</>
                ) : (
                  <><Mic className="h-3 w-3 mr-1" /> Listening</>
                )}
              </Badge>
            )}
          </div>

          {/* Live Captions Toggle */}
          <div className="flex items-center gap-2">
            {scribeEnabled ? (
              <Captions className="h-4 w-4 text-accent" />
            ) : (
              <CaptionsOff className="h-4 w-4 text-muted-foreground" />
            )}
            <Label className="text-xs text-muted-foreground cursor-pointer" htmlFor="scribe-toggle">
              Live Captions
            </Label>
            <Switch
              id="scribe-toggle"
              checked={scribeEnabled}
              onCheckedChange={setScribeEnabled}
              disabled={isConnected}
            />
          </div>
        </div>
      </div>

      {/* Live Conversation Transcript */}
      {(isConnected || messages.length > 0) && (
        <div className="bg-card border border-border rounded-xl p-5 shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-heading font-semibold text-sm text-card-foreground flex items-center gap-2">
              Live Transcript
              {scribeEnabled && isConnected && (
                <Badge variant="outline" className="text-[10px] bg-accent/10 text-accent border-accent/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse inline-block mr-1" />
                  Scribe Active
                </Badge>
              )}
            </h4>
          </div>
          <div className="max-h-80 overflow-y-auto space-y-2">
            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    <p className="text-[10px] font-medium opacity-70 mb-0.5">
                      {msg.role === "user" ? "You" : "Agent"}
                    </p>
                    {msg.text}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Partial caption (live typing indicator) */}
            {partialCaption && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-end"
              >
                <div className="max-w-[80%] rounded-xl px-3 py-2 text-sm bg-primary/60 text-primary-foreground border border-primary/30 border-dashed">
                  <p className="text-[10px] font-medium opacity-70 mb-0.5">You (live)</p>
                  {partialCaption}
                  <span className="inline-block w-1 h-3 bg-primary-foreground/50 animate-pulse ml-0.5 align-middle" />
                </div>
              </motion.div>
            )}

            {messages.length === 0 && !partialCaption && isConnected && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Start speaking — your conversation will appear here...
              </p>
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
