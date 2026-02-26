import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, MessageSquare, Calendar, Briefcase, Brain,
  BarChart3, Settings, Sparkles, ChevronLeft, Bell, Search, LogOut,
  Target, Trophy, Share2, User, Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";

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
  { icon: Settings, label: "Settings", path: "/dashboard/settings" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

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
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent" />
            </Button>
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
