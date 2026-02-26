import { motion } from "framer-motion";
import { BarChart3, Globe, TrendingUp, Users, Briefcase, Award } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

const engagementData = [
  { month: "Sep", score: 620 }, { month: "Oct", score: 740 },
  { month: "Nov", score: 890 }, { month: "Dec", score: 810 },
  { month: "Jan", score: 1050 }, { month: "Feb", score: 1280 },
];

const industryData = [
  { name: "Technology", value: 3200, color: "#f59e0b" },
  { name: "Finance", value: 1800, color: "#3b82f6" },
  { name: "Healthcare", value: 1200, color: "#10b981" },
  { name: "Education", value: 950, color: "#8b5cf6" },
  { name: "Consulting", value: 780, color: "#ec4899" },
  { name: "Others", value: 1600, color: "#6b7280" },
];

const skillTrends = [
  { skill: "AI/ML", current: 420, previous: 280 },
  { skill: "Cloud", current: 380, previous: 310 },
  { skill: "Data Sci.", current: 350, previous: 250 },
  { skill: "Product", current: 290, previous: 240 },
  { skill: "DevOps", current: 260, previous: 200 },
  { skill: "Blockchain", current: 180, previous: 120 },
];

const geoData = [
  { city: "Bangalore", alumni: 2800, lat: 12.97, lng: 77.59 },
  { city: "Mumbai", alumni: 1950, lat: 19.08, lng: 72.88 },
  { city: "Delhi", alumni: 1600, lat: 28.61, lng: 77.21 },
  { city: "Hyderabad", alumni: 1200, lat: 17.39, lng: 78.49 },
  { city: "San Francisco", alumni: 890, lat: 37.77, lng: -122.42 },
  { city: "Seattle", alumni: 650, lat: 47.61, lng: -122.33 },
  { city: "New York", alumni: 580, lat: 40.71, lng: -74.01 },
  { city: "London", alumni: 420, lat: 51.51, lng: -0.13 },
];

const impactMetrics = [
  { icon: Users, label: "Active Mentors", value: "1,234", change: "+12%" },
  { icon: Briefcase, label: "Placements via Alumni", value: "847", change: "+18%" },
  { icon: Award, label: "Referral Success Rate", value: "72%", change: "+5%" },
  { icon: TrendingUp, label: "Community Growth", value: "23%", change: "+3%" },
];

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-accent" /> Analytics & Intelligence
        </h1>
        <p className="text-muted-foreground text-sm">Institutional impact metrics, geo intelligence, and trend analysis</p>
      </div>

      {/* Impact metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {impactMetrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-card border border-border rounded-xl p-4 shadow-card"
          >
            <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center mb-3">
              <m.icon className="h-4 w-4 text-accent" />
            </div>
            <div className="text-xl font-heading font-bold text-card-foreground">{m.value}</div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-muted-foreground">{m.label}</span>
              <span className="text-xs font-medium text-success">{m.change}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Engagement Growth */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-xl p-5 shadow-card">
          <h2 className="font-heading font-semibold text-card-foreground text-sm mb-4">Engagement Growth</h2>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={engagementData}>
              <defs>
                <linearGradient id="engGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 16% 90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(0 0% 100%)", border: "1px solid hsl(220 16% 90%)", borderRadius: "8px", fontSize: 12 }} />
              <Area type="monotone" dataKey="score" stroke="#f59e0b" fill="url(#engGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Industry Distribution */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="bg-card border border-border rounded-xl p-5 shadow-card">
          <h2 className="font-heading font-semibold text-card-foreground text-sm mb-4">Industry Distribution</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={industryData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" paddingAngle={3} stroke="none">
                {industryData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "hsl(0 0% 100%)", border: "1px solid hsl(220 16% 90%)", borderRadius: "8px", fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Skill Trends */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="bg-card border border-border rounded-xl p-5 shadow-card">
          <h2 className="font-heading font-semibold text-card-foreground text-sm mb-4">Skill Trends (YoY)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={skillTrends} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 16% 90%)" />
              <XAxis dataKey="skill" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(0 0% 100%)", border: "1px solid hsl(220 16% 90%)", borderRadius: "8px", fontSize: 12 }} />
              <Bar dataKey="previous" fill="#cbd5e1" radius={[4, 4, 0, 0]} name="Last Year" />
              <Bar dataKey="current" fill="#f59e0b" radius={[4, 4, 0, 0]} name="This Year" />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Geographic Distribution (heatmap-style table) */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="bg-card border border-border rounded-xl p-5 shadow-card">
          <h2 className="font-heading font-semibold text-card-foreground text-sm mb-4 flex items-center gap-2">
            <Globe className="h-4 w-4 text-accent" /> Geographic Distribution
          </h2>
          <div className="space-y-2">
            {geoData.map((g, i) => {
              const maxAlumni = Math.max(...geoData.map((d) => d.alumni));
              const pct = (g.alumni / maxAlumni) * 100;
              return (
                <div key={g.city} className="flex items-center gap-3">
                  <span className="text-sm text-card-foreground w-28 truncate font-medium">{g.city}</span>
                  <div className="flex-1 bg-secondary rounded-full h-5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.7 + i * 0.05, duration: 0.6 }}
                      className="h-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, #f59e0b ${pct > 60 ? "" : ", #fbbf24"})`,
                        opacity: 0.3 + (pct / 100) * 0.7,
                      }}
                    />
                  </div>
                  <span className="text-xs font-heading font-bold text-muted-foreground w-12 text-right">{g.alumni.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
