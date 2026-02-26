import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Mail, Linkedin, Building2, Loader2, CheckCircle2, Clock, XCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const statusConfig: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  pending: { icon: Clock, color: "bg-warning/10 text-warning", label: "Pending Review" },
  approved: { icon: CheckCircle2, color: "bg-success/10 text-success", label: "Approved" },
  rejected: { icon: XCircle, color: "bg-destructive/10 text-destructive", label: "Rejected" },
};

interface VerificationRequest {
  id: string;
  verification_type: string;
  status: string;
  verification_data: any;
  created_at: string;
  reviewed_at: string | null;
}

export default function VerificationPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: profile } = await supabase.from("profiles").select("is_verified").eq("user_id", user.id).single();
      setIsVerified(profile?.is_verified || false);

      const { data } = await supabase
        .from("verification_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setRequests((data || []) as VerificationRequest[]);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const submitVerification = async (type: string) => {
    if (!user) return;
    setSubmitting(true);

    let verificationData: any = {};
    if (type === "company_email") {
      if (!companyEmail || !companyName) { toast.error("Fill in all fields"); setSubmitting(false); return; }
      verificationData = { company_email: companyEmail, company_name: companyName };
    } else if (type === "linkedin") {
      if (!linkedinUrl) { toast.error("Enter your LinkedIn URL"); setSubmitting(false); return; }
      verificationData = { linkedin_url: linkedinUrl };
    }

    const { data, error } = await supabase.from("verification_requests").insert({
      user_id: user.id,
      verification_type: type,
      verification_data: verificationData,
    }).select().single();

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Verification request submitted!");
      setRequests((prev) => [data as VerificationRequest, ...prev]);
      setCompanyEmail(""); setCompanyName(""); setLinkedinUrl("");
    }
    setSubmitting(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-accent" /> Profile Verification
        </h1>
        <p className="text-muted-foreground text-sm">Verify your identity to earn a trusted badge</p>
      </div>

      {isVerified && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-success/10 border border-success/20 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-success" />
          <div>
            <p className="font-heading font-semibold text-success text-sm">Profile Verified ✅</p>
            <p className="text-xs text-success/80">Your profile has been verified and displays a trusted badge.</p>
          </div>
        </motion.div>
      )}

      <Tabs defaultValue="company_email">
        <TabsList>
          <TabsTrigger value="company_email"><Mail className="h-4 w-4 mr-1" /> Company Email</TabsTrigger>
          <TabsTrigger value="linkedin"><Linkedin className="h-4 w-4 mr-1" /> LinkedIn</TabsTrigger>
        </TabsList>

        <TabsContent value="company_email" className="mt-4">
          <div className="bg-card border border-border rounded-xl p-6 shadow-card space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-info" />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-card-foreground text-sm">Company Email Verification</h3>
                <p className="text-xs text-muted-foreground">Verify using your official company email address</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><Label>Company Name</Label><Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Google" /></div>
              <div><Label>Company Email</Label><Input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} placeholder="you@company.com" /></div>
            </div>
            <Button variant="hero" onClick={() => submitVerification("company_email")} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit for Verification
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="linkedin" className="mt-4">
          <div className="bg-card border border-border rounded-xl p-6 shadow-card space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center">
                <Linkedin className="h-5 w-5 text-info" />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-card-foreground text-sm">LinkedIn Verification</h3>
                <p className="text-xs text-muted-foreground">Verify by linking your LinkedIn profile</p>
              </div>
            </div>
            <div><Label>LinkedIn Profile URL</Label><Input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/yourname" /></div>
            <Button variant="hero" onClick={() => submitVerification("linkedin")} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit for Verification
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Past Requests */}
      {requests.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-heading font-semibold text-foreground text-sm">Your Verification Requests</h2>
          {requests.map((r) => {
            const config = statusConfig[r.status] || statusConfig.pending;
            const Icon = config.icon;
            return (
              <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-4 shadow-card flex items-center gap-4">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${config.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-card-foreground capitalize">{r.verification_type.replace(/_/g, " ")} Verification</p>
                  <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <Badge variant="outline" className={`text-xs ${config.color}`}>{config.label}</Badge>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
