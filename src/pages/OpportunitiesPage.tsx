import { useState } from "react";
import { motion } from "framer-motion";
import { Briefcase, MapPin, Clock, DollarSign, Plus, Send, Building2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const mockJobs = [
  { id: "1", title: "Senior ML Engineer", company: "Google", location: "Bangalore", type: "job", employment_type: "full-time", skills: ["Python", "TensorFlow", "MLOps"], salary: "₹40-60 LPA", posted: "2d ago", postedBy: "Priya Sharma" },
  { id: "2", title: "Product Manager", company: "Microsoft", location: "Hyderabad", type: "job", employment_type: "full-time", skills: ["Product Strategy", "Agile", "Data Analysis"], salary: "₹35-50 LPA", posted: "5d ago", postedBy: "Arjun Mehta" },
  { id: "3", title: "Frontend Intern", company: "Razorpay", location: "Mumbai", type: "internship", employment_type: "internship", skills: ["React", "TypeScript", "CSS"], salary: "₹50K/month", posted: "1d ago", postedBy: "Maya Patel" },
  { id: "4", title: "Data Science Intern", company: "Flipkart", location: "Bangalore", type: "internship", employment_type: "internship", skills: ["Python", "SQL", "Statistics"], salary: "₹40K/month", posted: "3d ago", postedBy: "Vikram Singh" },
  { id: "5", title: "Backend Developer", company: "Stripe", location: "Remote", type: "job", employment_type: "remote", skills: ["Node.js", "PostgreSQL", "APIs"], salary: "$120-160K", posted: "1w ago", postedBy: "Amit Joshi" },
];

const mockReferrals = [
  { id: "1", company: "Google", position: "SDE-2", requester: "Ravi Kumar", status: "pending", date: "2d ago" },
  { id: "2", company: "Microsoft", position: "PM Intern", requester: "Sneha Rao", status: "approved", date: "5d ago" },
  { id: "3", company: "Amazon", position: "SDE-1", requester: "Amit Shah", status: "pending", date: "1d ago" },
];

const typeBadge: Record<string, string> = {
  "full-time": "bg-info/10 text-info border-info/20",
  internship: "bg-accent/10 text-accent border-accent/20",
  remote: "bg-success/10 text-success border-success/20",
};

export default function OpportunitiesPage() {
  const [activeTab, setActiveTab] = useState("jobs");
  const [postOpen, setPostOpen] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Opportunities</h1>
          <p className="text-muted-foreground text-sm">Jobs, internships, and referral requests</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={referralOpen} onOpenChange={setReferralOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Send className="h-4 w-4" /> Request Referral</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-heading">Request a Referral</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); toast.success("Referral request sent!"); setReferralOpen(false); }} className="space-y-4">
                <div className="space-y-2"><Label>Company</Label><Input placeholder="e.g. Google" required /></div>
                <div className="space-y-2"><Label>Position</Label><Input placeholder="e.g. Software Engineer" required /></div>
                <div className="space-y-2"><Label>Message</Label><Textarea placeholder="Why should this alumnus refer you?" /></div>
                <Button variant="hero" className="w-full" type="submit">Send Request</Button>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={postOpen} onOpenChange={setPostOpen}>
            <DialogTrigger asChild>
              <Button variant="hero" size="sm"><Plus className="h-4 w-4" /> Post Opportunity</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle className="font-heading">Post an Opportunity</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); toast.success("Opportunity posted!"); setPostOpen(false); }} className="space-y-4">
                <div className="space-y-2"><Label>Title</Label><Input placeholder="Job title" required /></div>
                <div className="space-y-2"><Label>Company</Label><Input placeholder="Company name" required /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Location</Label><Input placeholder="City or Remote" /></div>
                  <div className="space-y-2"><Label>Salary Range</Label><Input placeholder="e.g. ₹20-30 LPA" /></div>
                </div>
                <div className="space-y-2"><Label>Description</Label><Textarea placeholder="Role details and requirements" /></div>
                <Button variant="hero" className="w-full" type="submit">Post Opportunity</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary">
          <TabsTrigger value="jobs" className="font-heading">Jobs & Internships</TabsTrigger>
          <TabsTrigger value="referrals" className="font-heading">Referral Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="mt-4">
          <div className="space-y-3">
            {mockJobs.map((job, i) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="bg-card border border-border rounded-xl p-5 shadow-card hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-6 w-6 text-accent" />
                    </div>
                    <div>
                      <h3 className="font-heading font-semibold text-card-foreground">{job.title}</h3>
                      <p className="text-sm text-muted-foreground">{job.company} • Posted by {job.postedBy}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {job.location}</span>
                        <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> {job.salary}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {job.posted}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {job.skills.map((s) => (
                          <Badge key={s} variant="secondary" className="text-[10px] px-2 py-0.5">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge className={typeBadge[job.employment_type] || typeBadge["full-time"]}>
                      {job.employment_type}
                    </Badge>
                    <Button variant="hero" size="sm">Apply</Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="referrals" className="mt-4">
          <div className="space-y-3">
            {mockReferrals.map((ref, i) => (
              <motion.div
                key={ref.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="bg-card border border-border rounded-xl p-5 shadow-card flex items-center justify-between"
              >
                <div>
                  <h3 className="font-heading font-semibold text-card-foreground">{ref.position} at {ref.company}</h3>
                  <p className="text-sm text-muted-foreground">Requested by {ref.requester} • {ref.date}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={ref.status === "approved" ? "bg-success/10 text-success border-success/20" : "bg-accent/10 text-accent border-accent/20"}>
                    {ref.status}
                  </Badge>
                  {ref.status === "pending" && (
                    <div className="flex gap-1">
                      <Button variant="hero" size="sm" onClick={() => toast.success("Referral approved!")}>Approve</Button>
                      <Button variant="outline" size="sm" onClick={() => toast.info("Referral declined")}>Decline</Button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
