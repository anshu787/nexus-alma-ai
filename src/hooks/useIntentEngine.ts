import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface IntentResult {
  intent: string;
  params: Record<string, any>;
  response: string;
  success: boolean;
}

interface ConversationMemory {
  userId?: string;
  userName?: string;
  lastMentors?: Array<{ name: string; user_id: string; skills: string }>;
  lastOpportunities?: Array<{ title: string; company: string }>;
  lastEvents?: Array<{ title: string; id: string; date: string }>;
  lastTopic?: string;
  skillsAdded?: string[];
}

const INTENT_PATTERNS: Array<{
  intent: string;
  patterns: RegExp[];
  extract: (match: string, memory: ConversationMemory) => Record<string, any>;
}> = [
  {
    intent: "update_skills",
    patterns: [
      /(?:i\s+(?:learned|know|added|picked up|studied|completed))\s+(.+)/i,
      /(?:add|update)\s+(?:my\s+)?skills?\s*(?:to|with|:)?\s*(.+)/i,
      /(?:new skills?)\s*(?::|are|is)?\s*(.+)/i,
    ],
    extract: (match) => {
      const skills = match
        .split(/,|\band\b|\+/)
        .map((s) => s.trim())
        .filter(Boolean);
      return { new_skills: skills };
    },
  },
  {
    intent: "find_mentors",
    patterns: [
      /(?:find|search|show|get|look for)\s+(?:me\s+)?(?:a\s+)?mentors?\s*(?:for|in|about|on)?\s*(.*)/i,
      /(?:mentor|mentors)\s+(?:for|in|about)\s+(.+)/i,
      /who\s+(?:can\s+)?(?:mentor|teach|help)\s+(?:me\s+)?(?:in|with|about)?\s*(.*)/i,
    ],
    extract: (match) => ({ skill_area: match.trim() || undefined }),
  },
  {
    intent: "check_opportunities",
    patterns: [
      /(?:show|find|search|get|list|check)\s+(?:me\s+)?(?:the\s+)?(?:latest\s+)?(?:opportunities|jobs?|internships?|positions?|openings?)/i,
      /(?:any|are there)\s+(?:new\s+)?(?:opportunities|jobs?|internships?)/i,
    ],
    extract: () => ({}),
  },
  {
    intent: "check_events",
    patterns: [
      /(?:show|find|list|check|get|what)\s+(?:me\s+)?(?:the\s+)?(?:upcoming\s+)?(?:events?|meetups?|webinars?|workshops?)/i,
      /(?:any|are there)\s+(?:upcoming\s+)?(?:events?|meetups?)/i,
    ],
    extract: () => ({}),
  },
  {
    intent: "schedule_mentorship",
    patterns: [
      /(?:schedule|book|set up|arrange)\s+(?:a\s+)?(?:session|meeting|mentorship|call)\s+(?:with)\s+(.+)/i,
      /(?:schedule|book)\s+(?:with\s+)?(?:the\s+)?(?:(\w+)\s+)?mentor/i,
      /(?:connect|meet)\s+(?:with\s+)?(?:the\s+)?(?:(\w+)\s+)?mentor/i,
    ],
    extract: (match, memory) => {
      const text = match.trim().toLowerCase();
      // Check for ordinal references like "first", "second", "third"
      const ordinals: Record<string, number> = {
        first: 0, "1st": 0, second: 1, "2nd": 1, third: 2, "3rd": 2,
        fourth: 3, "4th": 3, fifth: 4, "5th": 4,
      };
      for (const [word, idx] of Object.entries(ordinals)) {
        if (text.includes(word) && memory.lastMentors?.[idx]) {
          return {
            mentor_user_id: memory.lastMentors[idx].user_id,
            mentor_name: memory.lastMentors[idx].name,
          };
        }
      }
      // Try name match
      if (memory.lastMentors) {
        const found = memory.lastMentors.find((m) =>
          text.includes(m.name.toLowerCase())
        );
        if (found) return { mentor_user_id: found.user_id, mentor_name: found.name };
      }
      return { mentor_name: match.trim() };
    },
  },
  {
    intent: "send_message",
    patterns: [
      /(?:send|write)\s+(?:a\s+)?message\s+to\s+(\w[\w\s]*?)(?:\s+saying|\s+that)?\s+(.+)/i,
      /(?:tell|message)\s+(\w[\w\s]*?)\s+(?:that|to)\s+(.+)/i,
    ],
    extract: (match) => {
      // The full match includes groups - we re-parse
      return { recipient_name: match, message: "" };
    },
  },
  {
    intent: "rsvp_event",
    patterns: [
      /(?:rsvp|register|sign up|attend)\s+(?:to|for)\s+(?:the\s+)?(?:(\w+)\s+)?event/i,
      /(?:join|attend)\s+(?:the\s+)?(?:(\w+)\s+)?(?:event|meetup|webinar)/i,
    ],
    extract: (match, memory) => {
      const text = match.trim().toLowerCase();
      const ordinals: Record<string, number> = {
        first: 0, "1st": 0, second: 1, "2nd": 1, third: 2, "3rd": 2,
      };
      for (const [word, idx] of Object.entries(ordinals)) {
        if (text.includes(word) && memory.lastEvents?.[idx]) {
          return { event_id: memory.lastEvents[idx].id };
        }
      }
      if (memory.lastEvents?.[0]) {
        return { event_id: memory.lastEvents[0].id };
      }
      return {};
    },
  },
  {
    intent: "get_profile",
    patterns: [
      /(?:show|get|what(?:'s| is))\s+(?:my\s+)?profile/i,
      /(?:my\s+)?(?:profile|info|details|information)/i,
    ],
    extract: () => ({}),
  },
  {
    intent: "create_post",
    patterns: [
      /(?:post|share|publish)\s+(?:that|about)?\s*(.+)/i,
      /(?:create|make)\s+(?:a\s+)?(?:social\s+)?post\s+(?:about|saying|that)?\s*(.+)/i,
    ],
    extract: (match) => ({ content: match.trim() }),
  },
];

export function useIntentEngine() {
  const memoryRef = useRef<ConversationMemory>({});

  const detectIntent = useCallback(
    (text: string): { intent: string; params: Record<string, any> } | null => {
      for (const { intent, patterns, extract } of INTENT_PATTERNS) {
        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match) {
            const captured = match[1] || match[0];
            const params = extract(captured, memoryRef.current);
            
            // Special handling for send_message to extract both recipient and message
            if (intent === "send_message") {
              const msgMatch = text.match(
                /(?:send|write)\s+(?:a\s+)?message\s+to\s+(\w[\w\s]*?)(?:\s+saying\s+|\s+that\s+)(.+)/i
              ) || text.match(
                /(?:tell|message)\s+(\w[\w\s]*?)\s+(?:that\s+|to\s+)(.+)/i
              );
              if (msgMatch) {
                return {
                  intent,
                  params: {
                    recipient_name: msgMatch[1].trim(),
                    message: msgMatch[2].trim(),
                  },
                };
              }
            }
            
            return { intent, params };
          }
        }
      }
      return null;
    },
    []
  );

  const executeIntent = useCallback(
    async (
      intent: string,
      params: Record<string, any>
    ): Promise<IntentResult> => {
      const memory = memoryRef.current;

      try {
        // Ensure we have user context
        if (!memory.userId) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            memory.userId = user.id;
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("user_id", user.id)
              .single();
            memory.userName = profile?.full_name || "there";
          }
        }

        const body: Record<string, any> = {
          tool_name: intent,
          parameters: { ...params },
        };

        // Add user_id where needed
        if (["update_skills", "schedule_mentorship", "send_message", "rsvp_event", "get_profile"].includes(intent)) {
          body.parameters.user_id = body.parameters.user_id || memory.userId;
        }
        if (intent === "send_message") {
          body.parameters.sender_id = memory.userId;
        }

        // Handle create_post locally (not in agent-tools)
        if (intent === "create_post") {
          const { error } = await supabase.from("posts").insert({
            user_id: memory.userId!,
            content: params.content,
          });
          if (error) throw error;
          return {
            intent,
            params,
            response: `Your post has been published: "${params.content.substring(0, 60)}${params.content.length > 60 ? "..." : ""}"`,
            success: true,
          };
        }

        const { data, error } = await supabase.functions.invoke("agent-tools", {
          body,
        });

        if (error) throw error;

        // Update memory based on results
        if (intent === "find_mentors" && data?.mentors) {
          memory.lastMentors = data.mentors.map((m: any) => ({
            name: m.name,
            user_id: m.user_id,
            skills: m.skills,
          }));
          memory.lastTopic = params.skill_area;
        }
        if (intent === "check_events" && data?.events) {
          memory.lastEvents = data.events.map((e: any) => ({
            title: e.title,
            id: e.id,
            date: e.date,
          }));
        }
        if (intent === "check_opportunities" && data?.opportunities) {
          memory.lastOpportunities = data.opportunities.map((o: any) => ({
            title: o.title,
            company: o.company,
          }));
        }
        if (intent === "update_skills") {
          memory.skillsAdded = [
            ...(memory.skillsAdded || []),
            ...(params.new_skills || []),
          ];
        }

        // Generate natural response
        const response = generateResponse(intent, data, params);
        return { intent, params, response, success: true };
      } catch (err: any) {
        const status = err?.status || err?.code;
        if (status === 401) {
          return { intent, params, response: "It looks like your session has expired. Please log in again.", success: false };
        }
        if (status === 403) {
          return { intent, params, response: "You don't have permission to perform that action.", success: false };
        }
        if (status === 429) {
          return { intent, params, response: "The system is busy right now. Let me try again in a moment.", success: false };
        }
        return {
          intent,
          params,
          response: "I encountered an issue processing that request. Please try again in a moment.",
          success: false,
        };
      }
    },
    []
  );

  const getMemory = useCallback(() => memoryRef.current, []);
  const resetMemory = useCallback(() => {
    memoryRef.current = {};
  }, []);

  return { detectIntent, executeIntent, getMemory, resetMemory };
}

