import { motion } from "framer-motion";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function FloatingVoiceButton() {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="fixed bottom-6 right-6 z-50"
    >
      <Button
        size="icon"
        className="h-14 w-14 rounded-full bg-accent text-accent-foreground shadow-[0_4px_20px_hsla(var(--accent)/0.35)] hover:scale-105 active:scale-95 transition-transform"
        onClick={() => navigate("/ai-call")}
      >
        <Phone className="h-6 w-6" />
      </Button>
    </motion.div>
  );
}
