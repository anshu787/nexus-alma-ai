import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Shield, Building2, Users, BarChart3, MessageSquare, AlertTriangle,
  CreditCard, TrendingUp, Activity, Search, MoreHorizontal, Eye,
  Ban, CheckCircle2, Loader2, Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const platformGrowth = [
  { month: "Sep", users: 850, posts: 320, events: 12 },
  { month: "Oct", users: 1240, posts: 580, events: 18 },
  { month: "Nov", users: 1680, posts: 920, events: 25 },
  { month: "Dec", users: 2100, posts: 1350, events: 31 },
  { month: "Jan", users: 2800, posts: 1890, events: 42 },
  { month: "Feb", users: 3450, posts: 2400, events: 55 },
];

const subscriptionData = [
  { name: "Free", value: 45, color: "hsl(var(--muted-foreground))" },
  { name: "Pro", value: 35, color: "hsl(var(--info))" },
  { name: "Enterprise", value: 20, color: "hsl(var(--accent))" },
];

interface Institution {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  created_at: string;
  alumni_count?: number;
}

interface FlaggedPost {
  id: string;
  content: string;
  user_name: string;
  reason: string;
  created_at: string;
}

const mockFlaggedPosts: FlaggedPost[] = [
  { id: "f1", content: "Spam content promoting unverified products...", user_name: "Unknown User", reason: "Spam", created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: "f2", content: "Inappropriate language in alumni community...", user_name: "Test Account", reason: "Inappropriate", created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: "f3", content: "Misleading job posting with fake company details...", user_name: "Rogue User", reason: "Misleading", created_at: new Date(Date.now() - 86400000).toISOString() },
];

function StatCard({ icon: Icon, label, value, change, color }: { icon: any; label: string; value: string; change: string; color: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-5 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <Badge variant="outline" className="text-success text-xs">{change}</Badge>
      </div>
      <p className="text-2xl font-heading font-bold text-card-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </motion.div>
  );
}

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [flaggedPosts, setFlaggedPosts] = useState(mockFlaggedPosts);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Check role
  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      const roles = (data || []).map((r) => r.role);
      setIsAdmin(roles.includes("super_admin"));
    });
  }, [user]);

  useEffect(() => {
    if (isAdmin !== true) return;
    (async () => {
      const { data } = await supabase.from("institutions").select("*").order("created_at", { ascending: false });
      if (data) {
        const withCounts = await Promise.all(data.map(async (inst) => {
          const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("institution_id", inst.id);
          return { ...inst, alumni_count: count || 0 };
        }));
        setInstitutions(withCounts);
      }
      setLoading(false);
    })();
  }, [isAdmin]);

  if (isAdmin === null) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;

  if (!isAdmin) return (
    <div className="text-center py-20">
      <Shield className="h-12 w-12 text-destructive/30 mx-auto mb-4" />
      <h2 className="text-lg font-heading font-semibold text-foreground">Access Denied</h2>
      <p className="text-sm text-muted-foreground mt-1">You need Super Admin privileges to access this dashboard.</p>
    </div>
  );

  const dismissPost = (id: string) => {
    setFlaggedPosts((prev) => prev.filter((p) => p.id !== id));
    toast.success("Post dismissed");
  };

  const removePost = (id: string) => {
    setFlaggedPosts((prev) => prev.filter((p) => p.id !== id));
    toast.success("Post removed");
  };

  const filteredInstitutions = institutions.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <Shield className="h-6 w-6 text-accent" /> Super Admin Dashboard
        </h1>
        <p className="text-muted-foreground text-sm">Platform-wide management and analytics</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Total Institutions" value={`${institutions.length}`} change="+3 this month" color="bg-info/10 text-info" />
        <StatCard icon={Users} label="Total Alumni" value="3,450" change="+12%" color="bg-accent/10 text-accent" />
        <StatCard icon={Activity} label="Daily Active Users" value="892" change="+8%" color="bg-success/10 text-success" />
        <StatCard icon={CreditCard} label="MRR" value="$24,500" change="+15%" color="bg-warning/10 text-warning" />
      </div>

      <Tabs defaultValue="tenants" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tenants">Tenant Management</TabsTrigger>
          <TabsTrigger value="analytics">Platform Analytics</TabsTrigger>
          <TabsTrigger value="moderation">Moderation</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
        </TabsList>

        {/* Tenant Management */}
        <TabsContent value="tenants" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2 flex-1 max-w-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search institutions..." className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full" />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
          ) : (
            <div className="space-y-3">
              {filteredInstitutions.length === 0 && (
                <div className="text-center py-12">
                  <Building2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No institutions found</p>
                </div>
              )}
              {filteredInstitutions.map((inst, i) => (
                <motion.div
                  key={inst.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-card border border-border rounded-xl p-5 shadow-card flex items-center gap-4"
                >
                  <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                    {inst.logo_url ? <img src={inst.logo_url} alt="" className="h-full w-full object-contain" /> : <Building2 className="h-6 w-6 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-heading font-semibold text-card-foreground">{inst.name}</h3>
                    <p className="text-xs text-muted-foreground truncate">{inst.description || "No description"}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-muted-foreground">{inst.alumni_count} alumni</span>
                      <span className="text-[10px] text-muted-foreground">Slug: {inst.slug}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-success text-xs">Active</Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="h-4 w-4 text-muted-foreground" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4 text-muted-foreground" /></Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Platform Analytics */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-5 shadow-card">
              <h3 className="font-heading font-semibold text-card-foreground text-sm mb-4">Platform Growth</h3>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={platformGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="users" stroke="hsl(var(--accent))" fill="hsl(var(--accent))" fillOpacity={0.15} strokeWidth={2} />
                  <Area type="monotone" dataKey="posts" stroke="hsl(var(--info))" fill="hsl(var(--info))" fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 shadow-card">
              <h3 className="font-heading font-semibold text-card-foreground text-sm mb-4">Events Created</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={platformGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="events" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        {/* Moderation */}
        <TabsContent value="moderation" className="space-y-4">
          <h3 className="font-heading font-semibold text-foreground text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" /> Flagged Content ({flaggedPosts.length})
          </h3>
          {flaggedPosts.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="h-10 w-10 text-success/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No flagged content. All clear!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {flaggedPosts.map((post) => (
                <div key={post.id} className="bg-card border border-border rounded-xl p-4 shadow-card">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <Badge variant="destructive" className="text-xs mb-1">{post.reason}</Badge>
                      <p className="text-sm text-card-foreground">{post.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">By {post.user_name} • {new Date(post.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button variant="outline" size="sm" onClick={() => dismissPost(post.id)}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Dismiss
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => removePost(post.id)}>
                      <Ban className="h-3.5 w-3.5" /> Remove Post
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Subscriptions */}
        <TabsContent value="subscriptions" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-5 shadow-card">
              <h3 className="font-heading font-semibold text-card-foreground text-sm mb-4">Subscription Distribution</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={subscriptionData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {subscriptionData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 shadow-card space-y-4">
              <h3 className="font-heading font-semibold text-card-foreground text-sm">Revenue Summary</h3>
              {[
                { plan: "Free Tier", count: 15, revenue: "$0" },
                { plan: "Pro ($49/mo)", count: 12, revenue: "$588" },
                { plan: "Enterprise ($199/mo)", count: 6, revenue: "$1,194" },
              ].map((p) => (
                <div key={p.plan} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.plan}</p>
                    <p className="text-xs text-muted-foreground">{p.count} institutions</p>
                  </div>
                  <span className="text-sm font-heading font-bold text-accent">{p.revenue}</span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
