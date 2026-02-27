import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import RoleGuard from "@/components/RoleGuard";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import DashboardLayout from "./components/DashboardLayout";
import DashboardOverview from "./pages/DashboardOverview";
import AlumniDirectory from "./pages/AlumniDirectory";
import SocialFeedV2 from "./pages/SocialFeedV2";
import EventsPage from "./pages/EventsPage";
import OpportunitiesPage from "./pages/OpportunitiesPage";
import AIAssistant from "./pages/AIAssistant";
import SkillGapAnalyzer from "./pages/SkillGapAnalyzer";
import ProfilePage from "./pages/ProfilePage";
import LeaderboardPage from "./pages/LeaderboardPage";
import NetworkGraph from "./pages/NetworkGraph";
import NotificationsPage from "./pages/NotificationsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import MessagesPage from "./pages/MessagesPage";
import InstitutionBranding from "./pages/InstitutionBranding";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import ApiDocsPage from "./pages/ApiDocsPage";
import VerificationPage from "./pages/VerificationPage";
import ImpactDashboard from "./pages/ImpactDashboard";
import MentorshipPage from "./pages/MentorshipPage";
import MentorDashboard from "./pages/MentorDashboard";
import CareerPathPage from "./pages/CareerPathPage";
import SuccessStoriesPage from "./pages/SuccessStoriesPage";
import FundraisingPage from "./pages/FundraisingPage";
import CareerForumPage from "./pages/CareerForumPage";
import GlobalAlumniMap from "./pages/GlobalAlumniMap";
import AdminAnalyticsPage from "./pages/AdminAnalyticsPage";
import MailingCampaignsPage from "./pages/MailingCampaignsPage";
import SettingsPage from "./pages/SettingsPage";
import TelecallingDashboard from "./pages/TelecallingDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen bg-background"><div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function DashPage({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute><DashboardLayout>{children}</DashboardLayout></ProtectedRoute>;
}

function GuardedDashPage({ children, roles }: { children: React.ReactNode; roles: string[] }) {
  return (
    <DashPage>
      <RoleGuard allowedRoles={roles}>{children}</RoleGuard>
    </DashPage>
  );
}

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/api-docs" element={<ApiDocsPage />} />
    <Route path="/auth" element={<AuthPage />} />

    {/* Open to all authenticated users */}
    <Route path="/dashboard" element={<DashPage><DashboardOverview /></DashPage>} />
    <Route path="/dashboard/directory" element={<DashPage><AlumniDirectory /></DashPage>} />
    <Route path="/dashboard/feed" element={<DashPage><SocialFeedV2 /></DashPage>} />
    <Route path="/dashboard/messages" element={<DashPage><MessagesPage /></DashPage>} />
    <Route path="/dashboard/events" element={<DashPage><EventsPage /></DashPage>} />
    <Route path="/dashboard/opportunities" element={<DashPage><OpportunitiesPage /></DashPage>} />
    <Route path="/dashboard/ai" element={<DashPage><AIAssistant /></DashPage>} />
    <Route path="/dashboard/profile" element={<DashPage><ProfilePage /></DashPage>} />
    <Route path="/dashboard/leaderboard" element={<DashPage><LeaderboardPage /></DashPage>} />
    <Route path="/dashboard/network" element={<DashPage><NetworkGraph /></DashPage>} />
    <Route path="/dashboard/notifications" element={<DashPage><NotificationsPage /></DashPage>} />
    <Route path="/dashboard/mentorship" element={<DashPage><MentorshipPage /></DashPage>} />
    <Route path="/dashboard/stories" element={<DashPage><SuccessStoriesPage /></DashPage>} />
    <Route path="/dashboard/forum" element={<DashPage><CareerForumPage /></DashPage>} />
    <Route path="/dashboard/global-map" element={<DashPage><GlobalAlumniMap /></DashPage>} />
    <Route path="/dashboard/analytics" element={<DashPage><AnalyticsPage /></DashPage>} />
    <Route path="/dashboard/settings" element={<DashPage><SettingsPage /></DashPage>} />

    {/* Role-restricted routes */}
    <Route path="/dashboard/skill-gap" element={<GuardedDashPage roles={["alumni", "student"]}><SkillGapAnalyzer /></GuardedDashPage>} />
    <Route path="/dashboard/career-path" element={<GuardedDashPage roles={["alumni", "student"]}><CareerPathPage /></GuardedDashPage>} />
    <Route path="/dashboard/mentor-dashboard" element={<GuardedDashPage roles={["alumni", "moderator", "institution_admin"]}><MentorDashboard /></GuardedDashPage>} />
    <Route path="/dashboard/fundraising" element={<GuardedDashPage roles={["alumni", "institution_admin"]}><FundraisingPage /></GuardedDashPage>} />
    <Route path="/dashboard/admin-analytics" element={<GuardedDashPage roles={["institution_admin"]}><AdminAnalyticsPage /></GuardedDashPage>} />
    <Route path="/dashboard/campaigns" element={<GuardedDashPage roles={["institution_admin"]}><MailingCampaignsPage /></GuardedDashPage>} />
    <Route path="/dashboard/impact" element={<GuardedDashPage roles={["moderator", "institution_admin"]}><ImpactDashboard /></GuardedDashPage>} />
    <Route path="/dashboard/verification" element={<GuardedDashPage roles={["moderator", "institution_admin"]}><VerificationPage /></GuardedDashPage>} />
    <Route path="/dashboard/branding" element={<GuardedDashPage roles={["institution_admin"]}><InstitutionBranding /></GuardedDashPage>} />
    <Route path="/dashboard/admin" element={<GuardedDashPage roles={["super_admin"]}><SuperAdminDashboard /></GuardedDashPage>} />
    <Route path="/dashboard/telecalling" element={<GuardedDashPage roles={["super_admin", "institution_admin"]}><TelecallingDashboard /></GuardedDashPage>} />

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
