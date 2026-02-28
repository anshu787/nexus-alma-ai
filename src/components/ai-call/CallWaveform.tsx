import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface CallWaveformProps {
  stream: MediaStream | null;
  isActive: boolean;
  isSpeaking: boolean;
}

export default function CallWaveform({ stream, isActive, isSpeaking }: CallWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (!stream || !canvasRef.current || !isActive) return;

    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height * 0.8;
        const hue = isSpeaking ? 200 : 150; // blue when AI speaks, green when listening
        const sat = 70;
        const light = 50 + (dataArray[i] / 255) * 20;
        ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, 0.8)`;
        ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animFrameRef.current!);
      audioCtx.close();
    };
  }, [stream, isActive, isSpeaking]);

  if (!isActive) {
    // Idle animation
    return (
      <div className="flex items-center justify-center gap-1 h-20">
        {Array.from({ length: 24 }).map((_, i) => (
          <motion.div
            key={i}
            className="w-1 rounded-full bg-accent/30"
            animate={{
              height: [4, 8 + Math.random() * 12, 4],
            }}
            transition={{
              duration: 1.2 + Math.random() * 0.8,
              repeat: Infinity,
              delay: i * 0.05,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={80}
      className="w-full h-20 rounded-lg"
    />
  );
}
