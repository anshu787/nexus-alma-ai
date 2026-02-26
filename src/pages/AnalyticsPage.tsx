import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, Globe, TrendingUp, Users, Briefcase, Award, Loader2 } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ totalAlumni: 0, activeMentors: 0, referralSuccess: 0, growth: 0 });
  const [industryData, setIndustryData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [skillTrends, setSkillTrends] = useState<{ skill: string; count: number }[]>([]);
  const [geoData, setGeoData] = useState<{ city: string; alumni: number }[]>([]);
  const [engagementData, setEngagementData] = useState<{ month: string; score: number }[]>([]);

  const COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#6b7280"];

  useEffect(() => {
    const fetchAll = async () => {
      // Profiles
      const { data: profiles } = await supabase.from("profiles").select("industry, location, skills, is_mentor, engagement_score, created_at");
      const pList = profiles || [];

      setMetrics({
        totalAlumni: pList.length,
        activeMentors: pList.filter(p => p.is_mentor).length,
        referralSuccess: 0,
        growth: 0,
      });

      // Referral success rate
      const { data: refs } = await supabase.from("referral_requests").select("status");
      const totalRefs = (refs || []).length;
      const approved = (refs || []).filter(r => r.status === "approved").length;
      setMetrics(m => ({ ...m, referralSuccess: totalRefs > 0 ? Math.round((approved / totalRefs) * 100) : 0 }));

      // Industry distribution
      const industryCounts: Record<string, number> = {};
      pList.forEach(p => {
        const ind = p.industry || "Other";
        industryCounts[ind] = (industryCounts[ind] || 0) + 1;
      });
      setIndustryData(
        Object.entries(industryCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 6)
          .map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }))
      );

      // Skill trends
      const skillCounts: Record<string, number> = {};
      pList.forEach(p => (p.skills || []).forEach((s: string) => { skillCounts[s] = (skillCounts[s] || 0) + 1; }));
      setSkillTrends(
        Object.entries(skillCounts).sort(([, a], [, b]) => b - a).slice(0, 8).map(([skill, count]) => ({ skill, count }))
      );

      // Geo distribution
      const geoCounts: Record<string, number> = {};
      pList.forEach(p => {
        const loc = p.location || "Unknown";
        const city = loc.split(",")[0].trim();
        if (city && city !== "Unknown") geoCounts[city] = (geoCounts[city] || 0) + 1;
      });
      setGeoData(Object.entries(geoCounts).sort(([, a], [, b]) => b - a).slice(0, 8).map(([city, alumni]) => ({ city, alumni })));

      // Engagement over time (monthly signup counts as proxy)
      const monthlyCounts: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        const key = d.toLocaleString("default", { month: "short" });
        monthlyCounts[key] = 0;
      }
      pList.forEach(p => {
        const d = new Date(p.created_at);
        const key = d.toLocaleString("default", { month: "short" });
        if (key in monthlyCounts) monthlyCounts[key]++;
      });
      setEngagementData(Object.entries(monthlyCounts).map(([month, score]) => ({ month, score })));

      setLoading(false);
    };
    fetchAll();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;

  const impactMetrics = [
    { icon: Users, label: "Total Alumni", value: metrics.totalAlumni.toLocaleString() },
    { icon: Briefcase, label: "Active Mentors", value: metrics.activeMentors.toLocaleString() },
    { icon: Award, label: "Referral Success", value: `${metrics.referralSuccess}%` },
    { icon: TrendingUp, label: "Skill Trends", value: skillTrends.length.toString() },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-accent" /> Analytics & Intelligence
        </h1>
        <p className="text-muted-foreground text-sm">Real data from your alumni database</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {impactMetrics.map((m, i) => (
          <motion.div key={m.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="bg-card border border-border rounded-xl p-4 shadow-card">
            <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center mb-3"><m.icon className="h-4 w-4 text-accent" /></div>
            <div className="text-xl font-heading font-bold text-card-foreground">{m.value}</div>
            <span className="text-xs text-muted-foreground">{m.label}</span>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Signups over time */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-xl p-5 shadow-card">
          <h2 className="font-heading font-semibold text-card-foreground text-sm mb-4">New Signups (Monthly)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={engagementData}>
              <defs><linearGradient id="engGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="score" stroke="#f59e0b" fill="url(#engGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Industry Distribution */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="bg-card border border-border rounded-xl p-5 shadow-card">
          <h2 className="font-heading font-semibold text-card-foreground text-sm mb-4">Industry Distribution</h2>
          {industryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={industryData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" paddingAngle={3} stroke="none">
                  {industryData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-60 text-sm text-muted-foreground">No industry data yet</div>
          )}
        </motion.div>

        {/* Skill Trends */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="bg-card border border-border rounded-xl p-5 shadow-card">
          <h2 className="font-heading font-semibold text-card-foreground text-sm mb-4">Top Skills</h2>
          {skillTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={skillTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="skill" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-60 text-sm text-muted-foreground">No skill data yet</div>
          )}
        </motion.div>

        {/* Geo Distribution */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="bg-card border border-border rounded-xl p-5 shadow-card">
          <h2 className="font-heading font-semibold text-card-foreground text-sm mb-4 flex items-center gap-2">
            <Globe className="h-4 w-4 text-accent" /> Geographic Distribution
          </h2>
          <div className="space-y-2">
            {geoData.map((g, i) => {
              const maxAlumni = Math.max(...geoData.map(d => d.alumni), 1);
              const pct = (g.alumni / maxAlumni) * 100;
              return (
                <div key={g.city} className="flex items-center gap-3">
                  <span className="text-sm text-card-foreground w-28 truncate font-medium">{g.city}</span>
                  <div className="flex-1 bg-secondary rounded-full h-5 overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.7 + i * 0.05, duration: 0.6 }}
                      className="h-full rounded-full bg-accent" style={{ opacity: 0.3 + (pct / 100) * 0.7 }} />
                  </div>
                  <span className="text-xs font-heading font-bold text-muted-foreground w-12 text-right">{g.alumni}</span>
                </div>
              );
            })}
            {geoData.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No location data yet</p>}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
