import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, CheckCircle2, XCircle, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

interface Session {
  id: string;
  availability_id: string;
  mentor_id: string;
  student_id: string;
  status: string;
  student_message: string | null;
  mentor_feedback: string | null;
  created_at: string;
  student_name: string;
  student_designation: string | null;
  slot_date: string;
  start_time: string;
  end_time: string;
  title: string;
}

export default function MentorSessionsList() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedbackDialog, setFeedbackDialog] = useState<Session | null>(null);
  const [feedback, setFeedback] = useState("");

  const fetchSessions = async () => {
    if (!user) return;
    const { data: sessData } = await supabase
      .from("mentoring_sessions")
      .select("*")
      .eq("mentor_id", user.id)
      .order("created_at", { ascending: false });

    if (!sessData || sessData.length === 0) { setSessions([]); setLoading(false); return; }

    const studentIds = [...new Set(sessData.map(s => s.student_id))];
    const availIds = [...new Set(sessData.map(s => s.availability_id))];

    const [{ data: profiles }, { data: avails }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, designation").in("user_id", studentIds),
      supabase.from("mentor_availability").select("id, slot_date, start_time, end_time, title").in("id", availIds),
    ]);

    const mapped = sessData.map(s => {
      const p = profiles?.find(pr => pr.user_id === s.student_id);
      const a = avails?.find(av => av.id === s.availability_id);
      return {
        ...s,
        student_name: p?.full_name || "Unknown",
        student_designation: p?.designation || null,
        slot_date: a?.slot_date || "",
        start_time: a?.start_time || "",
        end_time: a?.end_time || "",
        title: a?.title || "Session",
      };
    });
    setSessions(mapped);
    setLoading(false);
  };

  useEffect(() => { fetchSessions(); }, [user]);

  const updateStatus = async (sessionId: string, studentId: string, status: "confirmed" | "cancelled") => {
    setActionLoading(sessionId);
    try {
      const { error } = await supabase.from("mentoring_sessions").update({ status }).eq("id", sessionId);
      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: studentId,
        type: "mentorship",
        title: status === "confirmed" ? "Session Confirmed! ✅" : "Session Cancelled",
        message: status === "confirmed" ? "Your mentoring session has been confirmed." : "Your mentoring session was cancelled by the mentor.",
        link: "/dashboard/mentorship",
      });

      toast.success(status === "confirmed" ? "Session confirmed!" : "Session cancelled");
      fetchSessions();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const submitFeedback = async () => {
    if (!feedbackDialog) return;
    await supabase.from("mentoring_sessions").update({ mentor_feedback: feedback, status: "completed" }).eq("id", feedbackDialog.id);
    toast.success("Feedback saved & session completed");
    setFeedbackDialog(null);
    setFeedback("");
    fetchSessions();
  };

  if (loading) return <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>;

  const booked = sessions.filter(s => s.status === "booked");
  const confirmed = sessions.filter(s => s.status === "confirmed");
  const others = sessions.filter(s => !["booked", "confirmed"].includes(s.status));

  return (
    <div className="space-y-4">
      <h2 className="font-heading font-semibold text-foreground flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-accent" /> Booked Sessions
      </h2>

      {sessions.length === 0 && <p className="text-sm text-muted-foreground py-4">No sessions booked yet.</p>}

      {booked.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending Confirmation ({booked.length})</p>
          {booked.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="bg-card border border-border rounded-lg p-4 shadow-card">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5 text-warning" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-semibold text-sm text-card-foreground">{s.student_name}</p>
                  <p className="text-xs text-muted-foreground">{s.student_designation || "Student"}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {s.slot_date && format(new Date(s.slot_date + "T00:00:00"), "MMM d, yyyy")} • {s.start_time?.slice(0,5)} - {s.end_time?.slice(0,5)}
                  </p>
                  {s.student_message && <p className="text-xs text-foreground mt-2 bg-secondary p-2 rounded">"{s.student_message}"</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="hero" size="sm" disabled={actionLoading === s.id} onClick={() => updateStatus(s.id, s.student_id, "confirmed")}>
                    {actionLoading === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Confirm
                  </Button>
                  <Button variant="outline" size="sm" disabled={actionLoading === s.id} onClick={() => updateStatus(s.id, s.student_id, "cancelled")}>
                    <XCircle className="h-4 w-4" /> Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {confirmed.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Confirmed ({confirmed.length})</p>
          {confirmed.map(s => (
            <div key={s.id} className="bg-card border border-border rounded-lg p-4 shadow-card flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
              <div className="flex-1">
                <p className="font-heading font-semibold text-sm text-card-foreground">{s.student_name}</p>
                <p className="text-xs text-muted-foreground">{s.slot_date && format(new Date(s.slot_date + "T00:00:00"), "MMM d")} • {s.start_time?.slice(0,5)}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setFeedbackDialog(s); setFeedback(s.mentor_feedback || ""); }}>
                Complete & Feedback
              </Button>
            </div>
          ))}
        </div>
      )}

      {others.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Past ({others.length})</p>
          {others.map(s => (
            <div key={s.id} className="bg-card border border-border rounded-lg p-3 shadow-card flex items-center gap-3 opacity-60">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">{s.student_name} — {s.title}</p>
              </div>
              <Badge className={s.status === "completed" ? "bg-success/10 text-success border-success/20 text-[10px]" :
                s.status === "cancelled" ? "bg-destructive/10 text-destructive border-destructive/20 text-[10px]" :
                "bg-muted text-muted-foreground border-border text-[10px]"}>{s.status}</Badge>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!feedbackDialog} onOpenChange={o => !o && setFeedbackDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-heading">Session Feedback</DialogTitle></DialogHeader>
          <Textarea placeholder="Share feedback for the student..." value={feedback} onChange={e => setFeedback(e.target.value)} rows={4} />
          <Button variant="hero" className="w-full" onClick={submitFeedback}>Mark Complete & Save Feedback</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