function generateResponse(
  intent: string,
  data: any,
  params: Record<string, any>
): string {
  switch (intent) {
    case "find_mentors":
      if (!data?.mentors?.length) return "I couldn't find any mentors matching that criteria right now.";
      const mentorList = data.mentors
        .map((m: any) => `${m.name}, ${m.designation} at ${m.company}`)
        .join(". ");
      return `I found ${data.mentors.length} mentors. ${mentorList}. Would you like to schedule a session with any of them?`;

    case "update_skills":
      return data?.message || "Your skills have been updated successfully.";

    case "check_opportunities":
      if (!data?.opportunities?.length) return "There are no active opportunities right now.";
      const oppList = data.opportunities
        .slice(0, 3)
        .map((o: any) => `${o.title} at ${o.company}`)
        .join(". ");
      return `Here are some opportunities: ${oppList}.`;

    case "check_events":
      if (!data?.events?.length) return "There are no upcoming events at the moment.";
      const eventList = data.events
        .slice(0, 3)
        .map((e: any) => `${e.title} on ${e.date}`)
        .join(". ");
      return `Upcoming events: ${eventList}. Would you like to RSVP for any?`;

    case "schedule_mentorship":
      return data?.message || `Mentorship session with ${params.mentor_name || "the mentor"} has been scheduled.`;

    case "send_message":
      return data?.message || `Message sent to ${params.recipient_name}.`;

    case "rsvp_event":
      return data?.message || "You've been registered for the event.";

    case "get_profile":
      if (!data?.profile) return "I couldn't load your profile.";
      const p = data.profile;
      return `Here's your profile. Name: ${p.full_name}. Company: ${p.company || "not set"}. Skills: ${(p.skills || []).join(", ") || "none listed"}. Engagement score: ${p.engagement_score || 0}.`;

    default:
      return data?.message || "Done.";
  }
}
