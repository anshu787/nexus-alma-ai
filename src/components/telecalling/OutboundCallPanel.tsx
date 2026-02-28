import { useState } from "react";
import { Phone, Loader2, Globe, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function OutboundCallPanel() {
  const { user } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [agentId, setAgentId] = useState("");
  const [calling, setCalling] = useState(false);

  const initiateCall = async () => {
    if (!phoneNumber.trim() || !agentId.trim()) {
      toast.error("Enter both phone number and Agent ID");
      return;
    }

    // Ensure proper format
    let formattedNumber = phoneNumber.trim();
    if (!formattedNumber.startsWith("+")) {
      if (formattedNumber.startsWith("91")) {
        formattedNumber = `+${formattedNumber}`;
      } else if (formattedNumber.length === 10) {
        formattedNumber = `+91${formattedNumber}`;
      }
    }

    setCalling(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "elevenlabs-call-webhook/outbound",
        {
          body: {
            phone_number: formattedNumber,
            agent_id: agentId.trim(),
            user_id: user?.id,
          },
        }
      );

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error, { description: data.help || data.details });
        return;
      }

      toast.success(`Call initiated to ${formattedNumber}`, {
        description: "The AI agent will call this number shortly.",
      });
    } catch (err: any) {
      console.error("Outbound call error:", err);
      toast.error("Failed to initiate call", { description: err.message });
    } finally {
      setCalling(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-card space-y-4">
      <h3 className="font-heading font-semibold text-card-foreground flex items-center gap-2">
        <Globe className="h-4 w-4 text-accent" /> Outbound AI Call
      </h3>
      <p className="text-xs text-muted-foreground">
        Call any phone number using your ElevenLabs AI agent. The agent will call the number and have a conversation.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Agent ID</Label>
          <Input
            placeholder="ElevenLabs Agent ID..."
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            disabled={calling}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Phone Number</Label>
          <Input
            placeholder="+91 98765 43210"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            disabled={calling}
          />
          <p className="text-[10px] text-muted-foreground">
            Indian numbers: enter 10 digits (auto-adds +91) or full international format
          </p>
        </div>
      </div>

      <Button
        variant="hero"
        onClick={initiateCall}
        disabled={calling || !phoneNumber.trim() || !agentId.trim()}
        className="w-full sm:w-auto"
      >
        {calling ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Phone className="h-4 w-4" />
        )}
        {calling ? "Calling..." : "Call with AI Agent"}
        <ArrowRight className="h-3.5 w-3.5 ml-1" />
      </Button>

      <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
        <p className="text-[10px] font-medium text-muted-foreground">How it works:</p>
        <ol className="text-[10px] text-muted-foreground list-decimal list-inside space-y-0.5">
          <li>Your Twilio US number (imported in ElevenLabs) calls the target number</li>
          <li>ElevenLabs AI agent handles the conversation</li>
          <li>The agent can authenticate users, find mentors, update skills, and more</li>
          <li>Call sessions are automatically logged in the Sessions tab</li>
        </ol>
      </div>
    </div>
  );
}
