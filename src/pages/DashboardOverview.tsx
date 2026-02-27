import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users, Briefcase, TrendingUp, Award, ArrowUp, ArrowDown,
  MessageSquare, Calendar, Brain, Heart, Globe, Phone, Send,
  BarChart3, Target, Trophy, Shield, Settings, DollarSign,
  Share2, MessageCircle, User, Palette, ShieldCheck, Mail
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const statsCards = [
  { icon: Users, label: "Total Alumni", value: "12,847", change: "+3.2%", up: true },
  { icon: Briefcase, label: "Active Mentors", value: "1,234", change: "+12%", up: true },
  { icon: TrendingUp, label: "Placement Rate", value: "87%", change: "+5.1%", up: true },
  { icon: Award, label: "Engagement Score", value: "8.4/10", change: "-0.2", up: false },
];

interface FeatureLink {
  icon: typeof Users;
  label: string;
  description: string;
  path: string;
  color: string;
  roles?: string[];
}

interface FeatureCategory {
  title: string;
  features: FeatureLink[];
}

const featureCategories: FeatureCategory[] = [
  {
    title: "Community & Networking",
    features: [
      { icon: Users, label: "Alumni Directory", description: "Browse and connect with alumni", path: "/dashboard/directory", color: "bg-primary/10 text-primary" },
      { icon: MessageSquare, label: "Social Feed", description: "Updates, posts, and stories", path: "/dashboard/feed", color: "bg-info/10 text-info" },
      { icon: Send, label: "Messages", description: "Direct messaging", path: "/dashboard/messages", color: "bg-accent/10 text-accent" },
      { icon: Globe, label: "Global Map", description: "Alumni locations worldwide", path: "/dashboard/global-map", color: "bg-success/10 text-success" },
      { icon: Share2, label: "Network Graph", description: "Visualize connections", path: "/dashboard/network", color: "bg-warning/10 text-warning" },
      { icon: MessageCircle, label: "Career Forum", description: "Discussion threads", path: "/dashboard/forum", color: "bg-primary/10 text-primary" },
    ],
  },
  {
    title: "Career & Professional Growth",
    features: [
      { icon: Calendar, label: "Events", description: "Workshops, meetups, webinars", path: "/dashboard/events", color: "bg-accent/10 text-accent" },
      { icon: Briefcase, label: "Opportunities", description: "Jobs, internships, referrals", path: "/dashboard/opportunities", color: "bg-success/10 text-success" },
      { icon: Heart, label: "Mentorship", description: "Find or become a mentor", path: "/dashboard/mentorship", color: "bg-destructive/10 text-destructive" },
      { icon: TrendingUp, label: "Career Path", description: "AI-powered career guidance", path: "/dashboard/career-path", color: "bg-info/10 text-info", roles: ["alumni", "student"] },
      { icon: Target, label: "Skill Gap Analyzer", description: "Identify growth areas", path: "/dashboard/skill-gap", color: "bg-warning/10 text-warning", roles: ["alumni", "student"] },
      { icon: DollarSign, label: "Fundraising", description: "Campaigns and donations", path: "/dashboard/fundraising", color: "bg-primary/10 text-primary", roles: ["alumni", "institution_admin"] },
    ],
  },
  {
    title: "Intelligence & Insights",
    features: [
      { icon: Brain, label: "AI Assistant", description: "Smart platform assistant", path: "/dashboard/ai", color: "bg-primary/10 text-primary" },
      { icon: Trophy, label: "Leaderboard", description: "Top contributors", path: "/dashboard/leaderboard", color: "bg-warning/10 text-warning" },
      { icon: BarChart3, label: "Analytics", description: "Your engagement data", path: "/dashboard/analytics", color: "bg-info/10 text-info" },
      { icon: Award, label: "Success Stories", description: "Inspiring alumni journeys", path: "/dashboard/stories", color: "bg-accent/10 text-accent" },
    ],
  },
  {
    title: "Administration",
    features: [
      { icon: BarChart3, label: "Admin Analytics", description: "Institution-wide metrics", path: "/dashboard/admin-analytics", color: "bg-info/10 text-info", roles: ["institution_admin"] },
      { icon: Mail, label: "Campaigns", description: "Email & mailing campaigns", path: "/dashboard/campaigns", color: "bg-accent/10 text-accent", roles: ["institution_admin"] },
      { icon: Award, label: "Impact Dashboard", description: "Measure platform impact", path: "/dashboard/impact", color: "bg-success/10 text-success", roles: ["moderator", "institution_admin"] },
      { icon: ShieldCheck, label: "Verification", description: "Review alumni requests", path: "/dashboard/verification", color: "bg-warning/10 text-warning", roles: ["moderator", "institution_admin"] },
      { icon: Palette, label: "Branding", description: "Customize institution look", path: "/dashboard/branding", color: "bg-primary/10 text-primary", roles: ["institution_admin"] },
      { icon: Phone, label: "Telecalling", description: "Voice AI operator", path: "/dashboard/telecalling", color: "bg-destructive/10 text-destructive", roles: ["super_admin", "institution_admin"] },
      { icon: Shield, label: "Super Admin", description: "System management", path: "/dashboard/admin", color: "bg-destructive/10 text-destructive", roles: ["super_admin"] },
    ],
  },
];

