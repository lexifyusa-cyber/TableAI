import { Route, Routes, Navigate, useSearchParams } from "react-router-dom";
import { DevicePreview } from "@/components/dev/DevicePreview";
import { AppShell } from "@/components/layout/AppShell";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAuth, useAuthSync } from "@/hooks/useAuth";
import { HomePage } from "@/pages/HomePage";
import { MenuPage } from "@/pages/MenuPage";
import { ChatPage } from "@/pages/ChatPage";
import { DemoPage } from "@/pages/DemoPage";
import { LoginPage } from "@/pages/LoginPage";
import { InvitePage } from "@/pages/InvitePage";
import { DashboardPage } from "@/pages/DashboardPage";
import { DashboardConversationsPage } from "@/pages/DashboardConversationsPage";
import { DashboardMenuPage } from "@/pages/DashboardMenuPage";
import { TenantSettingsPage } from "@/pages/TenantSettingsPage";
import { OwnerEditPage } from "@/pages/OwnerEditPage";
import { AdminTenantsPage } from "@/pages/AdminTenantsPage";
import { AdminTenantDetailPage } from "@/pages/AdminTenantDetailPage";
import { AdminUsersPage } from "@/pages/AdminUsersPage";
import { AdminProvidersPage } from "@/pages/AdminProvidersPage";
import { AdminModelsPage } from "@/pages/AdminModelsPage";
import { AdminEnrichmentPage } from "@/pages/AdminEnrichmentPage";
import { AdminIntegrationsPage } from "@/pages/AdminIntegrationsPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { RequireRole } from "@/components/RequireRole";

function LegacyTenantRedirect() {
  const [params] = useSearchParams();
  const slug = params.get("tenant");
  if (!slug) return <Navigate to="/" replace />;
  return <Navigate to={`/m/${slug}`} replace />;
}

function PostLoginRedirect() {
  const { ready, profile, isAuthed } = useAuth();
  if (!ready) return null;
  if (!isAuthed || !profile) return <HomePage />;
  if (profile.role === "admin" || profile.role === "employee") {
    return <Navigate to="/admin" replace />;
  }
  if (profile.role === "owner") return <Navigate to="/dashboard" replace />;
  return <HomePage />;
}

export default function App() {
  useAuthSync();

  return (
    <Routes>
      {/* Admin shell — staff only. Must come BEFORE the catch-all AppShell. */}
      <Route
        path="/admin"
        element={
          <RequireRole roles={["admin", "employee"]}>
            <AppShell />
          </RequireRole>
        }
      >
        <Route element={<AdminShell />}>
          <Route index element={<AdminTenantsPage />} />
          <Route path="tenants/:slug" element={<AdminTenantDetailPage />} />
          <Route path="tenants/:slug/enrich" element={<AdminEnrichmentPage />} />
          <Route path="users" element={<RequireRole roles={["admin"]}><AdminUsersPage /></RequireRole>} />
          <Route path="providers" element={<RequireRole roles={["admin"]}><AdminProvidersPage /></RequireRole>} />
          <Route path="models" element={<RequireRole roles={["admin"]}><AdminModelsPage /></RequireRole>} />
          <Route path="integrations" element={<RequireRole roles={["admin"]}><AdminIntegrationsPage /></RequireRole>} />
        </Route>
      </Route>

      {/* Customer-facing public menu — no AppShell so no admin nav clutter. */}
      <Route path="/m/:slug" element={<DevicePreview><MenuPage /></DevicePreview>} />

      {/* Public / customer / owner shell */}
      <Route element={<AppShell />}>
        <Route path="/" element={<PostLoginRedirect />} />
        <Route path="/c/:slug" element={<DevicePreview><ChatPage /></DevicePreview>} />
        <Route path="/demo" element={<RequireRole roles={["admin", "employee"]}><DemoPage /></RequireRole>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/invite" element={<InvitePage />} />
        <Route path="/t" element={<LegacyTenantRedirect />} />

        {/* Owner dashboard — scoped to their tenants */}
        <Route path="/dashboard" element={<RequireRole roles={["admin", "employee", "owner"]}><DashboardPage /></RequireRole>} />
        <Route path="/dashboard/conversations" element={<RequireRole roles={["admin", "employee", "owner"]}><DashboardConversationsPage /></RequireRole>} />
        <Route path="/dashboard/menu" element={<RequireRole roles={["admin", "employee", "owner"]}><DashboardMenuPage /></RequireRole>} />
        <Route path="/dashboard/settings" element={<RequireRole roles={["admin", "employee", "owner"]}><TenantSettingsPage /></RequireRole>} />
        <Route path="/dashboard/edit/:slug" element={<RequireRole roles={["admin", "employee", "owner"]}><OwnerEditPage /></RequireRole>} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}