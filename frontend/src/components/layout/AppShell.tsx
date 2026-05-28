import { Link, NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, MessageSquare, Sparkles, UtensilsCrossed, LogIn, LogOut } from "lucide-react";
import { TenantSwitcher } from "./TenantSwitcher";
import { useAuth, signOut } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useTenantStore } from "@/stores/tenant";

const primaryLinks = [
  { to: "/", icon: UtensilsCrossed, label: "Home" },
  { to: "/demo", icon: Sparkles, label: "Demo Gen" },
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
];

export function AppShell() {
  const { isAuthed } = useAuth();
  const currentSlug = useTenantStore((s) => s.currentSlug);

  return (
    <div className="flex min-h-screen flex-col bg-ink-50 dark:bg-ink-950">
      <header className="sticky top-0 z-20 border-b border-ink-200/70 bg-white/80 backdrop-blur dark:border-ink-800/70 dark:bg-ink-900/70">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-900 text-white dark:bg-white dark:text-ink-900">
              <svg viewBox="0 0 32 32" className="h-5 w-5">
                <path d="M8 11h16M8 16h16M8 21h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
              </svg>
            </div>
            <span className="text-base font-semibold tracking-tight text-ink-900 dark:text-ink-100">TableAI</span>
          </Link>

          <nav className="ml-6 hidden items-center gap-1 md:flex">
            {primaryLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-ink-100 text-ink-900 dark:bg-ink-800 dark:text-ink-100"
                      : "text-ink-600 hover:bg-ink-50 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100",
                  )
                }
              >
                <l.icon className="h-4 w-4" />
                {l.label}
              </NavLink>
            ))}
            {currentSlug && (
              <NavLink
                to={`/c/${currentSlug}`}
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-ink-100 text-ink-900 dark:bg-ink-800 dark:text-ink-100"
                      : "text-ink-600 hover:bg-ink-50 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100",
                  )
                }
              >
                <MessageSquare className="h-4 w-4" />
                Chat
              </NavLink>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <TenantSwitcher compact />
            {isAuthed ? (
              <Button size="sm" variant="ghost" onClick={() => signOut()} title="Sign out">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            ) : (
              <Link to="/login">
                <Button size="sm" variant="secondary">
                  <LogIn className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign in</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <nav className="sticky bottom-0 z-20 border-t border-ink-200 bg-white/95 backdrop-blur md:hidden dark:border-ink-800 dark:bg-ink-900/95">
        <div className="grid grid-cols-4">
          {[
            { to: "/", icon: UtensilsCrossed, label: "Home" },
            { to: currentSlug ? `/m/${currentSlug}` : "/", icon: UtensilsCrossed, label: "Menu" },
            { to: currentSlug ? `/c/${currentSlug}` : "/", icon: MessageSquare, label: "Chat" },
            { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
          ].map((l, i) => (
            <NavLink
              key={i}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium",
                  isActive ? "text-ink-900 dark:text-ink-100" : "text-ink-500",
                )
              }
            >
              <l.icon className="h-5 w-5" />
              {l.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
