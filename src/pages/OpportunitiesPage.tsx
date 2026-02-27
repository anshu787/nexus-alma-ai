import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Briefcase, MapPin, Clock, DollarSign, Plus, Send, Building2, Loader2, Search, User, ExternalLink, CheckCircle2, XCircle, MessageSquare } from "lucide-react";
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
  message: string | null;
  status: string;
  created_at: string;
  alumni_name?: string;
}

interface IncomingReferral {
  id: string;
  company: string;
  position: string | null;
  message: string | null;
  status: string;
  created_at: string;
  requester_id: string;
  requester_name?: string;
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
  const [incomingReferrals, setIncomingReferrals] = useState<IncomingReferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [postOpen, setPostOpen] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Opportunity | null>(null);
  const [newJob, setNewJob] = useState({ title: "", company: "", location: "", type: "job", employment_type: "full-time", salary_range: "", description: "", apply_url: "" });
  const [newReferral, setNewReferral] = useState({ company: "", position: "", alumni_id: "" });
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseComment, setResponseComment] = useState("");

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
        // Sent referrals (by this user) — include alumni name
        const { data: refs } = await supabase.from("referral_requests").select("*").eq("requester_id", user.id).order("created_at", { ascending: false });
        if (refs && refs.length > 0) {
          const alumniIds = [...new Set(refs.map(r => r.alumni_id))];
          const { data: alumniProfiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", alumniIds);
          const alumniNameMap = new Map((alumniProfiles || []).map(p => [p.user_id, p.full_name]));
          setReferrals(refs.map(r => ({ ...r, alumni_name: alumniNameMap.get(r.alumni_id) || "Alumni" })));
        } else {
          setReferrals([]);
        }

        // Incoming referrals (where this user is the alumni)
        const { data: incoming } = await supabase.from("referral_requests").select("*").eq("alumni_id", user.id).order("created_at", { ascending: false });
        if (incoming && incoming.length > 0) {
          const requesterIds = [...new Set(incoming.map(r => r.requester_id))];
          const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", requesterIds);
          const nameMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));
          setIncomingReferrals(incoming.map(r => ({ ...r, requester_name: nameMap.get(r.requester_id) || "Unknown" })));
        }
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

    // Send in-app notification to the alumni
    const { data: requesterProfile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).single();
    const requesterName = requesterProfile?.full_name || "Someone";
    await supabase.from("notifications").insert({
      user_id: selectedAlumni.user_id,
      title: "New Referral Request",
      message: `${requesterName} is requesting a referral at ${newReferral.company}${newReferral.position ? ` for ${newReferral.position}` : ""}.`,
      type: "referral",
      link: "/opportunities",
    });

    toast.success("Referral request sent!");
    setReferralOpen(false);
    setSelectedAlumni(null);
    setAlumniSearch("");
  };

  const handleReferralResponse = async (referralId: string, newStatus: "approved" | "rejected") => {
    const updateData: any = { status: newStatus };
    if (responseComment.trim()) updateData.message = responseComment.trim();
    const { error } = await supabase.from("referral_requests").update(updateData).eq("id", referralId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Referral ${newStatus}!`);
    setRespondingTo(null);
    setResponseComment("");
    setIncomingReferrals(prev => prev.map(r => r.id === referralId ? { ...r, status: newStatus, message: responseComment.trim() || r.message } : r));
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
        <TabsList>
          <TabsTrigger value="jobs">Jobs & Internships</TabsTrigger>
          <TabsTrigger value="referrals">My Referrals</TabsTrigger>
          {incomingReferrals.length > 0 && (
            <TabsTrigger value="incoming" className="relative">
              Incoming Requests
              {incomingReferrals.filter(r => r.status === "pending").length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                  {incomingReferrals.filter(r => r.status === "pending").length}
                </span>
              )}
            </TabsTrigger>
          )}
        </TabsList>

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
            <div key={r.id} className="bg-card border border-border rounded-xl p-4 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-heading font-semibold text-card-foreground text-sm">{r.company}</p>
                  <p className="text-xs text-muted-foreground">{r.position || "General"}</p>
                  {r.alumni_name && <p className="text-xs text-muted-foreground mt-0.5">To: {r.alumni_name}</p>}
                </div>
                <Badge variant="outline" className={r.status === "approved" ? "text-success border-success/20" : r.status === "rejected" ? "text-destructive border-destructive/20" : "text-warning border-warning/20"}>{r.status}</Badge>
              </div>
              {r.message && r.status !== "pending" && (
                <div className="mt-3 bg-muted rounded-lg p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    <MessageSquare className="h-3 w-3 inline mr-1" />
                    Alumni Response
                  </p>
                  <p className="text-sm text-foreground">{r.message}</p>
                </div>
              )}
            </div>
          ))}
          {referrals.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">No referral requests yet.</div>}
        </TabsContent>

        <TabsContent value="incoming" className="mt-4 space-y-3">
          {incomingReferrals.map((r) => (
            <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-xl p-5 shadow-card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-heading font-semibold text-card-foreground">{r.company}</p>
                  <p className="text-sm text-muted-foreground">{r.position || "General Referral"}</p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <User className="h-3 w-3" /> Requested by <span className="font-medium text-foreground">{r.requester_name}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{timeAgo(r.created_at)}</p>
                </div>
                <Badge variant="outline" className={r.status === "approved" ? "text-success border-success/20" : r.status === "rejected" ? "text-destructive border-destructive/20" : "text-warning border-warning/20"}>
                  {r.status}
                </Badge>
              </div>

              {r.message && r.status !== "pending" && (
                <div className="mt-3 bg-muted rounded-lg p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Your Response</p>
                  <p className="text-sm text-foreground">{r.message}</p>
                </div>
              )}

              {r.status === "pending" && (
                <div className="mt-4 space-y-3">
                  {respondingTo === r.id ? (
                    <>
                      <div>
                        <Label className="text-xs">Add a comment (optional)</Label>
                        <Textarea
                          value={responseComment}
                          onChange={(e) => setResponseComment(e.target.value)}
                          placeholder="e.g. I've forwarded your resume to HR..."
                          className="mt-1 min-h-[60px]"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="default" className="flex-1" onClick={() => handleReferralResponse(r.id, "approved")}>
                          <CheckCircle2 className="h-4 w-4" /> Accept
                        </Button>
                        <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleReferralResponse(r.id, "rejected")}>
                          <XCircle className="h-4 w-4" /> Decline
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setRespondingTo(null); setResponseComment(""); }}>
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setRespondingTo(r.id)}>
                      <MessageSquare className="h-4 w-4" /> Respond
                    </Button>
                  )}
                </div>
              )}
            </motion.div>
          ))}
          {incomingReferrals.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">No incoming referral requests.</div>}
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
