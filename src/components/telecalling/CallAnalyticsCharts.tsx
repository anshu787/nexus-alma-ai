import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { BarChart3, TrendingUp, PieChart as PieIcon } from "lucide-react";

interface CallSession {
  id: string;
  status: string;
  call_type: string;
  started_at: string;
  duration_seconds: number | null;
  intent: string | null;
}

interface CallAnalyticsChartsProps {
  sessions: CallSession[];
}

const CHART_COLORS = [
  "hsl(var(--accent))",
  "hsl(var(--primary))",
  "hsl(var(--info, 210 100% 50%))",
  "hsl(var(--success, 142 76% 36%))",
  "hsl(var(--warning, 38 92% 50%))",
  "hsl(var(--destructive))",
];

export default function CallAnalyticsCharts({ sessions }: CallAnalyticsChartsProps) {
  const dailyVolume = useMemo(() => {
    const map: Record<string, { date: string; total: number; completed: number; failed: number }> = {};
    const now = new Date();
    // Last 14 days
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      map[key] = { date: key, total: 0, completed: 0, failed: 0 };
    }
    sessions.forEach(s => {
      const key = s.started_at.slice(0, 10);
      if (map[key]) {
        map[key].total++;
        if (s.status === "completed") map[key].completed++;
        if (s.status === "auth_failed") map[key].failed++;
      }
    });
    return Object.values(map).map(d => ({
      ...d,
      label: new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    }));
  }, [sessions]);

  const weeklyVolume = useMemo(() => {
    const weeks: Record<string, { week: string; total: number; completed: number; successRate: number }> = {};
    const now = new Date();
    for (let i = 3; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(start.getDate() - (i * 7 + start.getDay()));
      const key = start.toISOString().slice(0, 10);
      const label = `Week of ${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
      weeks[key] = { week: label, total: 0, completed: 0, successRate: 0 };
    }
    const weekKeys = Object.keys(weeks).sort();
    sessions.forEach(s => {
      const sd = new Date(s.started_at);
      for (let i = weekKeys.length - 1; i >= 0; i--) {
        if (sd >= new Date(weekKeys[i] + "T00:00:00")) {
          weeks[weekKeys[i]].total++;
          if (s.status === "completed") weeks[weekKeys[i]].completed++;
          break;
        }
      }
    });
    return Object.values(weeks).map(w => ({
      ...w,
      successRate: w.total > 0 ? Math.round((w.completed / w.total) * 100) : 0,
    }));
  }, [sessions]);

  const callTypeDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    sessions.forEach(s => {
      map[s.call_type] = (map[s.call_type] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [sessions]);

  const avgDuration = useMemo(() => {
    const completed = sessions.filter(s => s.duration_seconds && s.duration_seconds > 0);
    if (completed.length === 0) return 0;
    return Math.round(completed.reduce((a, s) => a + (s.duration_seconds || 0), 0) / completed.length);
  }, [sessions]);

  const successRate = useMemo(() => {
    if (sessions.length === 0) return 0;
    return Math.round((sessions.filter(s => s.status === "completed").length / sessions.length) * 100);
  }, [sessions]);

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No call data available for analytics</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Success Rate", value: `${successRate}%`, sub: "completed calls" },
          { label: "Avg Duration", value: `${Math.floor(avgDuration / 60)}:${(avgDuration % 60).toString().padStart(2, "0")}`, sub: "per call" },
          { label: "Total Sessions", value: sessions.length, sub: "last 14 days" },
          { label: "Call Types", value: callTypeDistribution.length, sub: "categories" },
        ].map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl p-4 shadow-card"
          >
            <p className="text-2xl font-heading font-bold text-card-foreground">{card.value}</p>
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">{card.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Daily Volume Chart */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-xl p-5 shadow-card"
      >
        <h4 className="font-heading font-semibold text-sm text-card-foreground flex items-center gap-2 mb-4">
          <BarChart3 className="h-4 w-4 text-accent" /> Daily Call Volume (14 Days)
        </h4>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={dailyVolume}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Bar dataKey="completed" stackId="a" fill="hsl(var(--success, 142 76% 36%))" radius={[0, 0, 0, 0]} name="Completed" />
            <Bar dataKey="failed" stackId="a" fill="hsl(var(--destructive))" radius={[0, 0, 0, 0]} name="Failed" />
            <Bar dataKey="total" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Total" />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly Success Rate */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-xl p-5 shadow-card"
        >
          <h4 className="font-heading font-semibold text-sm text-card-foreground flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-accent" /> Weekly Success Rate
          </h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weeklyVolume}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} domain={[0, 100]} unit="%" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number) => [`${value}%`, "Success Rate"]}
              />
              <Line
                type="monotone"
                dataKey="successRate"
                stroke="hsl(var(--accent))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--accent))", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Call Type Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card border border-border rounded-xl p-5 shadow-card"
        >
          <h4 className="font-heading font-semibold text-sm text-card-foreground flex items-center gap-2 mb-4">
            <PieIcon className="h-4 w-4 text-accent" /> Call Type Distribution
          </h4>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={callTypeDistribution}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={4}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {callTypeDistribution.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    </div>
  );
}
