import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, Sparkles, Loader2, Star, MapPin, Briefcase, ArrowRight, RefreshCw, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import StudentBookingView from "@/components/mentoring/StudentBookingView";

interface MentorMatch {
  user_id: string;
  similarity: number;
  profile: {
    full_name: string;
    company: string | null;
    designation: string | null;
    industry: string | null;
    skills: string[] | null;
    location: string | null;
    is_mentor: boolean | null;
    is_hiring: boolean | null;
    avatar_url: string | null;
  };
}

interface ConnectionStatus {
  [userId: string]: "none" | "pending" | "accepted";
}

export default function MentorshipPage() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<MentorMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [embedding, setEmbedding] = useState(false);
  const [hasEmbedding, setHasEmbedding] = useState<boolean | null>(null);
  const [connectionStatuses, setConnectionStatuses] = useState<ConnectionStatus>({});
  const [requestDialog, setRequestDialog] = useState<MentorMatch | null>(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_embeddings").select("id").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        setHasEmbedding(!!data);
      });
    findMentors();
  }, [user]);

  const generateEmbedding = async () => {
    if (!user) return;
    setEmbedding(true);
    try {
      const { data, error } = await supabase.functions.invoke("embed-profile", { body: { action: "embed", user_id: user.id } });
      if (error) throw error;
      setHasEmbedding(true);
      toast.success("Profile embedding generated!");
      findMentors();
    } catch (e: any) {
      toast.error(e.message || "Failed to generate embedding");
    } finally {
      setEmbedding(false);
    }
  };

  const findMentors = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("embed-profile", { body: { action: "match", user_id: user.id, target_role: "mentor" } });
      if (error) throw error;
      if (data?.error) {
        if (data.error.includes("No embedding")) { setHasEmbedding(false); toast.error("Generate your profile embedding first"); }
        else toast.error(data.error);
        setLoading(false);
        return;
      }
      setMatches(data?.matches || []);

      if (data?.matches?.length) {
        const mentorIds = data.matches.map((m: MentorMatch) => m.user_id);
        const { data: conns } = await supabase.from("connections").select("target_user_id, status").eq("source_user_id", user.id).in("target_user_id", mentorIds);
        const statuses: ConnectionStatus = {};
        mentorIds.forEach((id: string) => { statuses[id] = "none"; });
        conns?.forEach((c) => { statuses[c.target_user_id] = c.status as "pending" | "accepted"; });
        setConnectionStatuses(statuses);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to find mentors");
    } finally {
      setLoading(false);
    }
  };

  const sendMentorshipRequest = async () => {
    if (!user || !requestDialog) return;
    setSending(true);
    try {
      const { error: connError } = await supabase.from("connections").insert({ source_user_id: user.id, target_user_id: requestDialog.user_id, relation_type: "mentorship", status: "pending" });
      if (connError) throw connError;
      await supabase.from("notifications").insert({ user_id: requestDialog.user_id, type: "mentorship", title: "New Mentorship Request", message: requestMessage || "A student would like you as their mentor.", link: "/dashboard/notifications" });
      await supabase.from("impact_events").insert({ source_user_id: user.id, target_user_id: requestDialog.user_id, action: "mentorship_request", metadata: { message: requestMessage } });
      setConnectionStatuses((prev) => ({ ...prev, [requestDialog.user_id]: "pending" }));
      toast.success(`Mentorship request sent to ${requestDialog.profile.full_name}!`);
      setRequestDialog(null);
      setRequestMessage("");
    } catch (e: any) {
      toast.error(e.message || "Failed to send request");
    } finally {
      setSending(false);
    }
  };

  // Re-find after embedding is generated
  useEffect(() => { if (hasEmbedding === true) findMentors(); }, [hasEmbedding]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <Users className="h-6 w-6 text-accent" /> Mentorship
        </h1>
        <p className="text-muted-foreground text-sm">Book mentoring sessions and find AI-matched mentors</p>
      </div>

      <Tabs defaultValue="book" className="w-full">
        <TabsList>
          <TabsTrigger value="book">Book Sessions</TabsTrigger>
          <TabsTrigger value="ai-match">AI Mentor Matching</TabsTrigger>
        </TabsList>

        <TabsContent value="book" className="mt-4">
          <StudentBookingView />
        </TabsContent>

        <TabsContent value="ai-match" className="mt-4">
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={generateEmbedding} disabled={embedding}>
                {embedding ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {hasEmbedding ? "Re-generate" : "Generate"} Embedding
              </Button>
              {hasEmbedding && (
                <Button variant="hero" size="sm" onClick={findMentors} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Find Mentors
                </Button>
              )}
            </div>

            {hasEmbedding === false && !embedding && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-xl p-8 text-center shadow-card">
                <Sparkles className="h-12 w-12 text-accent mx-auto mb-4" />
                <h3 className="font-heading font-semibold text-lg text-card-foreground mb-2">Generate Your Profile Embedding</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">AI will analyze your skills and interests to find the most compatible mentors.</p>
                <Button variant="hero" onClick={generateEmbedding} disabled={embedding}>
                  {embedding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate & Find Mentors
                </Button>
              </motion.div>
            )}

            {(loading || embedding) && (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-accent mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">{embedding ? "Generating AI embedding..." : "Finding best mentor matches..."}</p>
                </div>
              </div>
            )}

            {!loading && !embedding && matches.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{matches.length} mentor{matches.length !== 1 ? "s" : ""} found</p>
                {matches.map((match, i) => {
                  const initials = match.profile.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2);
                  const pct = Math.round(match.similarity * 100);
                  const status = connectionStatuses[match.user_id] || "none";
                  return (
                    <motion.div key={match.user_id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                      className="bg-card border border-border rounded-xl p-5 shadow-card hover:shadow-md transition-all">
                      <div className="flex items-start gap-4">
                        <div className="h-14 w-14 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                          <span className="text-lg font-heading font-bold text-accent">{initials}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-heading font-semibold text-card-foreground">{match.profile.full_name}</h3>
                            <Badge className="bg-accent/10 text-accent border-accent/20 text-xs">{pct}% match</Badge>
                            {match.profile.is_hiring && <Badge className="bg-success/10 text-success border-success/20 text-xs">Hiring</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">{match.profile.designation || "—"}{match.profile.company ? ` at ${match.profile.company}` : ""}</p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            {match.profile.industry && <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{match.profile.industry}</span>}
                            {match.profile.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{match.profile.location}</span>}
                          </div>
                          {match.profile.skills && match.profile.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {match.profile.skills.slice(0, 6).map((s) => <Badge key={s} variant="outline" className="text-[10px] border-border">{s}</Badge>)}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0">
                          {status === "accepted" ? (
                            <Badge className="bg-success/10 text-success border-success/20"><CheckCircle2 className="h-3 w-3 mr-1" /> Connected</Badge>
                          ) : status === "pending" ? (
                            <Badge className="bg-warning/10 text-warning border-warning/20">Pending</Badge>
                          ) : (
                            <Button variant="hero" size="sm" onClick={() => { setRequestDialog(match); setRequestMessage(""); }}>
                              <Send className="h-4 w-4" /> Request Mentor
                            </Button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {!loading && !embedding && hasEmbedding && matches.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">No mentors found.</div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Request Dialog */}
      <Dialog open={!!requestDialog} onOpenChange={(o) => !o && setRequestDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-heading">Request Mentorship</DialogTitle></DialogHeader>
          {requestDialog && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
                  <span className="font-heading font-bold text-accent text-sm">{requestDialog.profile.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</span>
                </div>
                <div>
                  <p className="font-heading font-semibold text-sm text-foreground">{requestDialog.profile.full_name}</p>
                  <p className="text-xs text-muted-foreground">{requestDialog.profile.designation}{requestDialog.profile.company ? ` at ${requestDialog.profile.company}` : ""}</p>
                </div>
              </div>
              <Textarea value={requestMessage} onChange={(e) => setRequestMessage(e.target.value)} placeholder="Introduce yourself and explain why you'd like this person as your mentor..." rows={4} />
              <Button variant="hero" className="w-full" onClick={sendMentorshipRequest} disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send Request
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
