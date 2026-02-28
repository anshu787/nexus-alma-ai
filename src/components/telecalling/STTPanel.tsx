import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, FileText, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function STTPanel() {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await transcribeAudio(blob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      toast.error("Microphone access required");
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }, []);

  const transcribeAudio = async (blob: Blob) => {
    setTranscribing(true);
    try {
      // Convert blob to base64
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const { data, error } = await supabase.functions.invoke("elevenlabs-stt", {
        body: { audio_base64: base64, filename: "recording.webm" },
      });

      if (error) throw error;
      setTranscript(data.text || "No speech detected");
      toast.success("Transcription complete!");
    } catch (err: any) {
      toast.error(err.message || "Transcription failed");
    } finally {
      setTranscribing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setTranscribing(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const { data, error } = await supabase.functions.invoke("elevenlabs-stt", {
        body: { audio_base64: base64, filename: file.name },
      });

      if (error) throw error;
      setTranscript(data.text || "No speech detected");
      toast.success("File transcribed!");
    } catch (err: any) {
      toast.error(err.message || "Transcription failed");
    } finally {
      setTranscribing(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-card space-y-4">
      <h3 className="font-heading font-semibold text-card-foreground flex items-center gap-2">
        <FileText className="h-4 w-4 text-accent" /> Speech-to-Text
      </h3>

      <div className="flex items-center gap-3 flex-wrap">
        {!recording ? (
          <Button variant="hero" onClick={startRecording} disabled={transcribing}>
            <Mic className="h-4 w-4" /> Record & Transcribe
          </Button>
        ) : (
          <Button variant="destructive" onClick={stopRecording}>
            <MicOff className="h-4 w-4" /> Stop Recording
          </Button>
        )}

        <label>
          <Button variant="outline" size="sm" asChild disabled={transcribing}>
            <span className="cursor-pointer">
              <Upload className="h-4 w-4" /> Upload Audio
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </span>
          </Button>
        </label>

        {(recording || transcribing) && (
          <Badge variant="outline" className={recording ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-accent/10 text-accent border-accent/20"}>
            {recording ? (
              <><span className="h-2 w-2 rounded-full bg-destructive animate-pulse mr-1.5 inline-block" /> Recording...</>
            ) : (
              <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Transcribing...</>
            )}
          </Badge>
        )}
      </div>

      {transcript && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-secondary rounded-lg p-4"
        >
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Transcript</p>
          <p className="text-sm text-foreground whitespace-pre-wrap">{transcript}</p>
        </motion.div>
      )}
    </div>
  );
}
