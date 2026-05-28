import { NavLink, Outlet, Link } from "react-router-dom";
import { BarChart3, MessageSquare, Settings, UtensilsCrossed, Sparkles, ExternalLink } from "lucide-react";
import { useTenantStore } from "@/stores/tenant";
import { useTenants } from "@/hooks/useTenants";
import { cn } from "@/lib/cn";
import { TenantSwitcher } from "@/components/layout/TenantSwitcher";

const dashboardLinks = [
  { to: "/dashboard", icon: BarChart3, label: "Overview", end: true },
  { to: "/dashboard/conversations", icon: MessageSquare, label: "Conversations" },
  { to: "/dashboard/menu", icon: UtensilsCrossed, label: "Menu" },
  { to: "/dashboard/settings", icon: Settings, label: "Settings" },
];

interface Props {
  children: React.ReactNode;
}

export function DashboardShell({ children }: Props) {
  const currentSlug = useTenantStore((s) => s.currentSlug);
  const { data: tenants } = useTenants();
  const active = tenants?.find((t) => t.slug === currentSlug) ?? tenants?.[0];

  return (
    <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:py-8">
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-20 space-y-1">
          <div className="mb-3 px-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Tenant</div>
            <div className="mt-2">
              <TenantSwitcher />
            </div>
            {active && (
              <Link
                to={`/m/${active.slug}`}
                className="mt-2 inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-900 dark:hover:text-ink-200"
              >
                View public menu
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
          <div className="h-px bg-ink-100 dark:bg-ink-800" />
          <nav className="mt-3 space-y-1">
            {dashboardLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-ink-900 text-white dark:bg-white dark:text-ink-900"
                      : "text-ink-700 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800",
                  )
                }
              >
                <l.icon className="h-4 w-4" />
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-6 rounded-xl border border-dashed border-ink-200 bg-white p-3 dark:border-ink-700 dark:bg-ink-800/40">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-500" />
              <div className="text-xs font-semibold text-ink-700 dark:text-ink-200">Generate a demo</div>
            </div>
            <p className="mt-1 text-xs text-ink-500">Paste a URL → tenant ready in ~30s.</p>
            <Link
              to="/demo"
              className="mt-2 inline-block text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Open generator →
            </Link>
          </div>
        </div>
      </aside>
      <section className="min-w-0 flex-1">
        <div className="mb-4 flex items-center gap-2 lg:hidden">
          <TenantSwitcher compact />
        </div>
        <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-ink-100 p-1 lg:hidden dark:bg-ink-800">
          {dashboardLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                cn(
                  "flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-center text-sm font-medium transition-colors",
                  isActive
                    ? "bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-ink-100"
                    : "text-ink-600 hover:text-ink-900 dark:text-ink-400",
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>
        {children}
      </section>
    </div>
  );
}

export function DashboardLayout() {
  return (
    <DashboardShell>
      <Outlet />
    </DashboardShell>
  );
}
