import { useEffect, useState, ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Loader2 } from "lucide-react";

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: string[];
}

export default function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const [userRoles, setUserRoles] = useState<string[] | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        setUserRoles(data?.map((r) => r.role) || []);
      });
  }, [user]);

  if (authLoading || userRoles === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  // Super admins can access everything
  if (userRoles.includes("super_admin")) {
    return <>{children}</>;
  }

  const hasAccess = allowedRoles.some((r) => userRoles.includes(r));

  if (!hasAccess) {
    return (
      <div className="text-center py-20">
        <Shield className="h-12 w-12 text-destructive/30 mx-auto mb-4" />
        <h2 className="text-lg font-heading font-semibold text-foreground">Access Denied</h2>
        <p className="text-sm text-muted-foreground mt-1">You don't have permission to access this page.</p>
      </div>
    );
  }

  return <>{children}</>;
}
