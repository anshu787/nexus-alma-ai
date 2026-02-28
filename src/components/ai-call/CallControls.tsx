import { motion } from "framer-motion";
import { Mic, MicOff, PhoneOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CallControlsProps {
  isActive: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  onToggleMute: () => void;
  onEndCall: () => void;
  callDuration: number;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function CallControls({
  isActive,
  isMuted,
  isSpeaking,
  onToggleMute,
  onEndCall,
  callDuration,
}: CallControlsProps) {
  if (!isActive) return null;

  return (
    <div className="flex items-center justify-center gap-6 py-4">
      {/* Call timer */}
      <div className="text-sm font-mono text-muted-foreground tabular-nums">
        {formatTime(callDuration)}
      </div>

      {/* Mute */}
      <motion.div whileTap={{ scale: 0.9 }}>
        <Button
          size="icon"
          variant={isMuted ? "destructive" : "secondary"}
          className="h-14 w-14 rounded-full"
          onClick={onToggleMute}
        >
          {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </Button>
      </motion.div>

      {/* End Call */}
      <motion.div whileTap={{ scale: 0.9 }}>
        <Button
          size="icon"
          variant="destructive"
          className="h-16 w-16 rounded-full shadow-lg"
          onClick={onEndCall}
        >
          <PhoneOff className="h-7 w-7" />
        </Button>
      </motion.div>

      {/* Speaking indicator */}
      <div className={`flex items-center gap-1.5 text-sm ${isSpeaking ? "text-accent" : "text-muted-foreground/40"}`}>
        {isSpeaking ? <Volume2 className="h-5 w-5 animate-pulse" /> : <VolumeX className="h-5 w-5" />}
        <span className="text-xs">{isSpeaking ? "Speaking" : "Silent"}</span>
      </div>
    </div>
  );
}
