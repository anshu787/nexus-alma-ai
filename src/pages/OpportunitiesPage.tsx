import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Briefcase, MapPin, Clock, DollarSign, Plus, Send, Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Opportunity {
  id: string;
  title: string;
  company: string;
  location: string | null;
  type: string;
  employment_type: string | null;
  skills_required: string[];
  salary_range: string | null;
  created_at: string;
  description: string | null;
}

interface Referral {
  id: string;
  company: string;
  position: string | null;
  status: string;
  created_at: string;
}

const typeBadge: Record<string, string> = {
  "full-time": "bg-info/10 text-info border-info/20",
  internship: "bg-accent/10 text-accent border-accent/20",
  remote: "bg-success/10 text-success border-success/20",
  "part-time": "bg-warning/10 text-warning border-warning/20",
};

export default function OpportunitiesPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Opportunity[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [postOpen, setPostOpen] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);
  const [newJob, setNewJob] = useState({ title: "", company: "", location: "", type: "job", employment_type: "full-time", salary_range: "", description: "" });
  const [newReferral, setNewReferral] = useState({ company: "", position: "", alumni_id: "" });

  useEffect(() => {
    const fetchData = async () => {
      const { data: opps } = await supabase.from("opportunities").select("*").eq("is_active", true).order("created_at", { ascending: false });
      setJobs((opps || []).map(o => ({ ...o, skills_required: o.skills_required || [] })));

      if (user) {
        const { data: refs } = await supabase.from("referral_requests").select("*").or(`requester_id.eq.${user.id},alumni_id.eq.${user.id}`).order("created_at", { ascending: false });
        setReferrals(refs || []);
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const postJob = async () => {
    if (!user || !newJob.title || !newJob.company) { toast.error("Fill required fields"); return; }
    const { error } = await supabase.from("opportunities").insert({ ...newJob, posted_by: user.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Opportunity posted!");
    setPostOpen(false);
    // Refresh
    const { data } = await supabase.from("opportunities").select("*").eq("is_active", true).order("created_at", { ascending: false });
    setJobs((data || []).map(o => ({ ...o, skills_required: o.skills_required || [] })));
  };

  const submitReferral = async () => {
    if (!user || !newReferral.company || !newReferral.alumni_id) { toast.error("Fill required fields"); return; }
    const { error } = await supabase.from("referral_requests").insert({ requester_id: user.id, alumni_id: newReferral.alumni_id, company: newReferral.company, position: newReferral.position });
    if (error) { toast.error(error.message); return; }
    toast.success("Referral request sent!");
    setReferralOpen(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;

  const timeAgo = (d: string) => {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Opportunities</h1>
          <p className="text-muted-foreground text-sm">{jobs.length} active opportunities</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={referralOpen} onOpenChange={setReferralOpen}>
            <DialogTrigger asChild><Button variant="outline" size="sm"><Send className="h-4 w-4" /> Request Referral</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Request a Referral</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <div><Label>Company</Label><Input value={newReferral.company} onChange={(e) => setNewReferral(p => ({ ...p, company: e.target.value }))} /></div>
                <div><Label>Position</Label><Input value={newReferral.position} onChange={(e) => setNewReferral(p => ({ ...p, position: e.target.value }))} /></div>
                <div><Label>Alumni User ID</Label><Input value={newReferral.alumni_id} onChange={(e) => setNewReferral(p => ({ ...p, alumni_id: e.target.value }))} placeholder="Paste alumni user ID" /></div>
                <Button variant="hero" className="w-full" onClick={submitReferral}>Submit Request</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={postOpen} onOpenChange={setPostOpen}>
            <DialogTrigger asChild><Button variant="hero" size="sm"><Plus className="h-4 w-4" /> Post Opportunity</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Post an Opportunity</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <div><Label>Title</Label><Input value={newJob.title} onChange={(e) => setNewJob(p => ({ ...p, title: e.target.value }))} /></div>
                <div><Label>Company</Label><Input value={newJob.company} onChange={(e) => setNewJob(p => ({ ...p, company: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Location</Label><Input value={newJob.location} onChange={(e) => setNewJob(p => ({ ...p, location: e.target.value }))} /></div>
                  <div><Label>Salary Range</Label><Input value={newJob.salary_range} onChange={(e) => setNewJob(p => ({ ...p, salary_range: e.target.value }))} /></div>
                </div>
                <div><Label>Description</Label><Textarea value={newJob.description} onChange={(e) => setNewJob(p => ({ ...p, description: e.target.value }))} /></div>
                <Button variant="hero" className="w-full" onClick={postJob}>Post</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="jobs">
        <TabsList><TabsTrigger value="jobs">Jobs & Internships</TabsTrigger><TabsTrigger value="referrals">My Referrals</TabsTrigger></TabsList>

        <TabsContent value="jobs" className="mt-4 space-y-3">
          {jobs.map((j, i) => (
            <motion.div key={j.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="bg-card border border-border rounded-xl p-5 shadow-card">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-heading font-semibold text-card-foreground">{j.title}</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                    <Building2 className="h-3.5 w-3.5" />{j.company}
                    {j.location && <><MapPin className="h-3.5 w-3.5 ml-2" />{j.location}</>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={typeBadge[j.employment_type || "full-time"] || typeBadge["full-time"]} variant="outline">{j.employment_type || j.type}</Badge>
                  <span className="text-xs text-muted-foreground">{timeAgo(j.created_at)}</span>
                </div>
              </div>
              {j.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{j.description}</p>}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {j.salary_range && <Badge variant="secondary" className="text-[10px]"><DollarSign className="h-2.5 w-2.5" />{j.salary_range}</Badge>}
                {j.skills_required.slice(0, 4).map(s => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
              </div>
            </motion.div>
          ))}
          {jobs.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">No opportunities posted yet.</div>}
        </TabsContent>

        <TabsContent value="referrals" className="mt-4 space-y-3">
          {referrals.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-4 shadow-card flex items-center justify-between">
              <div>
                <p className="font-heading font-semibold text-card-foreground text-sm">{r.company}</p>
                <p className="text-xs text-muted-foreground">{r.position || "General"}</p>
              </div>
              <Badge variant="outline" className={r.status === "approved" ? "text-success" : r.status === "rejected" ? "text-destructive" : "text-warning"}>{r.status}</Badge>
            </div>
          ))}
          {referrals.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">No referral requests yet.</div>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
