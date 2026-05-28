import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, ChevronDown, Plus, Store } from "lucide-react";
import { cn } from "@/lib/cn";
import { useTenants } from "@/hooks/useTenants";
import { useTenantStore } from "@/stores/tenant";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/Spinner";

interface Props {
  compact?: boolean;
}

export function TenantSwitcher({ compact }: Props) {
  const { role, tenants: ownTenants, isAuthed } = useAuth();
  const { data: allTenants, isLoading } = useTenants();
  const currentSlug = useTenantStore((s) => s.currentSlug);
  const setSlug = useTenantStore((s) => s.setSlug);
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  // Owners see only their tenants; admin/employee see all; unauthenticated sees nothing.
  const tenants = role === "owner"
    ? ownTenants.map((t) => ({
        id: t.slug, slug: t.slug, name: t.name,
        business_type: t.business_type,
        brand: {}, contact: {}, hours: {},
      }))
    : (isAuthed ? allTenants : []) ?? [];

  const active = tenants.find((t) => t.slug === currentSlug) ?? tenants[0];

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const pick = (slug: string) => {
    setSlug(slug);
    setOpen(false);
    nav(`/m/${slug}`);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-800 shadow-sm hover:bg-ink-50",
          "dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100 dark:hover:bg-ink-700",
          compact && "h-9 px-2.5",
        )}
      >
        <Store className="h-4 w-4 text-ink-500" />
        {isLoading ? (
          <Spinner className="h-3.5 w-3.5" />
        ) : (
          <span className="max-w-[140px] truncate">{active?.name ?? "Select tenant"}</span>
        )}
        <ChevronDown className="h-4 w-4 text-ink-400" />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-xl dark:border-ink-700 dark:bg-ink-900">
          <div className="max-h-80 overflow-y-auto py-1">
            {tenants && tenants.length > 0 ? (
              tenants.map((t) => (
                <button
                  key={t.id}
                  onClick={() => pick(t.slug)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-ink-50 dark:hover:bg-ink-800"
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-white text-xs font-bold"
                    style={{ backgroundColor: (t.brand as any)?.primary_color || "#f97316" }}
                  >
                    {t.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">{t.name}</div>
                    <div className="truncate text-xs text-ink-500">
                      {t.business_type} · /{t.slug}
                    </div>
                  </div>
                  {t.slug === currentSlug && <Check className="h-4 w-4 text-brand-600" />}
                </button>
              ))
            ) : (
              <div className="px-3 py-6 text-center text-sm text-ink-500">No tenants yet.</div>
            )}
          </div>
          <Link
            to="/demo"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 border-t border-ink-100 bg-ink-50 px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-100 dark:border-ink-800 dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-ink-700"
          >
            <Plus className="h-4 w-4" />
            Generate new demo
          </Link>
        </div>
      )}
    </div>
  );
}
