import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface TranscriptMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
}

interface CallTranscriptProps {
  messages: TranscriptMessage[];
  partialText?: string;
  isListening: boolean;
}

export default function CallTranscript({ messages, partialText, isListening }: CallTranscriptProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, partialText]);

  return (
    <div className="flex-1 overflow-y-auto space-y-3 px-1">
      <AnimatePresence>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-secondary text-secondary-foreground rounded-bl-md"
              }`}
            >
              <p className="text-[10px] font-semibold opacity-60 mb-0.5">
                {msg.role === "user" ? "You" : "AI Assistant"}
              </p>
              {msg.text}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Partial transcript (live) */}
      {partialText && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-end"
        >
          <div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm bg-primary/50 text-primary-foreground rounded-br-md border border-dashed border-primary/40">
            <p className="text-[10px] font-semibold opacity-60 mb-0.5">You (listening...)</p>
            {partialText}
            <span className="inline-block w-1 h-3.5 bg-primary-foreground/50 animate-pulse ml-0.5 align-middle" />
          </div>
        </motion.div>
      )}

      {messages.length === 0 && !partialText && (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground/60">
            {isListening ? "Listening... speak now" : "Start the call to begin your conversation"}
          </p>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
