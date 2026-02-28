import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import VapiVoiceAssistant from "@/components/telecalling/VapiVoiceAssistant";

export default function FloatingVoiceButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* FAB */}
      <AnimatePresence>
        {!open && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button
              size="icon"
              className="h-14 w-14 rounded-full bg-accent text-accent-foreground shadow-[0_4px_20px_hsla(var(--accent)/0.35)] hover:scale-105 active:scale-95 transition-transform"
              onClick={() => setOpen(true)}
            >
              <Phone className="h-6 w-6" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-3rem)] max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl"
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-heading font-semibold text-sm text-foreground">AI Mentor Assistant</h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4">
              <VapiVoiceAssistant />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
