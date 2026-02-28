import { useState, useCallback } from "react";
import { useConversation } from "@elevenlabs/react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Volume2, Loader2, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Message {
  role: "user" | "agent";
  text: string;
  timestamp: Date;
}

export default function ElevenLabsVoiceAgent() {
  const [agentId, setAgentId] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const conversation = useConversation({
    onConnect: () => {
      toast.success("Connected to AI Voice Agent");
    },
    onDisconnect: () => {
      toast.info("Voice agent disconnected");
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
    } catch (error: any) {
      console.error("Failed to start:", error);
      toast.error(error.message || "Failed to start conversation");
    } finally {
      setIsConnecting(false);
    }
  }, [conversation, agentId]);

  const stopConversation = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

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
      </div>

      {/* Live Conversation Transcript */}
      {(isConnected || messages.length > 0) && (
        <div className="bg-card border border-border rounded-xl p-5 shadow-card space-y-3">
          <h4 className="font-heading font-semibold text-sm text-card-foreground">
            Live Transcript
          </h4>
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
            {messages.length === 0 && isConnected && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Start speaking — your conversation will appear here...
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
