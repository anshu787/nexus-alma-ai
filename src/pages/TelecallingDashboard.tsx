import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Phone, PhoneCall, PhoneOff, PhoneIncoming, PhoneOutgoing,
  Activity, Clock, Users, Shield, Loader2, Copy, RefreshCw,
  MessageSquare, UserCog, Calendar, Mic, BarChart3, CheckCircle2,
  AlertTriangle, Key, Send, Radio, Volume2, FileText
} from "lucide-react";
import ElevenLabsVoiceAgent from "@/components/telecalling/ElevenLabsVoiceAgent";
import TTSPanel from "@/components/telecalling/TTSPanel";
import STTPanel from "@/components/telecalling/STTPanel";
import OutboundScheduler from "@/components/telecalling/OutboundScheduler";
import CallAnalyticsCharts from "@/components/telecalling/CallAnalyticsCharts";
import AgentSetupGuide from "@/components/telecalling/AgentSetupGuide";
import OutboundCallPanel from "@/components/telecalling/OutboundCallPanel";
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
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  const isAdmin = userRoles.includes("super_admin") || userRoles.includes("institution_admin");

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id)
      .then(({ data }) => { if (data) setUserRoles(data.map(r => r.role)); });
  }, [user]);

  const fetchSessions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("call_sessions")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(50);

    if (data) {
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

  useEffect(() => {
    fetchSessions();

    const channel = supabase
      .channel('call-sessions-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'call_sessions' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setSessions(prev => [payload.new as CallSession, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setSessions(prev =>
              prev.map(s => s.id === (payload.new as CallSession).id ? { ...s, ...payload.new as CallSession } : s)
            );
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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
            <Radio className="h-6 w-6 text-accent" /> Voice Intelligence
          </h1>
          <p className="text-muted-foreground text-sm">Twilio phone calls with ElevenLabs AI voice + in-browser agent</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSessions}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Twilio Webhook Config - Admin Only */}
      {isAdmin && (
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
          <p className="text-[10px] text-muted-foreground mt-2">IVR prompts use ElevenLabs AI voice instead of Polly</p>
        </div>
      )}

      {/* Agent Setup Guide */}
      {isAdmin && <AgentSetupGuide />}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: PhoneCall, label: "Active Sessions", value: activeSessions.length, color: "bg-success/10 text-success" },
          { icon: Phone, label: "Total Sessions", value: sessions.length, color: "bg-primary/10 text-primary" },
          { icon: CheckCircle2, label: "Completed", value: completedSessions.length, color: "bg-info/10 text-info" },
          { icon: Clock, label: "Total Duration", value: formatDuration(totalDuration), color: "bg-accent/10 text-accent" },
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

      <Tabs defaultValue="agent" className="space-y-4">
        <TabsList>
          <TabsTrigger value="agent"><Radio className="h-3.5 w-3.5 mr-1" /> Voice Agent</TabsTrigger>
          <TabsTrigger value="tts"><Volume2 className="h-3.5 w-3.5 mr-1" /> TTS</TabsTrigger>
          <TabsTrigger value="stt"><FileText className="h-3.5 w-3.5 mr-1" /> STT</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          {isAdmin && <TabsTrigger value="outbound"><PhoneOutgoing className="h-3.5 w-3.5 mr-1" /> Outbound</TabsTrigger>}
          {isAdmin && <TabsTrigger value="analytics">Analytics</TabsTrigger>}
          {isAdmin && <TabsTrigger value="intents">Intents</TabsTrigger>}
        </TabsList>

        {/* Voice Agent */}
        <TabsContent value="agent">
          <ElevenLabsVoiceAgent />
        </TabsContent>

        {/* TTS */}
        <TabsContent value="tts">
          <TTSPanel />
        </TabsContent>

        {/* STT */}
        <TabsContent value="stt">
          <STTPanel />
        </TabsContent>

        {/* Outbound Scheduling */}
        <TabsContent value="outbound" className="space-y-4">
          <OutboundCallPanel />
          <OutboundScheduler />
        </TabsContent>

        {/* Sessions */}
        <TabsContent value="sessions" className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12">
              <Phone className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No voice sessions yet</p>
              <p className="text-xs text-muted-foreground mt-1">Start a voice agent conversation to see sessions here.</p>
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
                      </div>
                    </div>
                    {session.recording_url && (
                      <Badge variant="outline" className="text-[10px] bg-accent/10 text-accent">
                        <Mic className="h-3 w-3" /> Recorded
                      </Badge>
                    )}
                  </div>

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

        {/* Analytics Charts */}
        <TabsContent value="analytics">
          <CallAnalyticsCharts sessions={sessions} />
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
