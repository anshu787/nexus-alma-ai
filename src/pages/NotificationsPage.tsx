import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, CheckCheck, Brain, Users, Calendar, Briefcase, MessageSquare, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  mentorship: Users,
  referral: Briefcase,
  event: Calendar,
  ai: Brain,
  message: MessageSquare,
  general: Bell,
};

const typeColors: Record<string, string> = {
  mentorship: "bg-info/10 text-info",
  referral: "bg-success/10 text-success",
  event: "bg-accent/10 text-accent",
  ai: "bg-primary/10 text-primary",
  message: "bg-warning/10 text-warning",
  general: "bg-muted text-muted-foreground",
};

// Mock notifications for demo (until real ones are generated)
const mockNotifications: Notification[] = [
  { id: "1", type: "mentorship", title: "New Mentorship Request", message: "Ravi Kumar wants you to mentor them in Data Science", link: null, is_read: false, created_at: new Date(Date.now() - 5 * 60000).toISOString() },
  { id: "2", type: "referral", title: "Referral Approved", message: "Arjun Mehta approved your referral request for Microsoft", link: "/dashboard/opportunities", is_read: false, created_at: new Date(Date.now() - 30 * 60000).toISOString() },
  { id: "3", type: "event", title: "Event Reminder", message: "AI/ML Alumni Meetup starts in 2 hours", link: "/dashboard/events", is_read: false, created_at: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: "4", type: "ai", title: "AI Recommendation", message: "Based on your skills, we found 3 new job opportunities matching your profile", link: "/dashboard/opportunities", is_read: true, created_at: new Date(Date.now() - 5 * 3600000).toISOString() },
  { id: "5", type: "message", title: "New Message", message: "Priya Sharma sent you a message", link: "/dashboard/messages", is_read: true, created_at: new Date(Date.now() - 8 * 3600000).toISOString() },
  { id: "6", type: "mentorship", title: "Mentorship Session Complete", message: "Your session with Maya Patel has been recorded. Engagement +50 points!", link: "/dashboard/leaderboard", is_read: true, created_at: new Date(Date.now() - 24 * 3600000).toISOString() },
  { id: "7", type: "ai", title: "Skill Gap Alert", message: "New trending skill 'LLM Fine-tuning' detected in your industry. Consider adding it to your profile.", link: "/dashboard/skill-gap", is_read: true, created_at: new Date(Date.now() - 48 * 3600000).toISOString() },
];

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [filter, setFilter] = useState<string>("all");

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications((prev) => [newNotif, ...prev]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = () => {
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
    { key: "ai", label: "AI" },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Bell className="h-6 w-6 text-accent" /> Notifications
            {unreadCount > 0 && (
              <Badge className="bg-accent text-accent-foreground text-xs ml-1">{unreadCount}</Badge>
            )}
          </h1>
          <p className="text-muted-foreground text-sm">Real-time updates on your alumni network activity</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? "hero" : "outline"}
            size="sm"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Notification list */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {filtered.map((n, i) => {
            const Icon = typeIcons[n.type] || Bell;
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ delay: i * 0.03 }}
                className={`bg-card border rounded-xl p-4 shadow-card flex items-start gap-3 transition-colors ${
                  n.is_read ? "border-border" : "border-accent/30 bg-accent/[0.02]"
                }`}
              >
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${typeColors[n.type] || typeColors.general}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`text-sm font-heading truncate ${n.is_read ? "text-card-foreground" : "font-semibold text-card-foreground"}`}>
                      {n.title}
                    </h3>
                    {!n.is_read && <span className="h-2 w-2 rounded-full bg-accent shrink-0" />}
                  </div>
                  {n.message && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>}
                  <span className="text-[10px] text-muted-foreground mt-1 block">{timeAgo(n.created_at)}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!n.is_read && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => markRead(n.id)}>
                      <Check className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => dismiss(n.id)}>
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Bell className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No notifications</p>
          </div>
        )}
      </div>
    </div>
  );
}
