import { Navigate, useLocation } from "react-router-dom";
import type { Role } from "@/stores/auth";
import { useAuth } from "@/hooks/useAuth";
import { supabaseConfigured } from "@/lib/env";
import { Spinner } from "@/components/ui/Spinner";

interface Props {
  roles: Role[];
  children: React.ReactNode;
  /** If specified, also require the caller can access this tenant slug. Owners only — admins/employees bypass. */
  tenantSlug?: string;
}

export function RequireRole({ roles, children, tenantSlug }: Props) {
  const { ready, isAuthed, profile, profileLoading } = useAuth();
  const location = useLocation();

  // When Supabase isn't configured (very first run), let everything through.
  if (!supabaseConfigured) return <>{children}</>;

  if (!ready || profileLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner className="h-6 w-6 text-ink-400" />
      </div>
    );
  }

  if (!isAuthed) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (!profile) {
    // Session exists but profile fetch failed — show a soft error screen.
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm text-ink-500">Couldn't load your profile. Try signing out and back in.</p>
      </div>
    );
  }

  if (!roles.includes(profile.role)) {
    // Route them to the home they're allowed in.
    const home = profile.role === "owner" ? "/dashboard" : "/admin";
    return <Navigate to={home} replace />;
  }

  if (tenantSlug && profile.role === "owner") {
    const allowed = profile.tenants.some((t) => t.slug === tenantSlug);
    if (!allowed) return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
