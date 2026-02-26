import { ReactNode, useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, MessageSquare, Calendar, Briefcase, Brain,
  BarChart3, Settings, Sparkles, ChevronLeft, Bell, Search, LogOut,
  Target, Trophy, Share2, User, Send, Palette, Shield, Check, X, BellRing,
  ShieldCheck, Award
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useBrowserNotifications } from "@/hooks/useBrowserNotifications";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Users, label: "Directory", path: "/dashboard/directory" },
  { icon: MessageSquare, label: "Feed", path: "/dashboard/feed" },
  { icon: Send, label: "Messages", path: "/dashboard/messages" },
  { icon: Calendar, label: "Events", path: "/dashboard/events" },
  { icon: Briefcase, label: "Opportunities", path: "/dashboard/opportunities" },
  { icon: Brain, label: "AI Assistant", path: "/dashboard/ai" },
  { icon: Target, label: "Skill Gap", path: "/dashboard/skill-gap" },
  { icon: Trophy, label: "Leaderboard", path: "/dashboard/leaderboard" },
  { icon: Share2, label: "Network Graph", path: "/dashboard/network" },
  { icon: Bell, label: "Notifications", path: "/dashboard/notifications" },
  { icon: User, label: "My Profile", path: "/dashboard/profile" },
  { icon: BarChart3, label: "Analytics", path: "/dashboard/analytics" },
  { icon: Award, label: "Impact", path: "/dashboard/impact" },
  { icon: ShieldCheck, label: "Verification", path: "/dashboard/verification" },
  { icon: Palette, label: "Branding", path: "/dashboard/branding" },
  { icon: Shield, label: "Super Admin", path: "/dashboard/admin" },
  { icon: Settings, label: "Settings", path: "/dashboard/settings" },
];

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
  link: string | null;
}

const typeIcons: Record<string, typeof Bell> = {
  mentorship: Users, referral: Briefcase, event: Calendar, ai: Brain, message: MessageSquare, general: Bell,
};

const typeColors: Record<string, string> = {
  mentorship: "bg-info/10 text-info", referral: "bg-success/10 text-success", event: "bg-accent/10 text-accent",
  ai: "bg-primary/10 text-primary", message: "bg-warning/10 text-warning", general: "bg-muted text-muted-foreground",
};

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { requestPermission, supported: notifSupported } = useBrowserNotifications();

  // Prompt for browser notification permission on first load
  useEffect(() => {
    if (notifSupported && Notification.permission === "default") {
      // Delay slightly so it doesn't feel intrusive
      const t = setTimeout(() => requestPermission(), 5000);
      return () => clearTimeout(t);
    }
  }, [notifSupported]);

  // Fetch notifications
  useEffect(() => {
    if (!user) return;
    const fetchNotifs = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(8);
      if (data) {
        setNotifications(data.map((n) => ({ ...n, is_read: n.is_read ?? false })));
        setUnreadCount(data.filter((n) => !n.is_read).length);
      }
    };
    fetchNotifs();

    // Also get total unread count
    supabase.from("notifications").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).eq("is_read", false)
      .then(({ count }) => { if (count !== null) setUnreadCount(count); });

    // Realtime
    const ch = supabase.channel("topbar-notifs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as Notification;
          setNotifications((prev) => [{ ...n, is_read: n.is_read ?? false }, ...prev.slice(0, 7)]);
          setUnreadCount((c) => c + 1);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowNotifDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        "flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 shrink-0",
        collapsed ? "w-[72px]" : "w-64"
      )}>
        <div className="flex items-center gap-2 h-16 px-4 border-b border-sidebar-border">
          <Sparkles className="h-6 w-6 text-sidebar-primary shrink-0" />
          {!collapsed && <span className="font-heading font-bold text-sidebar-foreground text-lg truncate">AlumniOS</span>}
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-2 border-t border-sidebar-border">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
          >
            <ChevronLeft className={cn("h-5 w-5 shrink-0 transition-transform", collapsed && "rotate-180")} />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3 bg-secondary rounded-lg px-3 py-2 w-80">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search alumni, events, opportunities..."
              className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
            />
          </div>
          <div className="flex items-center gap-3">
            {/* Notification Bell with Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
              >
                <Bell className="h-5 w-5 text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>

              {showNotifDropdown && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <h3 className="font-heading font-semibold text-card-foreground text-sm">Notifications</h3>
                    {unreadCount > 0 && (
                      <Badge className="bg-accent text-accent-foreground text-[10px]">{unreadCount} new</Badge>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="text-center py-8">
                        <Bell className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">No notifications yet</p>
                      </div>
                    ) : (
                      notifications.map((n) => {
                        const Icon = typeIcons[n.type] || Bell;
                        return (
                          <div
                            key={n.id}
                            className={cn(
                              "flex items-start gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors cursor-pointer border-b border-border last:border-0",
                              !n.is_read && "bg-accent/[0.03]"
                            )}
                            onClick={() => {
                              if (!n.is_read) markRead(n.id);
                              if (n.link) { navigate(n.link); setShowNotifDropdown(false); }
                            }}
                          >
                            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", typeColors[n.type] || typeColors.general)}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className={cn("text-xs truncate", !n.is_read ? "font-semibold text-card-foreground" : "text-card-foreground")}>{n.title}</p>
                                {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />}
                              </div>
                              {n.message && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{n.message}</p>}
                              <span className="text-[10px] text-muted-foreground">{timeAgo(n.created_at)}</span>
                            </div>
                            {!n.is_read && (
                              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={(e) => { e.stopPropagation(); markRead(n.id); }}>
                                <Check className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="border-t border-border p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-accent"
                      onClick={() => { navigate("/dashboard/notifications"); setShowNotifDropdown(false); }}
                    >
                      View all notifications
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-accent text-accent-foreground font-heading text-sm">
                {user?.email?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
