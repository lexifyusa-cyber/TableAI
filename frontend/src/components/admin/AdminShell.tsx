import { NavLink, Outlet, Link } from "react-router-dom";
import { BarChart3, KeyRound, LayoutGrid, Plug, Settings, Users, Sparkles, LogOut } from "lucide-react";
import { cn } from "@/lib/cn";
import { useAuth, signOut } from "@/hooks/useAuth";

const links = [
  { to: "/admin", icon: LayoutGrid, label: "Tenants", end: true },
  { to: "/admin/users", icon: Users, label: "Users", adminOnly: true },
  { to: "/admin/providers", icon: KeyRound, label: "Providers", adminOnly: true },
  { to: "/admin/models", icon: Settings, label: "Models", adminOnly: true },
  { to: "/admin/integrations", icon: Plug, label: "Integrations", adminOnly: true },
  { to: "/admin/metrics", icon: BarChart3, label: "Metrics", soon: true },
];

export function AdminShell() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  return (
    <div className="mx-auto flex w-full max-w-[1400px] gap-6 px-4 py-6 sm:px-6 lg:py-8">
      <aside className="hidden w-60 shrink-0 lg:block">
        <div className="sticky top-20 space-y-1">
          <div className="mb-4 rounded-xl bg-ink-900 px-4 py-3 text-white dark:bg-ink-800">
            <div className="text-xs uppercase tracking-wider text-ink-400">Signed in as</div>
            <div className="mt-0.5 truncate text-sm font-semibold">{profile?.email}</div>
            <div className="mt-0.5 text-xs uppercase text-brand-400 tracking-wide">{profile?.role}</div>
          </div>
          <nav className="space-y-1">
            {links.map((l) => {
              if (l.adminOnly && !isAdmin) return null;
              const disabled = !!l.soon;
              const inner = (
                <>
                  <l.icon className="h-4 w-4" />
                  {l.label}
                  {l.soon && <span className="ml-auto text-[10px] uppercase text-ink-500">soon</span>}
                </>
              );
              if (disabled) {
                return (
                  <div
                    key={l.to}
                    className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-400"
                  >
                    {inner}
                  </div>
                );
              }
              return (
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
                  {inner}
                </NavLink>
              );
            })}
          </nav>
          <div className="mt-6 rounded-xl border border-dashed border-ink-200 bg-white p-3 dark:border-ink-700 dark:bg-ink-800/40">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-500" />
              <div className="text-xs font-semibold text-ink-700 dark:text-ink-200">New demo</div>
            </div>
            <p className="mt-1 text-xs text-ink-500">URL → tenant in ~30s.</p>
            <Link to="/demo" className="mt-2 inline-block text-xs font-medium text-brand-600 hover:text-brand-700">
              Open generator →
            </Link>
          </div>
          <button
            onClick={signOut}
            className="mt-4 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <section className="min-w-0 flex-1">
        {/* Mobile nav pills */}
        <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-ink-100 p-1 lg:hidden dark:bg-ink-800">
          {links.map((l) => {
            if (l.adminOnly && !isAdmin) return null;
            if (l.soon) return null;
            return (
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
            );
          })}
        </div>
        <Outlet />
      </section>
    </div>
  );
}
