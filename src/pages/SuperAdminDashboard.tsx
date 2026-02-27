import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Shield, Building2, Users, BarChart3, MessageSquare, AlertTriangle,
  CreditCard, TrendingUp, Activity, Search, MoreHorizontal, Eye,
  Ban, CheckCircle2, Loader2, Globe, UserCog, ChevronDown, Plus, UserPlus,
  Upload, FileText, Clock, ArrowUpDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

const ROLES = ["super_admin", "institution_admin", "alumni", "student", "moderator"] as const;

const roleBadgeColors: Record<string, string> = {
  super_admin: "bg-destructive/10 text-destructive border-destructive/20",
  institution_admin: "bg-accent/10 text-accent border-accent/20",
  alumni: "bg-info/10 text-info border-info/20",
  student: "bg-success/10 text-success border-success/20",
  moderator: "bg-warning/10 text-warning border-warning/20",
};

interface UserWithRole {
  user_id: string;
  full_name: string;
  email?: string;
  company: string | null;
  role: string;
  role_id: string | null;
}

interface ActivityLog {
  id: string;
  admin_id: string;
  action: string;
  target_user_id: string | null;
  details: Record<string, any>;
  created_at: string;
  admin_name?: string;
  target_name?: string;
}

interface CsvUser {
  email: string;
  full_name: string;
  role: string;
  password?: string;
}

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const actionIcons: Record<string, typeof Shield> = {
  role_change: UserCog,
  user_created: UserPlus,
  bulk_import: Upload,
};

