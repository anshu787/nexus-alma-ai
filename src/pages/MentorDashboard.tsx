import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, Check, X, Loader2, Clock, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import MentorScheduleManager from "@/components/mentoring/MentorScheduleManager";
import MentorSessionsList from "@/components/mentoring/MentorSessionsList";

interface MentorRequest {
  id: string;
  source_user_id: string;
  status: string;
  relation_type: string;
  created_at: string;
  requester_name: string;
  requester_designation: string | null;
  requester_company: string | null;
  requester_skills: string[] | null;
}

export default function MentorDashboard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<MentorRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchRequests = async () => {
    if (!user) return;
    const { data: conns } = await supabase
      .from("connections")
      .select("id, source_user_id, status, relation_type, created_at")
      .eq("target_user_id", user.id)
      .eq("relation_type", "mentorship")
      .order("created_at", { ascending: false });

    if (!conns || conns.length === 0) { setRequests([]); setLoading(false); return; }

    const userIds = conns.map((c) => c.source_user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, designation, company, skills")
      .in("user_id", userIds);

    const mapped = conns.map((c) => {
      const p = profiles?.find((pr) => pr.user_id === c.source_user_id);
      return {
        ...c,
        requester_name: p?.full_name || "Unknown",
        requester_designation: p?.designation || null,
        requester_company: p?.company || null,
        requester_skills: p?.skills || null,
      };
    });
    setRequests(mapped);
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, [user]);

  const handleAction = async (connId: string, sourceUserId: string, action: "accepted" | "rejected") => {
    if (!user) return;
    setActionLoading(connId);
    try {
      const { error } = await supabase.from("connections").update({ status: action }).eq("id", connId);
      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: sourceUserId,
        type: "mentorship",
        title: action === "accepted" ? "Mentorship Request Accepted! 🎉" : "Mentorship Request Declined",
        message: action === "accepted"
          ? "Your mentor has accepted your request. You can now connect!"
          : "Unfortunately, the mentor is unable to take on new mentees at this time.",
        link: "/dashboard/mentorship",
      });

      if (action === "accepted") {
        await supabase.from("impact_events").insert({
          source_user_id: user.id,
          target_user_id: sourceUserId,
          action: "mentorship_accepted",
          outcome: "active_mentorship",
        });
      }

      toast.success(action === "accepted" ? "Mentorship accepted!" : "Request declined");
      fetchRequests();
    } catch (e: any) {
      toast.error(e.message || "Failed to update request");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;

  const pending = requests.filter((r) => r.status === "pending");
  const resolved = requests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <Users className="h-6 w-6 text-accent" /> Mentor Dashboard
        </h1>
        <p className="text-muted-foreground text-sm">Manage your schedule, sessions, and mentorship requests</p>
      </div>

      <Tabs defaultValue="schedule" className="w-full">
        <TabsList>
          <TabsTrigger value="schedule">My Schedule</TabsTrigger>
          <TabsTrigger value="sessions">Booked Sessions</TabsTrigger>
          <TabsTrigger value="requests">Mentorship Requests ({pending.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="mt-4">
          <MentorScheduleManager />
        </TabsContent>

        <TabsContent value="sessions" className="mt-4">
          <MentorSessionsList />
        </TabsContent>

        <TabsContent value="requests" className="mt-4">
          {/* Pending */}
          <div>
            <h2 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" /> Pending Requests ({pending.length})
            </h2>
            {pending.length === 0 && <p className="text-sm text-muted-foreground py-4">No pending requests</p>}
            <div className="space-y-3">
              {pending.map((req, i) => {
                const initials = req.requester_name.split(" ").map((n) => n[0]).join("").slice(0, 2);
                return (
                  <motion.div key={req.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="bg-card border border-border rounded-xl p-5 shadow-card">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                        <span className="font-heading font-bold text-accent">{initials}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-heading font-semibold text-card-foreground">{req.requester_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {req.requester_designation || "Student"}{req.requester_company ? ` at ${req.requester_company}` : ""}
                        </p>
                        {req.requester_skills && req.requester_skills.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {req.requester_skills.slice(0, 5).map((s) => (
                              <Badge key={s} variant="outline" className="text-[10px] border-border">{s}</Badge>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Requested {new Date(req.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button variant="hero" size="sm" disabled={actionLoading === req.id}
                          onClick={() => handleAction(req.id, req.source_user_id, "accepted")}>
                          {actionLoading === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          Accept
                        </Button>
                        <Button variant="outline" size="sm" disabled={actionLoading === req.id}
                          onClick={() => handleAction(req.id, req.source_user_id, "rejected")}>
                          <X className="h-4 w-4" /> Decline
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Resolved */}
          {resolved.length > 0 && (
            <div className="mt-6">
              <h2 className="font-heading font-semibold text-foreground mb-3">Past Requests ({resolved.length})</h2>
              <div className="space-y-2">
                {resolved.map((req) => {
                  const initials = req.requester_name.split(" ").map((n) => n[0]).join("").slice(0, 2);
                  return (
                    <div key={req.id} className="bg-card border border-border rounded-xl p-4 shadow-card flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                        <span className="font-heading font-bold text-foreground text-sm">{initials}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-heading font-semibold text-sm text-card-foreground">{req.requester_name}</p>
                        <p className="text-xs text-muted-foreground">{req.requester_designation || "Student"}</p>
                      </div>
                      <Badge className={req.status === "accepted" ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}>
                        {req.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
