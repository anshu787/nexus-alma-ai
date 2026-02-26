import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import DashboardLayout from "./components/DashboardLayout";
import DashboardOverview from "./pages/DashboardOverview";
import AlumniDirectory from "./pages/AlumniDirectory";
import SocialFeed from "./pages/SocialFeed";
import EventsPage from "./pages/EventsPage";
import OpportunitiesPage from "./pages/OpportunitiesPage";
import AIAssistant from "./pages/AIAssistant";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen bg-background"><div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/auth" element={<AuthPage />} />
    <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout><DashboardOverview /></DashboardLayout></ProtectedRoute>} />
    <Route path="/dashboard/directory" element={<ProtectedRoute><DashboardLayout><AlumniDirectory /></DashboardLayout></ProtectedRoute>} />
    <Route path="/dashboard/feed" element={<ProtectedRoute><DashboardLayout><SocialFeed /></DashboardLayout></ProtectedRoute>} />
    <Route path="/dashboard/events" element={<ProtectedRoute><DashboardLayout><EventsPage /></DashboardLayout></ProtectedRoute>} />
    <Route path="/dashboard/opportunities" element={<ProtectedRoute><DashboardLayout><OpportunitiesPage /></DashboardLayout></ProtectedRoute>} />
    <Route path="/dashboard/ai" element={<ProtectedRoute><DashboardLayout><AIAssistant /></DashboardLayout></ProtectedRoute>} />
    <Route path="/dashboard/analytics" element={<ProtectedRoute><DashboardLayout><div className="text-foreground font-heading text-2xl font-bold">Analytics — Coming Soon</div></DashboardLayout></ProtectedRoute>} />
    <Route path="/dashboard/settings" element={<ProtectedRoute><DashboardLayout><div className="text-foreground font-heading text-2xl font-bold">Settings — Coming Soon</div></DashboardLayout></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
