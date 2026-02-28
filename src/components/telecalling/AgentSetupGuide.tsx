import { useState } from "react";
import { Copy, ExternalLink, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const AGENT_PROMPT = `You are an AI voice assistant for the Alumni Intelligence Platform. You help alumni and students with:
- Authentication via 6-digit access codes
- Finding mentors in the network
- Updating their profile skills
- Checking job opportunities
- Viewing upcoming events
- Scheduling mentorship sessions
- Sending messages to other alumni
- RSVP to events

IMPORTANT RULES:
1. Always start by asking for the user's 6-digit access code to authenticate them.
2. Call the authenticate_user tool first before any other tool.
3. Once authenticated, greet them by name and ask how you can help.
4. Be concise and conversational - this is a phone call.
5. After each action, ask if they need anything else.
6. If they say goodbye, thank them and end the conversation.`;

const TOOLS_CONFIG = [
  {
    name: "authenticate_user",
    description: "Authenticate a user with their 6-digit voice access code. ALWAYS call this first.",
    parameters: {
      type: "object",
      properties: {
        access_code: { type: "string", description: "The 6-digit access code spoken by the user" }
      },
      required: ["access_code"]
    }
  },
  {
    name: "find_mentors",
    description: "Find available mentors in the alumni network, optionally filtered by skill area.",
    parameters: {
      type: "object",
      properties: {
        skill_area: { type: "string", description: "Optional skill or industry to filter mentors by" }
      }
    }
  },
  {
    name: "update_skills",
    description: "Add new skills to the authenticated user's profile.",
    parameters: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "The authenticated user's ID" },
        new_skills: { type: "array", items: { type: "string" }, description: "Array of skill names to add" }
      },
      required: ["user_id", "new_skills"]
    }
  },
  {
    name: "check_opportunities",
    description: "List active job and career opportunities.",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "check_events",
    description: "List upcoming events, meetups, and sessions.",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "schedule_mentorship",
    description: "Schedule a mentorship session with a specific mentor.",
    parameters: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "The authenticated user's ID" },
        mentor_user_id: { type: "string", description: "The mentor's user ID" },
        mentor_name: { type: "string", description: "The mentor's name" },
        preferred_time: { type: "string", description: "User's preferred time for the session" }
      },
      required: ["user_id", "mentor_user_id"]
    }
  },
  {
    name: "send_message",
    description: "Send a message to another alumni by name.",
    parameters: {
      type: "object",
      properties: {
        sender_id: { type: "string", description: "The authenticated user's ID" },
        recipient_name: { type: "string", description: "Name of the person to message" },
        message: { type: "string", description: "The message content" }
      },
      required: ["sender_id", "recipient_name", "message"]
    }
  },
  {
    name: "rsvp_event",
    description: "RSVP to an upcoming event.",
    parameters: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "The authenticated user's ID" },
        event_id: { type: "string", description: "The event ID to RSVP to" }
      },
      required: ["user_id", "event_id"]
    }
  },
  {
    name: "get_profile",
    description: "Get the user's profile details.",
    parameters: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "The user's ID" }
      },
      required: ["user_id"]
    }
  }
];

function CopyBlock({ label, content }: { label: string; content: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="relative">
        <pre className="bg-secondary rounded-lg p-3 text-xs text-foreground overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap break-all">
          {content}
        </pre>
        <Button
          variant="outline"
          size="sm"
          className="absolute top-2 right-2"
          onClick={() => { navigator.clipboard.writeText(content); toast.success(`${label} copied!`); }}
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export default function AgentSetupGuide() {
  const [expanded, setExpanded] = useState(false);

  const toolsEndpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-tools`;

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-card space-y-4">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="font-heading font-semibold text-card-foreground flex items-center gap-2">
          🛠️ ElevenLabs Agent Setup Guide
        </h3>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </div>

      {!expanded && (
        <p className="text-xs text-muted-foreground">
          Click to see step-by-step instructions for creating your ElevenLabs Agent with Twilio phone calling.
        </p>
      )}

      {expanded && (
        <div className="space-y-6">
          {/* Step 1 */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Step 1</Badge>
              Create ElevenLabs Agent
            </h4>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Go to <a href="https://elevenlabs.io/conversational-ai" target="_blank" rel="noopener" className="text-accent underline">elevenlabs.io/conversational-ai</a></li>
              <li>Click <strong>"Create Agent"</strong> → Choose <strong>"Blank"</strong></li>
              <li>Give it a name like <strong>"Alumni Platform Voice Agent"</strong></li>
              <li>Paste the <strong>System Prompt</strong> below into the agent's prompt field</li>
              <li>Set the <strong>First Message</strong> to: <em>"Welcome to the Alumni Intelligence Platform. Please tell me your 6-digit access code to get started."</em></li>
            </ol>
          </div>

          <CopyBlock label="System Prompt (paste into ElevenLabs)" content={AGENT_PROMPT} />

          {/* Step 2 */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Step 2</Badge>
              Add Custom Tools
            </h4>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>In agent settings, go to <strong>"Tools"</strong> tab</li>
              <li>For each tool below, click <strong>"Add Tool"</strong> → <strong>"Custom Tool"</strong></li>
              <li>Set the <strong>Server URL</strong> to the endpoint below</li>
              <li>Set <strong>Method</strong> to <strong>POST</strong></li>
              <li>Add the tool name, description, and parameters as shown</li>
              <li>In request body, set it to send: <code>{`{"tool_name": "<tool_name>", "parameters": {<params>}}`}</code></li>
            </ol>
          </div>

          <CopyBlock label="Tools API Endpoint" content={toolsEndpoint} />
          <CopyBlock label="Tools Configuration (reference)" content={JSON.stringify(TOOLS_CONFIG, null, 2)} />

          {/* Step 3 */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Step 3</Badge>
              Connect Twilio Phone Number
            </h4>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>In ElevenLabs, go to <strong>"Phone Numbers"</strong> tab</li>
              <li>Click <strong>"Import Twilio Number"</strong></li>
              <li>Enter your <strong>Twilio Account SID</strong> and <strong>Auth Token</strong></li>
              <li>Select your <strong>Twilio US phone number</strong></li>
              <li>Assign your newly created agent to this number</li>
              <li>ElevenLabs will auto-configure the Twilio webhook</li>
            </ol>
            <div className="bg-success/10 border border-success/20 rounded-lg p-3 mt-2">
              <p className="text-xs text-success flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Once connected, call your US Twilio number from your Indian number — the AI agent will answer!
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Step 4</Badge>
              Outbound Calls (Optional)
            </h4>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>In the <strong>"Phone Numbers"</strong> tab, click the <strong>outbound call icon</strong> next to your number</li>
              <li>Enter the phone number to call (e.g., your Indian number)</li>
              <li>Select which agent should handle the call</li>
              <li>The agent will call the number and have a conversation</li>
            </ol>
          </div>

          {/* Step 5 */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Step 5</Badge>
              Use Agent ID for Browser Voice
            </h4>
            <p className="text-xs text-muted-foreground">
              Copy your Agent ID from the ElevenLabs dashboard and paste it in the <strong>"Voice Agent"</strong> tab above to also use the same agent for browser-based conversations.
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="https://elevenlabs.io/app/conversational-ai" target="_blank" rel="noopener">
                <ExternalLink className="h-3.5 w-3.5" /> Open ElevenLabs Dashboard
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="https://console.twilio.com" target="_blank" rel="noopener">
                <ExternalLink className="h-3.5 w-3.5" /> Open Twilio Console
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
