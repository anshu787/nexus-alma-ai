import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Phone, PhoneCall, PhoneOff, PhoneIncoming, PhoneOutgoing,
  Activity, Clock, Users, Shield, Loader2, Copy, RefreshCw,
  MessageSquare, UserCog, Calendar, Mic, BarChart3, CheckCircle2,
  AlertTriangle, Key
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface CallSession {
  id: string;
  user_id: string | null;
  twilio_call_sid: string | null;
  status: string;
  call_type: string;
  intent: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  summary: string | null;
  user_name?: string;
}

interface CallActionLog {
  id: string;
  call_session_id: string;
  action: string;
  endpoint: string | null;
  response_status: number | null;
  response_summary: string | null;
  created_at: string;
}

interface AccessCode {
  id: string;
  user_id: string;
  access_code: string;
  is_active: boolean;
  expires_at: string;
}

const statusColors: Record<string, string> = {
  initiated: "bg-info/10 text-info border-info/20",
  greeting: "bg-info/10 text-info border-info/20",
  authenticated: "bg-success/10 text-success border-success/20",
  completed: "bg-muted text-muted-foreground border-border",
  auth_failed: "bg-destructive/10 text-destructive border-destructive/20",
};

const callTypeIcons: Record<string, typeof Phone> = {
  inbound: PhoneIncoming,
  outbound: PhoneOutgoing,
  reminder: PhoneCall,
};

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function TelecallingDashboard() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<CallSession[]>([]);
  const [actionLogs, setActionLogs] = useState<CallActionLog[]>([]);
  const [accessCode, setAccessCode] = useState<AccessCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("call_sessions")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(50);

    if (data) {
      // Get user names
      const userIds = [...new Set(data.filter(d => d.user_id).map(d => d.user_id!))];
      const { data: profiles } = userIds.length > 0
        ? await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
        : { data: [] };
      const nameMap: Record<string, string> = {};
      profiles?.forEach(p => { nameMap[p.user_id] = p.full_name; });
      setSessions(data.map(s => ({ ...s, user_name: s.user_id ? nameMap[s.user_id] || "Unknown" : "Unauthenticated" })));
    }
    setLoading(false);
  };

  const fetchActionLogs = async (sessionId: string) => {
    const { data } = await supabase
      .from("call_action_logs")
      .select("*")
      .eq("call_session_id", sessionId)
      .order("created_at");
    if (data) setActionLogs(data);
  };

  const fetchAccessCode = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("voice_access_codes")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (data) setAccessCode(data);
  };

  const generateAccessCode = async () => {
    if (!user) return;
    setGenerating(true);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Deactivate old codes
    await supabase.from("voice_access_codes").update({ is_active: false }).eq("user_id", user.id);

    const { data, error } = await supabase.from("voice_access_codes").insert({
      user_id: user.id,
      access_code: code,
      expires_at: expiresAt,
    }).select().single();

    if (error) {
      toast.error("Failed to generate access code");
    } else {
      setAccessCode(data);
      toast.success("Access code generated!");
    }
    setGenerating(false);
  };

  useEffect(() => {
    fetchSessions();
    fetchAccessCode();
  }, [user]);

  useEffect(() => {
    if (selectedSession) fetchActionLogs(selectedSession);
  }, [selectedSession]);

  const activeSessions = sessions.filter(s => !["completed", "auth_failed"].includes(s.status));
  const completedSessions = sessions.filter(s => s.status === "completed");
  const totalDuration = completedSessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);

  const intentCounts = sessions.reduce((acc, s) => {
    if (s.intent) acc[s.intent] = (acc[s.intent] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-webhook/incoming`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Phone className="h-6 w-6 text-accent" /> Telecalling Intelligence
          </h1>
          <p className="text-muted-foreground text-sm">Voice-based AI operator for alumni platform</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchSessions}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="hero" size="sm"><Key className="h-4 w-4" /> My Access Code</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Voice Access Code</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <p className="text-sm text-muted-foreground">
                  Use this 6-digit code when calling the platform to authenticate your voice session.
                </p>
                {accessCode ? (
                  <div className="bg-secondary rounded-xl p-6 text-center space-y-3">
                    <p className="text-4xl font-mono font-bold text-foreground tracking-[0.5em]">
                      {accessCode.access_code}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Expires {new Date(accessCode.expires_at).toLocaleDateString()}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { navigator.clipboard.writeText(accessCode.access_code); toast.success("Copied!"); }}
                    >
                      <Copy className="h-4 w-4" /> Copy Code
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground mb-3">No active access code</p>
                  </div>
                )}
                <Button variant="hero" className="w-full" onClick={generateAccessCode} disabled={generating}>
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                  {generating ? "Generating..." : "Generate New Code"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { icon: PhoneCall, label: "Active Calls", value: activeSessions.length, color: "bg-success/10 text-success" },
          { icon: Phone, label: "Total Calls", value: sessions.length, color: "bg-primary/10 text-primary" },
          { icon: CheckCircle2, label: "Completed", value: completedSessions.length, color: "bg-info/10 text-info" },
          { icon: Clock, label: "Total Duration", value: formatDuration(totalDuration), color: "bg-accent/10 text-accent" },
          { icon: Activity, label: "Intents Processed", value: Object.values(intentCounts).reduce((a, b) => a + b, 0), color: "bg-warning/10 text-warning" },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl p-5 shadow-card"
          >
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${stat.color} mb-3`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <p className="text-2xl font-heading font-bold text-card-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Twilio Setup Info */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-card">
        <h3 className="font-heading font-semibold text-sm text-card-foreground flex items-center gap-2 mb-2">
          <Shield className="h-4 w-4 text-accent" /> Twilio Webhook Configuration
        </h3>
        <p className="text-xs text-muted-foreground mb-2">
          Configure your Twilio phone number's voice webhook URL to:
        </p>
        <div className="flex items-center gap-2">
          <code className="bg-secondary px-3 py-2 rounded-lg text-xs text-foreground flex-1 truncate">
            {webhookUrl}
          </code>
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("URL copied!"); }}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sessions">Call Sessions</TabsTrigger>
          <TabsTrigger value="intents">Intent Analytics</TabsTrigger>
        </TabsList>

        {/* Sessions */}
        <TabsContent value="sessions" className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12">
              <Phone className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No call sessions yet</p>
              <p className="text-xs text-muted-foreground mt-1">Calls will appear here when users dial your Twilio number.</p>
            </div>
          ) : (
            sessions.map((session, i) => {
              const Icon = callTypeIcons[session.call_type] || Phone;
              return (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="bg-card border border-border rounded-xl p-4 shadow-card cursor-pointer hover:border-accent/30 transition-colors"
                  onClick={() => setSelectedSession(selectedSession === session.id ? null : session.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                      session.status === "completed" ? "bg-muted" : "bg-success/10"
                    }`}>
                      <Icon className={`h-5 w-5 ${session.status === "completed" ? "text-muted-foreground" : "text-success"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-card-foreground">{session.user_name}</span>
                        <Badge variant="outline" className={`text-[10px] ${statusColors[session.status] || ""}`}>
                          {session.status}
                        </Badge>
                        {session.intent && (
                          <Badge variant="outline" className="text-[10px]">
                            {session.intent.replace(/_/g, " ")}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-muted-foreground">{timeAgo(session.started_at)}</span>
                        {session.duration_seconds && (
                          <span className="text-[10px] text-muted-foreground">Duration: {formatDuration(session.duration_seconds)}</span>
                        )}
                        {session.twilio_call_sid && (
                          <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">{session.twilio_call_sid}</span>
                        )}
                      </div>
                    </div>
                    {session.recording_url && (
                      <Badge variant="outline" className="text-[10px] bg-accent/10 text-accent">
                        <Mic className="h-3 w-3" /> Recorded
                      </Badge>
                    )}
                  </div>

                  {/* Expanded: Action Logs */}
                  {selectedSession === session.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-4 pt-4 border-t border-border space-y-2"
                    >
                      <h4 className="text-xs font-medium text-muted-foreground">API Actions Executed</h4>
                      {actionLogs.length === 0 ? (
                        <p className="text-xs text-muted-foreground/50">No API actions logged for this session.</p>
                      ) : (
                        actionLogs.map((log) => (
                          <div key={log.id} className="flex items-center gap-3 bg-secondary rounded-lg p-2">
                            <Activity className="h-3.5 w-3.5 text-accent shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-medium text-foreground">{log.action.replace(/_/g, " ")}</span>
                              {log.endpoint && <span className="text-[10px] text-muted-foreground ml-2 font-mono">{log.endpoint}</span>}
                            </div>
                            <Badge variant="outline" className={`text-[10px] ${
                              log.response_status && log.response_status < 300
                                ? "text-success"
                                : "text-destructive"
                            }`}>
                              {log.response_status || "—"}
                            </Badge>
                          </div>
                        ))
                      )}
                      {session.summary && (
                        <div className="bg-secondary rounded-lg p-3 mt-2">
                          <p className="text-xs text-muted-foreground font-medium mb-1">Session Summary</p>
                          <p className="text-xs text-foreground">{session.summary}</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              );
            })
          )}
        </TabsContent>

        {/* Intent Analytics */}
        <TabsContent value="intents" className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(intentCounts).length === 0 ? (
              <div className="col-span-full text-center py-12">
                <BarChart3 className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No intents processed yet</p>
              </div>
            ) : (
              Object.entries(intentCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([intent, count]) => {
                  const intentIcons: Record<string, typeof Phone> = {
                    update_skills: UserCog,
                    find_mentor: Users,
                    check_opportunities: BarChart3,
                    send_message: MessageSquare,
                    session_reminder: Calendar,
                  };
                  const IntentIcon = intentIcons[intent] || Activity;
                  return (
                    <motion.div
                      key={intent}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-card border border-border rounded-xl p-4 shadow-card"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                          <IntentIcon className="h-5 w-5 text-accent" />
                        </div>
                        <div>
                          <p className="text-lg font-heading font-bold text-card-foreground">{count}</p>
                          <p className="text-xs text-muted-foreground capitalize">{intent.replace(/_/g, " ")}</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