const recentActivity = [
  { name: "Priya Sharma", action: "accepted a mentorship request", time: "2m ago", initials: "PS" },
  { name: "Arjun Mehta", action: "posted a job at Google", time: "15m ago", initials: "AM" },
  { name: "Sarah Chen", action: "joined the AI/ML community", time: "1h ago", initials: "SC" },
  { name: "Rahul Verma", action: "referred a student for internship", time: "2h ago", initials: "RV" },
  { name: "Maya Patel", action: "completed profile verification", time: "3h ago", initials: "MP" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const } }),
};

export default function DashboardOverview() {
  const { user } = useAuth();
  const [userRoles, setUserRoles] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id)
      .then(({ data }) => {
        if (data) setUserRoles(data.map(r => r.role));
      });
  }, [user]);

  const isSuperAdmin = userRoles.includes("super_admin");

  const isVisible = (feature: FeatureLink) => {
    if (!feature.roles) return true;
    if (isSuperAdmin) return true;
    return feature.roles.some(r => userRoles.includes(r));
  };

  const primaryRole = isSuperAdmin ? "Super Admin"
    : userRoles.includes("institution_admin") ? "Institution Admin"
    : userRoles.includes("moderator") ? "Moderator"
    : userRoles.includes("student") ? "Student"
    : "Alumni";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Welcome back! Here's your platform overview.</p>
        </div>
        <Badge variant="outline" className="text-xs">{primaryRole}</Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((s, i) => (
          <motion.div
            key={s.label}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={i}
            className="bg-card border border-border rounded-xl p-5 shadow-card"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <s.icon className="h-5 w-5 text-accent" />
              </div>
              <span className={`flex items-center gap-1 text-xs font-medium ${s.up ? "text-success" : "text-destructive"}`}>
                {s.up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                {s.change}
              </span>
            </div>
            <div className="text-2xl font-heading font-bold text-card-foreground">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Feature Categories */}
      {featureCategories.map((category, catIdx) => {
        const visibleFeatures = category.features.filter(isVisible);
        if (visibleFeatures.length === 0) return null;

        return (
          <motion.div
            key={category.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + catIdx * 0.1 }}
          >
            <h2 className="font-heading font-semibold text-foreground text-sm mb-3 uppercase tracking-wider text-muted-foreground">
              {category.title}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {visibleFeatures.map((feature) => (
                <Link
                  key={feature.path}
                  to={feature.path}
                  className="bg-card border border-border rounded-xl p-4 shadow-card hover:border-accent/30 hover:shadow-md transition-all group"
                >
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${feature.color} mb-3 group-hover:scale-110 transition-transform`}>
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-card-foreground truncate">{feature.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{feature.description}</p>
                </Link>
              ))}
            </div>
          </motion.div>
        );
      })}

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-card border border-border rounded-xl p-6 shadow-card"
      >
        <h2 className="font-heading font-semibold text-card-foreground mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {recentActivity.map((a) => (
            <div key={a.name + a.time} className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-accent">{a.initials}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-card-foreground">
                  <span className="font-medium">{a.name}</span>{" "}
                  <span className="text-muted-foreground">{a.action}</span>
                </p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{a.time}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
