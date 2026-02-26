import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Award, TrendingUp, Users, Briefcase, Target, Heart, Loader2, ArrowUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface ImpactMetrics {
  totalImpactEvents: number;
  referralToHire: number;
  mentorshipCount: number;
  placementRate: number;
  actionBreakdown: { name: string; value: number; color: string }[];
  monthlyTrend: { month: string; events: number }[];
  topContributors: { user_id: string; full_name: string; company: string | null; count: number }[];
}

const COLORS = ["hsl(var(--accent))", "hsl(var(--info))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))"];

export default function ImpactDashboard() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<ImpactMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      // Get all impact events
      const { data: events } = await supabase.from("impact_events").select("*");
      const { data: referrals } = await supabase.from("referral_requests").select("*");
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, company");

      const allEvents = events || [];
      const allReferrals = referrals || [];

      // Calculate metrics
      const totalImpactEvents = allEvents.length;
      const referralToHire = allEvents.filter(e => e.action === "referral" && e.outcome === "hired").length;
      const mentorshipCount = allEvents.filter(e => e.action === "mentorship").length;
      const totalReferrals = allReferrals.length;
      const approvedReferrals = allReferrals.filter(r => r.status === "approved").length;
      const placementRate = totalReferrals > 0 ? Math.round((approvedReferrals / totalReferrals) * 100) : 0;

      // Action breakdown
      const actionCounts: Record<string, number> = {};
      allEvents.forEach(e => { actionCounts[e.action] = (actionCounts[e.action] || 0) + 1; });
      const actionBreakdown = Object.entries(actionCounts).map(([name, value], i) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        color: COLORS[i % COLORS.length],
      }));

      // Monthly trend (last 6 months)
      const monthlyTrend: { month: string; events: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthStr = d.toLocaleString("default", { month: "short" });
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString();
        const count = allEvents.filter(e => e.created_at >= monthStart && e.created_at <= monthEnd).length;
        monthlyTrend.push({ month: monthStr, events: count });
      }

      // Top contributors
      const contributorCounts: Record<string, number> = {};
      allEvents.forEach(e => { contributorCounts[e.source_user_id] = (contributorCounts[e.source_user_id] || 0) + 1; });
      const topContributors = Object.entries(contributorCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([user_id, count]) => {
          const profile = profiles?.find(p => p.user_id === user_id);
          return { user_id, full_name: profile?.full_name || "Unknown", company: profile?.company || null, count };
        });

      setMetrics({ totalImpactEvents, referralToHire, mentorshipCount, placementRate, actionBreakdown, monthlyTrend, topContributors });
      setLoading(false);
    };

    fetchMetrics();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;

  const stats = [
    { icon: Target, label: "Total Impact Events", value: metrics?.totalImpactEvents || 0, color: "bg-accent/10 text-accent" },
    { icon: Briefcase, label: "Referrals → Hired", value: metrics?.referralToHire || 0, color: "bg-success/10 text-success" },
    { icon: Heart, label: "Mentorships", value: metrics?.mentorshipCount || 0, color: "bg-info/10 text-info" },
    { icon: TrendingUp, label: "Placement Rate", value: `${metrics?.placementRate || 0}%`, color: "bg-warning/10 text-warning" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <Award className="h-6 w-6 text-accent" /> Impact Intelligence Dashboard
        </h1>
        <p className="text-muted-foreground text-sm">Measuring real outcomes — mentorships, referrals, placements, and community impact</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="bg-card border border-border rounded-xl p-5 shadow-card">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon className="h-5 w-5" />
            </div>
            <p className="text-2xl font-heading font-bold text-card-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Monthly trend */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-xl p-5 shadow-card">
          <h2 className="font-heading font-semibold text-card-foreground text-sm mb-4">Impact Events Over Time</h2>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={metrics?.monthlyTrend || []}>
              <defs>
                <linearGradient id="impactGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="events" stroke="hsl(var(--accent))" fill="url(#impactGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Action breakdown pie */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="bg-card border border-border rounded-xl p-5 shadow-card">
          <h2 className="font-heading font-semibold text-card-foreground text-sm mb-4">Impact by Action Type</h2>
          {(metrics?.actionBreakdown?.length || 0) > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={metrics?.actionBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" paddingAngle={3} stroke="none">
                  {metrics?.actionBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-60 text-muted-foreground text-sm">No impact events yet</div>
          )}
        </motion.div>

        {/* Top contributors */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="bg-card border border-border rounded-xl p-5 shadow-card lg:col-span-2">
          <h2 className="font-heading font-semibold text-card-foreground text-sm mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-accent" /> Top Impact Contributors
          </h2>
          {(metrics?.topContributors?.length || 0) > 0 ? (
            <div className="space-y-3">
              {metrics?.topContributors.map((c, i) => (
                <div key={c.user_id} className="flex items-center gap-4">
                  <span className="text-lg font-heading font-bold text-muted-foreground w-8 text-center">#{i + 1}</span>
                  <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-accent">{c.full_name.split(" ").map(n => n[0]).join("").slice(0, 2)}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-heading font-semibold text-sm text-card-foreground">{c.full_name}</p>
                    <p className="text-xs text-muted-foreground">{c.company || "—"}</p>
                  </div>
                  <span className="text-lg font-heading font-bold text-accent">{c.count}</span>
                  <span className="text-xs text-muted-foreground">events</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">No contributors yet. Impact events will show here.</div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