const actionColors: Record<string, string> = {
  role_change: "bg-warning/10 text-warning",
  user_created: "bg-success/10 text-success",
  bulk_import: "bg-info/10 text-info",
};

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [flaggedPosts, setFlaggedPosts] = useState(mockFlaggedPosts);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [usersWithRoles, setUsersWithRoles] = useState<UserWithRole[]>([]);
  const [roleSearch, setRoleSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [roleLoading, setRoleLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", password: "", full_name: "", role: "alumni" as string });

  // Activity log state
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // CSV import state
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvData, setCsvData] = useState<CsvUser[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvProgress, setCsvProgress] = useState({ done: 0, total: 0, errors: [] as string[] });
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Fetch users with roles
  const fetchUsersWithRoles = async () => {
    setRoleLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, company").order("full_name");
    const { data: roles } = await supabase.from("user_roles").select("id, user_id, role");
    if (profiles && roles) {
      const merged: UserWithRole[] = profiles.map((p) => {
        const r = roles.find((r) => r.user_id === p.user_id);
        return { user_id: p.user_id, full_name: p.full_name, company: p.company, role: r?.role || "alumni", role_id: r?.id || null };
      });
      setUsersWithRoles(merged);
    }
    setRoleLoading(false);
  };

  useEffect(() => { if (isAdmin) fetchUsersWithRoles(); }, [isAdmin]);

  // Fetch activity logs
  const fetchActivityLogs = async () => {
    setActivityLoading(true);
    const { data } = await supabase
      .from("admin_activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (data && data.length > 0) {
      // Get profile names for admin and target users
      const userIds = [...new Set([
        ...data.map(d => d.admin_id),
        ...data.filter(d => d.target_user_id).map(d => d.target_user_id!)
      ])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      const nameMap: Record<string, string> = {};
      profiles?.forEach(p => { nameMap[p.user_id] = p.full_name; });

      setActivityLogs(data.map(log => ({
        ...log,
        details: (log.details || {}) as Record<string, any>,
        admin_name: nameMap[log.admin_id] || "Unknown",
        target_name: log.target_user_id ? (nameMap[log.target_user_id] || "Unknown") : undefined,
      })));
    } else {
      setActivityLogs([]);
    }
    setActivityLoading(false);
  };

  useEffect(() => { if (isAdmin) fetchActivityLogs(); }, [isAdmin]);

  // Log activity helper
  const logActivity = async (action: string, targetUserId: string | null, details: Record<string, any>) => {
    if (!user) return;
    await supabase.from("admin_activity_logs").insert({
      admin_id: user.id,
      action,
      target_user_id: targetUserId,
      details,
    });
    fetchActivityLogs();
  };

  const updateUserRole = async (targetUserId: string, newRole: string, existingRoleId: string | null) => {
    if (targetUserId === user?.id) { toast.error("Cannot change your own role"); return; }
    const oldRole = usersWithRoles.find(u => u.user_id === targetUserId)?.role || "unknown";
    try {
      if (existingRoleId) {
        await supabase.from("user_roles").update({ role: newRole as any }).eq("id", existingRoleId);
      } else {
        await supabase.from("user_roles").insert({ user_id: targetUserId, role: newRole as any });
      }
      setUsersWithRoles((prev) => prev.map((u) => u.user_id === targetUserId ? { ...u, role: newRole } : u));
      toast.success(`Role updated to ${newRole.replace(/_/g, " ")}`);

      // Log the activity
      const targetName = usersWithRoles.find(u => u.user_id === targetUserId)?.full_name || "Unknown";
      await logActivity("role_change", targetUserId, {
        old_role: oldRole,
        new_role: newRole,
        target_name: targetName,
      });
    } catch {
      toast.error("Failed to update role");
    }
  };

  const createUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.full_name) {
      toast.error("Fill all required fields");
      return;
    }
    if (newUser.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user-admin", {
        body: { email: newUser.email, password: newUser.password, full_name: newUser.full_name, role: newUser.role },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`User ${newUser.full_name} created as ${newUser.role.replace(/_/g, " ")}`);

      await logActivity("user_created", null, {
        email: newUser.email,
        full_name: newUser.full_name,
        role: newUser.role,
      });

      setCreateOpen(false);
      setNewUser({ email: "", password: "", full_name: "", role: "alumni" });
      fetchUsersWithRoles();
    } catch (e: any) {
      toast.error(e.message || "Failed to create user");
    }
    setCreating(false);
  };

  // CSV parsing
  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a .csv file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) { toast.error("CSV must have a header row and at least one data row"); return; }

      const header = lines[0].toLowerCase().split(",").map(h => h.trim());
      const emailIdx = header.indexOf("email");
      const nameIdx = header.indexOf("full_name") !== -1 ? header.indexOf("full_name") : header.indexOf("name");
      const roleIdx = header.indexOf("role");
      const passIdx = header.indexOf("password");

      if (emailIdx === -1 || nameIdx === -1) {
        toast.error("CSV must have 'email' and 'full_name' (or 'name') columns");
        return;
      }

      const parsed: CsvUser[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
        const email = cols[emailIdx];
        const full_name = cols[nameIdx];
        const role = roleIdx !== -1 ? cols[roleIdx] : "alumni";
        const password = passIdx !== -1 ? cols[passIdx] : undefined;

        if (!email || !full_name) continue;

        // Validate role
        const validRole = ROLES.includes(role as any) ? role : "alumni";
        parsed.push({ email, full_name, role: validRole, password });
      }

      if (parsed.length === 0) { toast.error("No valid rows found in CSV"); return; }
      if (parsed.length > 100) { toast.error("Maximum 100 users per import"); return; }

      setCsvData(parsed);
      toast.success(`${parsed.length} users parsed from CSV`);
    };
    reader.readAsText(file);
  };

  const importCsvUsers = async () => {
    if (csvData.length === 0) return;
    setCsvImporting(true);
    setCsvProgress({ done: 0, total: csvData.length, errors: [] });
    const errors: string[] = [];
    let done = 0;

    for (const csvUser of csvData) {
      try {
        const { data, error } = await supabase.functions.invoke("create-user-admin", {
          body: {
            email: csvUser.email,
            password: csvUser.password || "Alumni@2026",
            full_name: csvUser.full_name,
            role: csvUser.role,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        done++;
      } catch (e: any) {
        errors.push(`${csvUser.email}: ${e.message || "Failed"}`);
      }
      setCsvProgress({ done: done, total: csvData.length, errors: [...errors] });
    }

    await logActivity("bulk_import", null, {
      total: csvData.length,
      success: done,
      failed: errors.length,
    });

    setCsvImporting(false);
    if (errors.length === 0) {
      toast.success(`All ${done} users imported successfully!`);
    } else {
      toast.warning(`${done} imported, ${errors.length} failed`);
    }
    fetchUsersWithRoles();
  };

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

  const filteredUsers = usersWithRoles.filter((u) => {
    const matchSearch = u.full_name.toLowerCase().includes(roleSearch.toLowerCase()) ||
      u.role.toLowerCase().includes(roleSearch.toLowerCase()) ||
      (u.company || "").toLowerCase().includes(roleSearch.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const roleCounts = usersWithRoles.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-accent" /> Super Admin Dashboard
          </h1>
          <p className="text-muted-foreground text-sm">Platform-wide management and analytics</p>
        </div>
        <div className="flex items-center gap-2">
          {/* CSV Import Dialog */}
          <Dialog open={csvOpen} onOpenChange={(v) => { setCsvOpen(v); if (!v) { setCsvData([]); setCsvProgress({ done: 0, total: 0, errors: [] }); } }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Upload className="h-4 w-4" /> Import CSV</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Bulk Import Users via CSV</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="bg-secondary rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground text-sm">CSV Format</p>
                  <p>Required columns: <code className="bg-background px-1 rounded">email</code>, <code className="bg-background px-1 rounded">full_name</code></p>
                  <p>Optional columns: <code className="bg-background px-1 rounded">role</code> (alumni, student, moderator, institution_admin, super_admin), <code className="bg-background px-1 rounded">password</code></p>
                  <p>Default role: alumni | Default password: Alumni@2026</p>
                  <p>Max 100 users per import.</p>
                </div>

                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleCsvFile}
                    className="hidden"
                  />
                  <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={csvImporting}>
                    <FileText className="h-4 w-4" /> Choose CSV File
                  </Button>
                </div>

                {csvData.length > 0 && !csvImporting && (
                  <>
                    <div className="bg-card border border-border rounded-lg max-h-48 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left p-2 text-muted-foreground font-medium">Email</th>
                            <th className="text-left p-2 text-muted-foreground font-medium">Name</th>
                            <th className="text-left p-2 text-muted-foreground font-medium">Role</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvData.slice(0, 20).map((u, i) => (
                            <tr key={i} className="border-b border-border last:border-0">
                              <td className="p-2 text-foreground truncate max-w-[160px]">{u.email}</td>
                              <td className="p-2 text-foreground">{u.full_name}</td>
                              <td className="p-2">
                                <Badge variant="outline" className={`text-[10px] ${roleBadgeColors[u.role] || ""}`}>
                                  {u.role.replace(/_/g, " ")}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {csvData.length > 20 && (
                        <p className="text-center text-[10px] text-muted-foreground py-1">...and {csvData.length - 20} more</p>
                      )}
                    </div>
                    <Button variant="hero" className="w-full" onClick={importCsvUsers}>
                      <Upload className="h-4 w-4" /> Import {csvData.length} Users
                    </Button>
                  </>
                )}

                {csvImporting && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Importing...</span>
                      <span className="font-medium text-foreground">{csvProgress.done}/{csvProgress.total}</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-accent h-2 rounded-full transition-all"
                        style={{ width: `${(csvProgress.done / csvProgress.total) * 100}%` }}
                      />
                    </div>
                    {csvProgress.errors.length > 0 && (
                      <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-2 max-h-24 overflow-y-auto">
                        {csvProgress.errors.map((e, i) => (
                          <p key={i} className="text-[10px] text-destructive">{e}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!csvImporting && csvProgress.done > 0 && (
                  <div className="bg-success/5 border border-success/20 rounded-lg p-3 text-center">
                    <CheckCircle2 className="h-6 w-6 text-success mx-auto mb-1" />
                    <p className="text-sm font-medium text-foreground">{csvProgress.done} users imported</p>
                    {csvProgress.errors.length > 0 && (
                      <p className="text-xs text-destructive mt-1">{csvProgress.errors.length} failed</p>
                    )}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Create User Dialog */}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="hero" size="sm"><UserPlus className="h-4 w-4" /> Create User</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create New User</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <div><Label>Full Name *</Label><Input value={newUser.full_name} onChange={(e) => setNewUser(p => ({ ...p, full_name: e.target.value }))} placeholder="John Doe" /></div>
                <div><Label>Email *</Label><Input type="email" value={newUser.email} onChange={(e) => setNewUser(p => ({ ...p, email: e.target.value }))} placeholder="john@example.com" /></div>
                <div><Label>Password *</Label><Input type="password" value={newUser.password} onChange={(e) => setNewUser(p => ({ ...p, password: e.target.value }))} placeholder="Min 6 characters" /></div>
                <div>
                  <Label>Role</Label>
                  <Select value={newUser.role} onValueChange={(val) => setNewUser(p => ({ ...p, role: val }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="hero" className="w-full" onClick={createUser} disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  {creating ? "Creating..." : "Create User"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={Users} label="Total Users" value={`${usersWithRoles.length}`} change="All" color="bg-primary/10 text-primary" />
        <StatCard icon={Shield} label="Admins" value={`${(roleCounts["super_admin"] || 0) + (roleCounts["institution_admin"] || 0)}`} change="Super + Inst." color="bg-destructive/10 text-destructive" />
        <StatCard icon={Users} label="Alumni" value={`${roleCounts["alumni"] || 0}`} change="" color="bg-info/10 text-info" />
        <StatCard icon={Users} label="Students" value={`${roleCounts["student"] || 0}`} change="" color="bg-success/10 text-success" />
        <StatCard icon={Users} label="Moderators" value={`${roleCounts["moderator"] || 0}`} change="" color="bg-warning/10 text-warning" />
      </div>

      <Tabs defaultValue="roles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="roles">User Roles</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
          <TabsTrigger value="tenants">Tenants</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="moderation">Moderation</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
        </TabsList>

        {/* User Roles Tab */}
        <TabsContent value="roles" className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2 flex-1 max-w-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={roleSearch} onChange={(e) => setRoleSearch(e.target.value)} placeholder="Search users..." className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full" />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-44 h-9 text-xs"><SelectValue placeholder="Filter by role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{r.replace(/_/g, " ")} ({roleCounts[r] || 0})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-xs">{filteredUsers.length} users</Badge>
          </div>

          {roleLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.slice(0, 50).map((u, i) => (
                <motion.div
                  key={u.user_id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.01 }}
                  className="bg-card border border-border rounded-xl p-4 shadow-card flex items-center gap-4"
                >
                  <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <span className="font-heading font-bold text-muted-foreground text-sm">
                      {u.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-heading font-semibold text-card-foreground">{u.full_name || "Unnamed User"}</p>
                    <p className="text-xs text-muted-foreground">{u.company || "No company"}</p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${roleBadgeColors[u.role] || ""}`}>
                    {u.role.replace(/_/g, " ")}
                  </Badge>
                  <Select
                    value={u.role}
                    onValueChange={(val) => updateUserRole(u.user_id, val, u.role_id)}
                    disabled={u.user_id === user?.id}
                  >
                    <SelectTrigger className="w-44 h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r} className="text-xs">{r.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {u.user_id === user?.id && <Badge variant="outline" className="text-[10px]">You</Badge>}
                </motion.div>
              ))}
              {filteredUsers.length > 50 && (
                <p className="text-center text-xs text-muted-foreground py-2">Showing 50 of {filteredUsers.length} users. Use search to narrow down.</p>
              )}
            </div>
          )}
        </TabsContent>

        {/* Activity Log Tab */}
        <TabsContent value="activity" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-semibold text-foreground text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-accent" /> Recent Admin Activity
            </h3>
            <Button variant="ghost" size="sm" onClick={fetchActivityLogs} disabled={activityLoading}>
              {activityLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpDown className="h-4 w-4" />}
              Refresh
            </Button>
          </div>

          {activityLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
          ) : activityLogs.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No activity logged yet</p>
              <p className="text-xs text-muted-foreground mt-1">Role changes, user creation, and bulk imports will appear here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activityLogs.map((log, i) => {
                const Icon = actionIcons[log.action] || Activity;
                const colorCls = actionColors[log.action] || "bg-muted text-muted-foreground";
                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="bg-card border border-border rounded-xl p-4 shadow-card flex items-start gap-3"
                  >
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${colorCls}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-card-foreground">{log.admin_name}</span>
                        {log.action === "role_change" && (
                          <span className="text-xs text-muted-foreground">
                            changed <span className="font-medium text-card-foreground">{log.details.target_name || log.target_name}</span>'s role from{" "}
                            <Badge variant="outline" className={`text-[10px] ${roleBadgeColors[log.details.old_role] || ""}`}>
                              {(log.details.old_role || "").replace(/_/g, " ")}
                            </Badge>{" "}to{" "}
                            <Badge variant="outline" className={`text-[10px] ${roleBadgeColors[log.details.new_role] || ""}`}>
                              {(log.details.new_role || "").replace(/_/g, " ")}
                            </Badge>
                          </span>
                        )}
                        {log.action === "user_created" && (
                          <span className="text-xs text-muted-foreground">
                            created user <span className="font-medium text-card-foreground">{log.details.full_name}</span>{" "}
                            ({log.details.email}) as{" "}
                            <Badge variant="outline" className={`text-[10px] ${roleBadgeColors[log.details.role] || ""}`}>
                              {(log.details.role || "").replace(/_/g, " ")}
                            </Badge>
                          </span>
                        )}
                        {log.action === "bulk_import" && (
                          <span className="text-xs text-muted-foreground">
                            bulk imported <span className="font-medium text-card-foreground">{log.details.success}</span> users
                            {log.details.failed > 0 && <span className="text-destructive"> ({log.details.failed} failed)</span>}
                          </span>
                        )}
                        {!["role_change", "user_created", "bulk_import"].includes(log.action) && (
                          <span className="text-xs text-muted-foreground">{log.action.replace(/_/g, " ")}</span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(log.created_at)}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </TabsContent>

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
