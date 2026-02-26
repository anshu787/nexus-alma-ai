import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Flame, Award, TrendingUp, MessageSquare, Users, Calendar, Briefcase, Heart, Star, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface LeaderEntry {
  user_id: string;
  full_name: string;
  designation: string | null;
  company: string | null;
  engagement_score: number;
}

const scoringRules = [
  { icon: MessageSquare, action: "Post in community", points: "+10" },
  { icon: Heart, action: "Mentor a student", points: "+50" },
  { icon: Calendar, action: "Attend an event", points: "+25" },
  { icon: Briefcase, action: "Post a job opportunity", points: "+30" },
  { icon: Users, action: "Successful referral", points: "+75" },
  { icon: Star, action: "Daily login streak", points: "+5/day" },
];

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [myScore, setMyScore] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, designation, company, engagement_score")
        .order("engagement_score", { ascending: false })
        .limit(20);
      setLeaderboard((data || []).map(d => ({ ...d, engagement_score: d.engagement_score || 0 })));

      if (user) {
        const { data: me } = await supabase.from("profiles").select("engagement_score").eq("user_id", user.id).single();
        setMyScore(me?.engagement_score || 0);
      }
      setLoading(false);
    };
    fetchLeaderboard();
  }, [user]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <Trophy className="h-6 w-6 text-accent" /> Engagement Leaderboard
        </h1>
        <p className="text-muted-foreground text-sm">Top alumni contributors driving community impact</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-3">
          {/* Top 3 podium */}
          {top3.length >= 3 && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[1, 0, 2].map((idx) => {
                const person = top3[idx];
                if (!person) return null;
                const initials = person.full_name.split(" ").map(n => n[0]).join("").slice(0, 2);
                return (
                  <motion.div key={person.user_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.15 }}
                    className={`bg-card border border-border rounded-xl p-4 text-center shadow-card ${idx === 0 ? "ring-2 ring-accent/30" : ""}`}>
                    <div className="relative inline-block mb-2">
                      <div className={`h-14 w-14 rounded-full flex items-center justify-center mx-auto ${idx === 0 ? "bg-accent/20" : "bg-secondary"}`}>
                        <span className={`font-heading font-bold ${idx === 0 ? "text-accent text-lg" : "text-foreground"}`}>{initials}</span>
                      </div>
                      <div className={`absolute -bottom-1 -right-1 h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${idx === 0 ? "bg-accent text-accent-foreground" : "bg-secondary text-foreground"}`}>
                        #{idx + 1}
                      </div>
                    </div>
                    <p className="font-heading font-semibold text-sm text-card-foreground truncate">{person.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{person.designation || "—"}{person.company ? ` at ${person.company}` : ""}</p>
                    <p className="text-lg font-heading font-bold text-accent mt-1">{person.engagement_score.toLocaleString()}</p>
                  </motion.div>
                );
              })}
            </div>
          )}

          {rest.map((person, i) => {
            const initials = person.full_name.split(" ").map(n => n[0]).join("").slice(0, 2);
            return (
              <motion.div key={person.user_id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.04 }}
                className="bg-card border border-border rounded-xl p-4 shadow-card flex items-center gap-4">
                <span className="text-lg font-heading font-bold text-muted-foreground w-8 text-center">#{i + 4}</span>
                <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-accent">{initials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-semibold text-sm text-card-foreground truncate">{person.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{person.designation || "—"}{person.company ? ` at ${person.company}` : ""}</p>
                </div>
                <span className="text-lg font-heading font-bold text-accent">{person.engagement_score.toLocaleString()}</span>
              </motion.div>
            );
          })}

          {leaderboard.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">No engagement data yet. Start contributing!</div>}
        </div>

        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5 shadow-card">
            <h3 className="font-heading font-semibold text-sm text-card-foreground mb-3 flex items-center gap-2">
              <Award className="h-4 w-4 text-accent" /> How Points Work
            </h3>
            <div className="space-y-3">
              {scoringRules.map((rule) => (
                <div key={rule.action} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <rule.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-card-foreground">{rule.action}</span>
                  </div>
                  <Badge className="bg-success/10 text-success border-success/20 text-xs">{rule.points}</Badge>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 shadow-card">
            <h3 className="font-heading font-semibold text-sm text-card-foreground mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-accent" /> Your Stats
            </h3>
            <div className="text-center py-4">
              <p className="text-3xl font-heading font-bold text-accent">{myScore}</p>
              <p className="text-xs text-muted-foreground mt-1">Engagement Score</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
