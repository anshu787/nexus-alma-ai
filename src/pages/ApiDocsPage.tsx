import { useState } from "react";
import { motion } from "framer-motion";
import { Book, Code2, Key, Shield, Zap, Copy, Check, ChevronDown, ChevronRight, Users, MessageSquare, Bell, Briefcase, Heart, Link2, Award, Mail, Globe, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BASE_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/api`;

interface Endpoint {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  description: string;
  auth: "jwt" | "api-key" | "both";
  params?: { name: string; type: string; required: boolean; description: string }[];
  body?: { name: string; type: string; required: boolean; description: string }[];
  response: string;
}

const methodColors: Record<string, string> = {
  GET: "bg-info/15 text-info border-info/30",
  POST: "bg-success/15 text-success border-success/30",
  PUT: "bg-warning/15 text-warning border-warning/30",
  DELETE: "bg-destructive/15 text-destructive border-destructive/30",
};

const sections: { title: string; icon: typeof Book; endpoints: Endpoint[] }[] = [
  {
    title: "Authentication & Health",
    icon: Key,
    endpoints: [
      { method: "GET", path: "/health", description: "Health check — verify API is running", auth: "both", response: `{ "status": "ok", "timestamp": "ISO8601", "version": "2.0.0" }` },
      { method: "GET", path: "/me", description: "Get current user profile, roles, and email", auth: "jwt", response: `{ "user": { "id": "uuid", "email": "string" }, "profile": { ... }, "roles": ["alumni"] }` },
    ],
  },
  {
    title: "Profiles",
    icon: Users,
    endpoints: [
      {
        method: "GET", path: "/profiles", description: "List alumni profiles with pagination, search, and filters",
        auth: "both",
        params: [
          { name: "limit", type: "number", required: false, description: "Results per page (default: 20)" },
          { name: "offset", type: "number", required: false, description: "Pagination offset (default: 0)" },
          { name: "search", type: "string", required: false, description: "Filter by name (partial match)" },
          { name: "department", type: "string", required: false, description: "Filter by department" },
          { name: "company", type: "string", required: false, description: "Filter by company" },
          { name: "is_mentor", type: "boolean", required: false, description: "Filter mentors only (true)" },
        ],
        response: `[{ "user_id": "uuid", "full_name": "string", "company": "string", "skills": ["string"], ... }]`,
      },
      { method: "GET", path: "/profiles/:userId", description: "Get a single profile by user ID", auth: "both", response: `{ "user_id": "uuid", "full_name": "string", ... }` },
      {
        method: "PUT", path: "/profiles/:userId", description: "Update own profile (JWT required)",
        auth: "jwt",
        body: [
          { name: "full_name", type: "string", required: false, description: "Display name" },
          { name: "bio", type: "string", required: false, description: "Bio text" },
          { name: "company", type: "string", required: false, description: "Current company" },
          { name: "skills", type: "string[]", required: false, description: "Skills array" },
          { name: "location", type: "string", required: false, description: "Location" },
        ],
        response: `{ "user_id": "uuid", "full_name": "string", ... }`,
      },
    ],
  },
  {
    title: "Social Feed (Posts)",
    icon: Code2,
    endpoints: [
      {
        method: "GET", path: "/posts", description: "List posts with pagination",
        auth: "both",
        params: [
          { name: "limit", type: "number", required: false, description: "Results per page (default: 20)" },
          { name: "offset", type: "number", required: false, description: "Pagination offset" },
        ],
        response: `[{ "id": "uuid", "content": "string", "user_id": "uuid", "likes_count": 0, ... }]`,
      },
      { method: "GET", path: "/posts/:id", description: "Get single post details", auth: "both", response: `{ "id": "uuid", "content": "string", ... }` },
      {
        method: "POST", path: "/posts", description: "Create a new post",
        auth: "jwt",
        body: [
          { name: "content", type: "string", required: true, description: "Post content text" },
          { name: "image_url", type: "string", required: false, description: "Optional image URL" },
        ],
        response: `{ "id": "uuid", "content": "string", "user_id": "uuid", ... }`,
      },
      { method: "DELETE", path: "/posts/:id", description: "Delete own post", auth: "jwt", response: `{ "success": true }` },
      { method: "POST", path: "/posts/:id/likes", description: "Like a post", auth: "jwt", response: `{ "id": "uuid", "post_id": "uuid", ... }` },
      { method: "DELETE", path: "/posts/:id/likes", description: "Unlike a post", auth: "jwt", response: `{ "success": true }` },
      { method: "GET", path: "/posts/:id/comments", description: "Get comments for a post", auth: "both", response: `[{ "id": "uuid", "content": "string", ... }]` },
      {
        method: "POST", path: "/posts/:id/comments", description: "Add a comment to a post",
        auth: "jwt",
        body: [{ name: "content", type: "string", required: true, description: "Comment text" }],
        response: `{ "id": "uuid", "content": "string", ... }`,
      },
    ],
  },
  {
    title: "Events",
    icon: Zap,
    endpoints: [
      {
        method: "GET", path: "/events", description: "List upcoming events",
        auth: "both",
        params: [
          { name: "limit", type: "number", required: false, description: "Max results (default: 20)" },
          { name: "type", type: "string", required: false, description: "Filter by event_type" },
        ],
        response: `[{ "id": "uuid", "title": "string", "start_date": "ISO8601", ... }]`,
      },
      { method: "GET", path: "/events/:id", description: "Get event details", auth: "both", response: `{ "id": "uuid", "title": "string", ... }` },
      {
        method: "POST", path: "/events", description: "Create an event",
        auth: "jwt",
        body: [
          { name: "title", type: "string", required: true, description: "Event title" },
          { name: "start_date", type: "ISO8601", required: true, description: "Start date/time" },
          { name: "description", type: "string", required: false, description: "Event description" },
          { name: "location", type: "string", required: false, description: "Event location" },
          { name: "is_virtual", type: "boolean", required: false, description: "Is virtual event" },
          { name: "virtual_link", type: "string", required: false, description: "Virtual meeting link" },
        ],
        response: `{ "id": "uuid", "title": "string", ... }`,
      },
      { method: "POST", path: "/events/:id/rsvp", description: "RSVP to an event", auth: "jwt", body: [{ name: "status", type: "string", required: false, description: "'going', 'maybe', 'not_going'" }], response: `{ "id": "uuid", "event_id": "uuid", ... }` },
      { method: "DELETE", path: "/events/:id/rsvp", description: "Cancel RSVP", auth: "jwt", response: `{ "success": true }` },
      { method: "GET", path: "/events/:id/attendees", description: "List event RSVPs/attendees", auth: "both", response: `[{ "id": "uuid", "user_id": "uuid", "status": "going", ... }]` },
    ],
  },
  {
    title: "Messages",
    icon: MessageSquare,
    endpoints: [
      {
        method: "GET", path: "/messages", description: "Get messages (optionally filtered by partner)",
        auth: "jwt",
        params: [{ name: "partner_id", type: "uuid", required: false, description: "Filter conversation by partner user ID" }],
        response: `[{ "id": "uuid", "sender_id": "uuid", "receiver_id": "uuid", "content": "string", ... }]`,
      },
      {
        method: "POST", path: "/messages", description: "Send a message",
        auth: "jwt",
        body: [
          { name: "receiver_id", type: "uuid", required: true, description: "Recipient user ID" },
          { name: "content", type: "string", required: true, description: "Message text" },
        ],
        response: `{ "id": "uuid", "sender_id": "uuid", ... }`,
      },
      { method: "PUT", path: "/messages/:id", description: "Mark message as read", auth: "jwt", response: `{ "id": "uuid", "is_read": true, ... }` },
    ],
  },
  {
    title: "Notifications",
    icon: Bell,
    endpoints: [
      {
        method: "GET", path: "/notifications", description: "Get user notifications",
        auth: "jwt",
        params: [
          { name: "limit", type: "number", required: false, description: "Max results (default: 20)" },
          { name: "unread", type: "boolean", required: false, description: "Filter unread only (true/false)" },
        ],
        response: `[{ "id": "uuid", "title": "string", "message": "string", "is_read": false, ... }]`,
      },
      { method: "PUT", path: "/notifications/:id", description: "Mark notification as read", auth: "jwt", response: `{ "id": "uuid", "is_read": true, ... }` },
    ],
  },
  {
    title: "Opportunities",
    icon: Briefcase,
    endpoints: [
      {
        method: "GET", path: "/opportunities", description: "List active job/internship opportunities",
        auth: "both",
        params: [
          { name: "limit", type: "number", required: false, description: "Max results (default: 20)" },
          { name: "type", type: "string", required: false, description: "Filter by type: 'job', 'internship', 'mentorship'" },
          { name: "search", type: "string", required: false, description: "Search by title" },
        ],
        response: `[{ "id": "uuid", "title": "string", "company": "string", "apply_url": "string", ... }]`,
      },
      { method: "GET", path: "/opportunities/:id", description: "Get opportunity details", auth: "both", response: `{ "id": "uuid", "title": "string", ... }` },
      {
        method: "POST", path: "/opportunities", description: "Post a new opportunity",
        auth: "jwt",
        body: [
          { name: "title", type: "string", required: true, description: "Job title" },
          { name: "company", type: "string", required: true, description: "Company name" },
          { name: "description", type: "string", required: false, description: "Job description" },
          { name: "location", type: "string", required: false, description: "Location" },
          { name: "apply_url", type: "string", required: false, description: "Application URL" },
          { name: "salary_range", type: "string", required: false, description: "Salary range" },
          { name: "type", type: "string", required: false, description: "'job', 'internship', 'mentorship'" },
        ],
        response: `{ "id": "uuid", "title": "string", ... }`,
      },
      { method: "PUT", path: "/opportunities/:id", description: "Update an opportunity", auth: "jwt", body: [{ name: "title", type: "string", required: false, description: "Updated title" }], response: `{ "id": "uuid", ... }` },
    ],
  },
  {
    title: "Campaigns & Donations",
    icon: Heart,
    endpoints: [
      {
        method: "GET", path: "/campaigns", description: "List fundraising campaigns",
        auth: "both",
        params: [
          { name: "limit", type: "number", required: false, description: "Max results (default: 20)" },
          { name: "active", type: "boolean", required: false, description: "Filter active only" },
        ],
        response: `[{ "id": "uuid", "title": "string", "goal_amount": 10000, "raised_amount": 5000, ... }]`,
      },
      { method: "GET", path: "/campaigns/:id", description: "Get campaign details", auth: "both", response: `{ "id": "uuid", "title": "string", ... }` },
      {
        method: "POST", path: "/campaigns", description: "Create a fundraising campaign (admin)",
        auth: "jwt",
        body: [
          { name: "title", type: "string", required: true, description: "Campaign title" },
          { name: "goal_amount", type: "number", required: false, description: "Fundraising goal" },
          { name: "description", type: "string", required: false, description: "Campaign description" },
        ],
        response: `{ "id": "uuid", "title": "string", ... }`,
      },
      { method: "PUT", path: "/campaigns/:id", description: "Update a campaign", auth: "jwt", response: `{ "id": "uuid", ... }` },
      { method: "GET", path: "/campaigns/:id/donations", description: "List donations for a campaign", auth: "both", response: `[{ "id": "uuid", "amount": 100, ... }]` },
      {
        method: "POST", path: "/campaigns/:id/donations", description: "Make a donation to a campaign",
        auth: "jwt",
        body: [
          { name: "amount", type: "number", required: true, description: "Donation amount" },
          { name: "message", type: "string", required: false, description: "Donation message" },
          { name: "is_anonymous", type: "boolean", required: false, description: "Anonymous donation" },
        ],
        response: `{ "id": "uuid", "amount": 100, ... }`,
      },
      { method: "GET", path: "/donations", description: "Get own donation history", auth: "jwt", response: `[{ "id": "uuid", "amount": 100, "campaign_id": "uuid", ... }]` },
    ],
  },
  {
    title: "Connections",
    icon: Link2,
    endpoints: [
      {
        method: "GET", path: "/connections", description: "List user's connections",
        auth: "jwt",
        params: [{ name: "status", type: "string", required: false, description: "Filter by status: 'pending', 'accepted', 'rejected'" }],
        response: `[{ "id": "uuid", "source_user_id": "uuid", "target_user_id": "uuid", "status": "accepted", ... }]`,
      },
      {
        method: "POST", path: "/connections", description: "Send a connection request",
        auth: "jwt",
        body: [
          { name: "target_user_id", type: "uuid", required: true, description: "User to connect with" },
          { name: "relation_type", type: "string", required: false, description: "'connection', 'mentor', 'referral'" },
        ],
        response: `{ "id": "uuid", "status": "pending", ... }`,
      },
      { method: "PUT", path: "/connections/:id", description: "Accept/reject connection", auth: "jwt", body: [{ name: "status", type: "string", required: true, description: "'accepted' or 'rejected'" }], response: `{ "id": "uuid", "status": "accepted", ... }` },
      { method: "DELETE", path: "/connections/:id", description: "Remove a connection", auth: "jwt", response: `{ "success": true }` },
    ],
  },
  {
    title: "Forum",
    icon: MessageSquare,
    endpoints: [
      {
        method: "GET", path: "/forum", description: "List forum posts",
        auth: "both",
        params: [
          { name: "limit", type: "number", required: false, description: "Results per page (default: 20)" },
          { name: "offset", type: "number", required: false, description: "Pagination offset" },
          { name: "category", type: "string", required: false, description: "Filter by category" },
        ],
        response: `[{ "id": "uuid", "title": "string", "category": "general", "replies_count": 5, ... }]`,
      },
      { method: "GET", path: "/forum/:id", description: "Get forum post details", auth: "both", response: `{ "id": "uuid", "title": "string", ... }` },
      {
        method: "POST", path: "/forum", description: "Create a forum post",
        auth: "jwt",
        body: [
          { name: "title", type: "string", required: true, description: "Post title" },
          { name: "content", type: "string", required: true, description: "Post content" },
          { name: "category", type: "string", required: false, description: "Category (default: 'general')" },
          { name: "tags", type: "string[]", required: false, description: "Tags array" },
        ],
        response: `{ "id": "uuid", "title": "string", ... }`,
      },
      { method: "PUT", path: "/forum/:id", description: "Update own forum post", auth: "jwt", response: `{ "id": "uuid", ... }` },
      { method: "DELETE", path: "/forum/:id", description: "Delete own forum post", auth: "jwt", response: `{ "success": true }` },
      { method: "GET", path: "/forum/:id/replies", description: "Get replies for a forum post", auth: "both", response: `[{ "id": "uuid", "content": "string", ... }]` },
      {
        method: "POST", path: "/forum/:id/replies", description: "Reply to a forum post",
        auth: "jwt",
        body: [{ name: "content", type: "string", required: true, description: "Reply content" }],
        response: `{ "id": "uuid", "content": "string", ... }`,
      },
    ],
  },
  {
    title: "Success Stories",
    icon: Star,
    endpoints: [
      {
        method: "GET", path: "/success-stories", description: "List success stories",
        auth: "both",
        params: [
          { name: "limit", type: "number", required: false, description: "Max results (default: 20)" },
          { name: "featured", type: "boolean", required: false, description: "Filter featured only" },
        ],
        response: `[{ "id": "uuid", "title": "string", "content": "string", "is_featured": false, ... }]`,
      },
      { method: "GET", path: "/success-stories/:id", description: "Get story details", auth: "both", response: `{ "id": "uuid", "title": "string", ... }` },
      {
        method: "POST", path: "/success-stories", description: "Submit a success story",
        auth: "jwt",
        body: [
          { name: "title", type: "string", required: true, description: "Story title" },
          { name: "content", type: "string", required: true, description: "Story content" },
          { name: "tags", type: "string[]", required: false, description: "Tags" },
          { name: "image_url", type: "string", required: false, description: "Image URL" },
        ],
        response: `{ "id": "uuid", "title": "string", ... }`,
      },
      { method: "PUT", path: "/success-stories/:id", description: "Update a success story", auth: "jwt", response: `{ "id": "uuid", ... }` },
    ],
  },
  {
    title: "Institutions",
    icon: Globe,
    endpoints: [
      { method: "GET", path: "/institutions", description: "List all institutions", auth: "both", response: `[{ "id": "uuid", "name": "string", "slug": "string", ... }]` },
      { method: "GET", path: "/institutions/:id", description: "Get institution details", auth: "both", response: `{ "id": "uuid", "name": "string", ... }` },
    ],
  },
  {
    title: "Stories (24h Ephemeral)",
    icon: Zap,
    endpoints: [
      { method: "GET", path: "/stories", description: "List active stories (not expired)", auth: "both", response: `[{ "id": "uuid", "content": "string", "expires_at": "ISO8601", ... }]` },
      { method: "POST", path: "/stories", description: "Create a story (expires in 24h)", auth: "jwt", body: [{ name: "content", type: "string", required: false, description: "Story text" }, { name: "image_url", type: "string", required: false, description: "Image URL" }], response: `{ "id": "uuid", ... }` },
      { method: "DELETE", path: "/stories/:id", description: "Delete own story", auth: "jwt", response: `{ "success": true }` },
    ],
  },
  {
    title: "Referrals",
    icon: Shield,
    endpoints: [
      { method: "GET", path: "/referrals", description: "List referral requests", auth: "jwt", response: `[{ "id": "uuid", "company": "string", "status": "pending", ... }]` },
      {
        method: "POST", path: "/referrals", description: "Create referral request",
        auth: "jwt",
        body: [
          { name: "alumni_id", type: "uuid", required: true, description: "Target alumni user ID" },
          { name: "company", type: "string", required: true, description: "Company name" },
          { name: "position", type: "string", required: false, description: "Position title" },
          { name: "message", type: "string", required: false, description: "Request message" },
        ],
        response: `{ "id": "uuid", ... }`,
      },
      { method: "PUT", path: "/referrals/:id", description: "Update referral status", auth: "jwt", body: [{ name: "status", type: "string", required: true, description: "'accepted', 'rejected', 'pending'" }], response: `{ "id": "uuid", ... }` },
    ],
  },
  {
    title: "Verification",
    icon: Shield,
    endpoints: [
      { method: "GET", path: "/verification", description: "Get own verification requests", auth: "jwt", response: `[{ "id": "uuid", "status": "pending", "verification_type": "string", ... }]` },
      {
        method: "POST", path: "/verification", description: "Submit a verification request",
        auth: "jwt",
        body: [
          { name: "verification_type", type: "string", required: true, description: "Type: 'document', 'linkedin', 'email'" },
          { name: "verification_data", type: "object", required: false, description: "Verification metadata" },
        ],
        response: `{ "id": "uuid", "status": "pending", ... }`,
      },
    ],
  },
  {
    title: "Leaderboard",
    icon: Award,
    endpoints: [
      {
        method: "GET", path: "/leaderboard", description: "Get top users by engagement score",
        auth: "both",
        params: [{ name: "limit", type: "number", required: false, description: "Max results (default: 20)" }],
        response: `[{ "user_id": "uuid", "full_name": "string", "engagement_score": 500, ... }]`,
      },
    ],
  },
  {
    title: "Mailing Campaigns (Admin)",
    icon: Mail,
    endpoints: [
      { method: "GET", path: "/mailing-campaigns", description: "List mailing campaigns (admin only)", auth: "jwt", response: `[{ "id": "uuid", "title": "string", "status": "draft", ... }]` },
      {
        method: "POST", path: "/mailing-campaigns", description: "Create a mailing campaign",
        auth: "jwt",
        body: [
          { name: "title", type: "string", required: true, description: "Campaign title" },
          { name: "message", type: "string", required: true, description: "Email message body" },
          { name: "segment_filters", type: "object", required: false, description: "Audience filters" },
        ],
        response: `{ "id": "uuid", "title": "string", ... }`,
      },
      { method: "PUT", path: "/mailing-campaigns/:id", description: "Update a mailing campaign", auth: "jwt", response: `{ "id": "uuid", ... }` },
    ],
  },
  {
    title: "Roles",
    icon: Shield,
    endpoints: [
      { method: "GET", path: "/roles/:userId", description: "Get roles for a user (admin or self)", auth: "jwt", response: `[{ "id": "uuid", "user_id": "uuid", "role": "alumni" }]` },
    ],
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
    </Button>
  );
}

function EndpointCard({ ep }: { ep: Endpoint }) {
  const [open, setOpen] = useState(false);
  const curlExample = ep.method === "GET"
    ? `curl -H "x-api-key: YOUR_KEY" "${BASE_URL}${ep.path}"`
    : `curl -X ${ep.method} -H "Authorization: Bearer JWT_TOKEN" -H "Content-Type: application/json" ${ep.body ? `-d '${JSON.stringify(Object.fromEntries((ep.body || []).filter(b => b.required).map(b => [b.name, `<${b.type}>`])))}' ` : ""}"${BASE_URL}${ep.path}"`;

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left">
        <Badge variant="outline" className={cn("text-[10px] font-mono px-2 py-0.5 border", methodColors[ep.method])}>
          {ep.method}
        </Badge>
        <code className="text-sm font-mono text-card-foreground flex-1">{ep.path}</code>
        <span className="text-xs text-muted-foreground hidden sm:block max-w-[200px] truncate">{ep.description}</span>
        <Badge variant="outline" className="text-[10px]">{ep.auth === "jwt" ? "JWT" : ep.auth === "api-key" ? "API Key" : "JWT / API Key"}</Badge>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4 space-y-4 bg-secondary/20">
          <p className="text-sm text-muted-foreground">{ep.description}</p>

          {ep.params && ep.params.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-foreground mb-2">Query Parameters</h4>
              <div className="space-y-1">
                {ep.params.map((p) => (
                  <div key={p.name} className="flex items-center gap-2 text-xs flex-wrap">
                    <code className="font-mono text-accent">{p.name}</code>
                    <span className="text-muted-foreground">{p.type}</span>
                    {p.required && <Badge variant="destructive" className="text-[9px] h-4">required</Badge>}
                    <span className="text-muted-foreground">— {p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ep.body && ep.body.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-foreground mb-2">Request Body (JSON)</h4>
              <div className="space-y-1">
                {ep.body.map((b) => (
                  <div key={b.name} className="flex items-center gap-2 text-xs flex-wrap">
                    <code className="font-mono text-accent">{b.name}</code>
                    <span className="text-muted-foreground">{b.type}</span>
                    {b.required && <Badge variant="destructive" className="text-[9px] h-4">required</Badge>}
                    <span className="text-muted-foreground">— {b.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-xs font-semibold text-foreground mb-2">Response</h4>
            <pre className="bg-background rounded-lg p-3 text-xs font-mono text-muted-foreground overflow-x-auto">{ep.response}</pre>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-xs font-semibold text-foreground">cURL Example</h4>
              <CopyButton text={curlExample} />
            </div>
            <pre className="bg-background rounded-lg p-3 text-[11px] font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap">{curlExample}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApiDocsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  
  const filteredSections = searchQuery
    ? sections.map(s => ({
        ...s,
        endpoints: s.endpoints.filter(ep =>
          ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ep.description.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter(s => s.endpoints.length > 0)
    : sections;

  const totalEndpoints = sections.reduce((sum, s) => sum + s.endpoints.length, 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Book className="h-5 w-5 text-accent" />
            </div>
            <h1 className="text-3xl font-heading font-bold text-foreground">API Documentation</h1>
            <Badge variant="outline" className="ml-2">{totalEndpoints} endpoints</Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">Complete REST API reference for mobile apps and third-party integrations</p>
        </motion.div>

        {/* Auth section */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-border rounded-xl p-6 mb-8 shadow-card">
          <h2 className="font-heading font-semibold text-card-foreground text-lg mb-4 flex items-center gap-2">
            <Key className="h-5 w-5 text-accent" /> Authentication
          </h2>
          <div className="space-y-4 text-sm text-muted-foreground">
            <div>
              <h3 className="font-semibold text-foreground text-sm mb-1">Option 1: Bearer JWT (User Authentication)</h3>
              <p>For user-specific operations. Get a JWT by signing in via the auth endpoint.</p>
              <div className="flex items-center gap-2 mt-2">
                <pre className="bg-background rounded-lg px-3 py-2 text-xs font-mono flex-1">Authorization: Bearer eyJhbGciOi...</pre>
                <CopyButton text='Authorization: Bearer YOUR_JWT_TOKEN' />
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm mb-1">Option 2: API Key (Server/Mobile)</h3>
              <p>For read-only operations or server-to-server calls. Pass via <code className="text-accent">x-api-key</code> header.</p>
              <div className="flex items-center gap-2 mt-2">
                <pre className="bg-background rounded-lg px-3 py-2 text-xs font-mono flex-1">x-api-key: your-api-key-here</pre>
                <CopyButton text='x-api-key: YOUR_API_KEY' />
              </div>
            </div>
            <div className="bg-warning/5 border border-warning/20 rounded-lg p-3">
              <p className="text-xs text-warning"><strong>Note:</strong> Write operations (POST, PUT, DELETE) always require a Bearer JWT. API keys only grant read access. Rate limit: 60 requests/minute per key.</p>
            </div>
          </div>
        </motion.div>

        {/* Base URL */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card border border-border rounded-xl p-5 mb-8 shadow-card">
          <h3 className="font-heading font-semibold text-card-foreground text-sm mb-2">Base URL</h3>
          <div className="flex items-center gap-2">
            <pre className="bg-background rounded-lg px-3 py-2 text-xs font-mono text-accent flex-1 overflow-x-auto">{BASE_URL}</pre>
            <CopyButton text={BASE_URL} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">All endpoints are relative to this base URL. Rate limit headers (<code>X-RateLimit-Limit</code>, <code>X-RateLimit-Remaining</code>, <code>X-RateLimit-Reset</code>) are included in every response.</p>
        </motion.div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search endpoints... (e.g. /campaigns, donations, forum)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>

        {/* Endpoint sections */}
        <div className="space-y-8">
          {filteredSections.map((section, si) => (
            <motion.div key={section.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + si * 0.03 }}>
              <h2 className="font-heading font-semibold text-foreground text-lg mb-3 flex items-center gap-2">
                <section.icon className="h-5 w-5 text-accent" /> {section.title}
                <Badge variant="secondary" className="text-[10px]">{section.endpoints.length}</Badge>
              </h2>
              <div className="space-y-2">
                {section.endpoints.map((ep) => (
                  <EndpointCard key={`${ep.method}-${ep.path}`} ep={ep} />
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Error codes */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="bg-card border border-border rounded-xl p-6 mt-8 shadow-card">
          <h2 className="font-heading font-semibold text-card-foreground text-lg mb-4">Error Codes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { code: 400, desc: "Bad Request — invalid parameters or body" },
              { code: 401, desc: "Unauthorized — missing or invalid auth" },
              { code: 403, desc: "Forbidden — write operation without JWT" },
              { code: 404, desc: "Not Found — resource or endpoint not found" },
              { code: 429, desc: "Rate Limit — exceeded 60 req/min, check Retry-After header" },
              { code: 500, desc: "Internal Server Error — unexpected failure" },
            ].map((e) => (
              <div key={e.code} className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                <Badge variant="outline" className={cn("font-mono text-xs", e.code >= 500 ? "text-destructive" : e.code >= 400 ? "text-warning" : "text-info")}>{e.code}</Badge>
                <span className="text-xs text-muted-foreground">{e.desc}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
