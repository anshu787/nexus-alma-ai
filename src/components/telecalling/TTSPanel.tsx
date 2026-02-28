import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, Volume2, FileAudio, Loader2, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const VOICES = [
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah" },
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel" },
];

export default function TTSPanel() {
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState(VOICES[0].id);
  const [generating, setGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const generateSpeech = async () => {
    if (!text.trim()) { toast.error("Enter some text first"); return; }
    setGenerating(true);
    setAudioUrl(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text, voiceId }),
        }
      );

      if (!response.ok) throw new Error("TTS generation failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play();
      toast.success("Audio generated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate speech");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-card space-y-4">
      <h3 className="font-heading font-semibold text-card-foreground flex items-center gap-2">
        <Volume2 className="h-4 w-4 text-accent" /> Text-to-Speech
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs text-muted-foreground">Text</Label>
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Enter text to convert to speech..."
            rows={3}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Voice</Label>
          <Select value={voiceId} onValueChange={setVoiceId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {VOICES.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="hero" onClick={generateSpeech} disabled={generating || !text.trim()}>
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {generating ? "Generating..." : "Generate & Play"}
        </Button>
        {audioUrl && (
          <audio controls src={audioUrl} className="h-8 flex-1" />
        )}
      </div>
    </div>
  );
}
