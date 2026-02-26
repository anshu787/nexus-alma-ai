import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Briefcase, MapPin, Clock, DollarSign, Plus, Send, Building2, Loader2, Search, User, ExternalLink } from "lucide-react";
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
  apply_url: string | null;
}

interface Referral {
  id: string;
  company: string;
  position: string | null;
  status: string;
  created_at: string;
}

interface AlumniOption {
  user_id: string;
  full_name: string;
  company: string | null;
  designation: string | null;
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
  const [selectedJob, setSelectedJob] = useState<Opportunity | null>(null);
  const [newJob, setNewJob] = useState({ title: "", company: "", location: "", type: "job", employment_type: "full-time", salary_range: "", description: "", apply_url: "" });
  const [newReferral, setNewReferral] = useState({ company: "", position: "", alumni_id: "" });

  // Alumni search state
  const [alumniSearch, setAlumniSearch] = useState("");
  const [alumniResults, setAlumniResults] = useState<AlumniOption[]>([]);
  const [selectedAlumni, setSelectedAlumni] = useState<AlumniOption | null>(null);
  const [searchingAlumni, setSearchingAlumni] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

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

  // Alumni search with debounce
  useEffect(() => {
    if (alumniSearch.length < 2) { setAlumniResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchingAlumni(true);
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, company, designation")
        .ilike("full_name", `%${alumniSearch}%`)
        .neq("user_id", user?.id || "")
        .limit(8);
      setAlumniResults(data || []);
      setSearchingAlumni(false);
      setShowDropdown(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [alumniSearch, user]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const postJob = async () => {
    if (!user || !newJob.title || !newJob.company) { toast.error("Fill required fields"); return; }
    const payload: any = { ...newJob, posted_by: user.id };
    if (!payload.apply_url) delete payload.apply_url;
    const { error } = await supabase.from("opportunities").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Opportunity posted!");
    setPostOpen(false);
    const { data } = await supabase.from("opportunities").select("*").eq("is_active", true).order("created_at", { ascending: false });
    setJobs((data || []).map(o => ({ ...o, skills_required: o.skills_required || [] })));
  };

  const submitReferral = async () => {
    if (!user || !newReferral.company || !selectedAlumni) { toast.error("Fill required fields and select an alumni"); return; }
    const { error } = await supabase.from("referral_requests").insert({ requester_id: user.id, alumni_id: selectedAlumni.user_id, company: newReferral.company, position: newReferral.position });
    if (error) { toast.error(error.message); return; }
    toast.success("Referral request sent!");
    setReferralOpen(false);
    setSelectedAlumni(null);
    setAlumniSearch("");
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
                <div ref={searchRef} className="relative">
                  <Label>Search Alumni</Label>
                  {selectedAlumni ? (
                    <div className="flex items-center justify-between bg-muted rounded-lg px-3 py-2 mt-1">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{selectedAlumni.full_name}</p>
                          <p className="text-xs text-muted-foreground">{selectedAlumni.designation}{selectedAlumni.company ? ` at ${selectedAlumni.company}` : ""}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedAlumni(null); setAlumniSearch(""); }}>Change</Button>
                    </div>
                  ) : (
                    <>
                      <div className="relative mt-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={alumniSearch}
                          onChange={(e) => setAlumniSearch(e.target.value)}
                          placeholder="Type alumni name to search..."
                          className="pl-9"
                          onFocus={() => alumniResults.length > 0 && setShowDropdown(true)}
                        />
                        {searchingAlumni && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                      </div>
                      {showDropdown && alumniResults.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {alumniResults.map((a) => (
                            <button
                              key={a.user_id}
                              className="w-full text-left px-3 py-2 hover:bg-accent/10 transition-colors flex items-center gap-2"
                              onClick={() => {
                                setSelectedAlumni(a);
                                setNewReferral(p => ({ ...p, alumni_id: a.user_id }));
                                setShowDropdown(false);
                                setAlumniSearch("");
                              }}
                            >
                              <User className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div>
                                <p className="text-sm font-medium text-popover-foreground">{a.full_name}</p>
                                <p className="text-xs text-muted-foreground">{a.designation}{a.company ? ` at ${a.company}` : ""}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {showDropdown && alumniSearch.length >= 2 && alumniResults.length === 0 && !searchingAlumni && (
                        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg p-3 text-center text-sm text-muted-foreground">
                          No alumni found matching "{alumniSearch}"
                        </div>
                      )}
                    </>
                  )}
                </div>
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
                <div><Label>Apply URL</Label><Input value={newJob.apply_url} onChange={(e) => setNewJob(p => ({ ...p, apply_url: e.target.value }))} placeholder="https://careers.company.com/apply" /></div>
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
              className="bg-card border border-border rounded-xl p-5 shadow-card cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedJob(j)}>
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

      {/* Opportunity Detail Modal */}
      <Dialog open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <DialogContent className="max-w-lg">
          {selectedJob && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedJob.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="flex flex-wrap gap-2">
                  <Badge className={typeBadge[selectedJob.employment_type || "full-time"] || typeBadge["full-time"]} variant="outline">{selectedJob.employment_type || selectedJob.type}</Badge>
                  <span className="text-xs text-muted-foreground">{timeAgo(selectedJob.created_at)}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-foreground">{selectedJob.company}</span>
                  </div>
                  {selectedJob.location && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-foreground">{selectedJob.location}</span>
                    </div>
                  )}
                  {selectedJob.salary_range && (
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-foreground">{selectedJob.salary_range}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-foreground">{timeAgo(selectedJob.created_at)}</span>
                  </div>
                </div>

                {selectedJob.description && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Description</h4>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{selectedJob.description}</p>
                  </div>
                )}

                {selectedJob.skills_required.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Skills Required</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedJob.skills_required.map(s => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
                    </div>
                  </div>
                )}

                {selectedJob.apply_url && (
                  <a href={selectedJob.apply_url} target="_blank" rel="noopener noreferrer" className="block">
                    <Button variant="hero" className="w-full">
                      <ExternalLink className="h-4 w-4" /> Apply Now
                    </Button>
                  </a>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
