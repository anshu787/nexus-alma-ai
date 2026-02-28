import { useState, useCallback, useRef, useEffect } from "react";

interface UseWebSpeechOptions {
  onTranscript?: (text: string, isFinal: boolean) => void;
  onSpeechEnd?: () => void;
  lang?: string;
}

export function useWebSpeech(options: UseWebSpeechOptions = {}) {
  const { onTranscript, onSpeechEnd, lang = "en-US" } = options;
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef(window.speechSynthesis);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const shouldListenRef = useRef(false);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      if (finalTranscript) {
        onTranscript?.(finalTranscript.trim(), true);
      } else if (interimTranscript) {
        onTranscript?.(interimTranscript.trim(), false);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      onSpeechEnd?.();
      // Auto-restart if we should still be listening
      if (shouldListenRef.current) {
        restartTimeoutRef.current = setTimeout(() => {
          try {
            recognition.start();
            setIsListening(true);
          } catch (e) {
            // Already started
          }
        }, 300);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed") {
        setSupported(false);
      }
      // For "no-speech" or "aborted", auto-restart handles it
    };

    recognitionRef.current = recognition;

    return () => {
      shouldListenRef.current = false;
      clearTimeout(restartTimeoutRef.current);
      try { recognition.stop(); } catch (e) {}
    };
  }, [lang]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    shouldListenRef.current = true;
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e) {
      // Already started
    }
  }, []);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    clearTimeout(restartTimeoutRef.current);
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch (e) {}
    setIsListening(false);
  }, []);

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!synthRef.current) { resolve(); return; }
      // Stop listening while speaking to avoid echo
      const wasListening = shouldListenRef.current;
      if (wasListening) {
        shouldListenRef.current = false;
        clearTimeout(restartTimeoutRef.current);
        try { recognitionRef.current?.stop(); } catch (e) {}
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      // Pick a good voice
      const voices = synthRef.current.getVoices();
      const preferred = voices.find(
        (v) => v.lang.startsWith("en") && v.name.toLowerCase().includes("female")
      ) || voices.find((v) => v.lang.startsWith("en")) || voices[0];
      if (preferred) utterance.voice = preferred;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        // Resume listening after speaking
        if (wasListening) {
          setTimeout(() => {
            shouldListenRef.current = true;
            try {
              recognitionRef.current?.start();
              setIsListening(true);
            } catch (e) {}
          }, 400);
        }
        resolve();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        if (wasListening) {
          shouldListenRef.current = true;
          try { recognitionRef.current?.start(); setIsListening(true); } catch (e) {}
        }
        resolve();
      };
      synthRef.current.cancel();
      synthRef.current.speak(utterance);
    });
  }, [lang]);

  const cancelSpeech = useCallback(() => {
    synthRef.current?.cancel();
    setIsSpeaking(false);
  }, []);

  return {
    isListening,
    isSpeaking,
    supported,
    startListening,
    stopListening,
    speak,
    cancelSpeech,
  };
}
