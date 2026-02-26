import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, CheckCheck, Brain, Users, Calendar, Briefcase, MessageSquare, X, Loader2, Mail, Megaphone, Heart, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const typeIcons: Record<string, typeof Bell> = {
  mentorship: Heart, referral: Briefcase, event: Calendar, ai: Brain, message: MessageSquare,
  campaign: Mail, opportunity: TrendingUp, general: Bell,
};

const typeColors: Record<string, string> = {
  mentorship: "bg-info/10 text-info", referral: "bg-success/10 text-success", event: "bg-accent/10 text-accent",
  ai: "bg-primary/10 text-primary", message: "bg-warning/10 text-warning", campaign: "bg-info/10 text-info",
  opportunity: "bg-success/10 text-success", general: "bg-muted text-muted-foreground",
};

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setNotifications(data.map((n) => ({ ...n, is_read: n.is_read ?? false })));
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => { setNotifications((prev) => [{ ...payload.new as Notification, is_read: (payload.new as any).is_read ?? false }, ...prev]); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const dismiss = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const filtered = notifications.filter((n) => filter === "all" || (filter === "unread" && !n.is_read) || n.type === filter);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const filters = [
    { key: "all", label: "All" },
    { key: "unread", label: `Unread (${unreadCount})` },
    { key: "mentorship", label: "Mentorship" },
    { key: "referral", label: "Referrals" },
    { key: "event", label: "Events" },
    { key: "opportunity", label: "Jobs" },
    { key: "campaign", label: "Campaigns" },
    { key: "message", label: "Messages" },
    { key: "ai", label: "AI" },
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Bell className="h-6 w-6 text-accent" /> Notifications
            {unreadCount > 0 && <Badge className="bg-accent text-accent-foreground text-xs ml-1">{unreadCount}</Badge>}
          </h1>
          <p className="text-muted-foreground text-sm">Real-time updates on your alumni network activity</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}><CheckCheck className="h-4 w-4" /> Mark all read</Button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <Button key={f.key} variant={filter === f.key ? "default" : "outline"} size="sm" onClick={() => setFilter(f.key)}>{f.label}</Button>
        ))}
      </div>

      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {filtered.map((n, i) => {
            const Icon = typeIcons[n.type] || Bell;
            return (
              <motion.div key={n.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -100 }} transition={{ delay: i * 0.03 }}
                onClick={() => { if (!n.is_read) markRead(n.id); if (n.link) navigate(n.link); }}
                className={`bg-card border rounded-xl p-4 shadow-card flex items-start gap-3 transition-colors cursor-pointer hover:bg-secondary/50 ${n.is_read ? "border-border" : "border-accent/30 bg-accent/[0.02]"}`}>
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${typeColors[n.type] || typeColors.general}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`text-sm font-heading truncate ${n.is_read ? "text-card-foreground" : "font-semibold text-card-foreground"}`}>{n.title}</h3>
                    {!n.is_read && <span className="h-2 w-2 rounded-full bg-accent shrink-0" />}
                    <Badge variant="outline" className="text-[10px] ml-auto shrink-0">{n.type}</Badge>
                  </div>
                  {n.message && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">{timeAgo(n.created_at)}</span>
                    {n.link && <span className="text-[10px] text-accent">View →</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {!n.is_read && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => markRead(n.id)}><Check className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => dismiss(n.id)}><X className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Bell className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{loading ? "Loading..." : "No notifications"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
