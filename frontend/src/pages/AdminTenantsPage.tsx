import { useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, MessageSquare, Plus, Search, Sparkles, UserPlus } from "lucide-react";
import { useAdminTenants } from "@/hooks/useAdmin";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatRelativeTime } from "@/lib/format";

export function AdminTenantsPage() {
  const { data, isLoading } = useAdminTenants();
  const [search, setSearch] = useState("");

  const filtered = (data ?? []).filter((t) =>
    !search.trim()
      ? true
      : (t.name + " " + t.slug + " " + (t.source_url || "") + " " + t.owners.map((o) => o.email).join(" "))
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-100">Tenants</h1>
          <p className="mt-1 text-sm text-ink-500">All businesses running on TableAI.</p>
        </div>
        <Link to="/demo">
          <Button>
            <Sparkles className="h-4 w-4" />
            Generate new demo
          </Button>
        </Link>
      </div>

      <div className="mb-4 relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Search by name, slug, owner email, or URL…" />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={data?.length ? "No matches" : "No tenants yet"}
          description={data?.length ? "Try a different search." : "Paste a URL in the demo generator to create your first tenant."}
          action={
            !data?.length ? (
              <Link to="/demo"><Button><Plus className="h-4 w-4" />Generate demo</Button></Link>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <CardBody className="p-0">
            <div className="divide-y divide-ink-100 dark:divide-ink-800">
              {filtered.map((t) => (
                <Link
                  key={t.id}
                  to={`/admin/tenants/${t.slug}`}
                  className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-ink-50 dark:hover:bg-ink-800/50"
                >
                  <div className="flex min-w-[220px] flex-1 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white text-sm font-bold">
                      {t.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="truncate font-semibold text-ink-900 dark:text-ink-100">{t.name}</div>
                        <Badge tone={t.status === "active" ? "success" : t.status === "demo" ? "brand" : "neutral"} className="capitalize">
                          {t.status}
                        </Badge>
                      </div>
                      <div className="truncate text-xs text-ink-500 capitalize">
                        {t.business_type} · /{t.slug} · {formatRelativeTime(t.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-ink-500">
                    {t.owners.length > 0 ? (
                      <span>👤 {t.owners[0].email}{t.owners.length > 1 ? ` +${t.owners.length - 1}` : ""}</span>
                    ) : (
                      <Badge tone="warning"><UserPlus className="h-3 w-3" /> No owner</Badge>
                    )}
                    <Link to={`/m/${t.slug}`} className="text-ink-500 hover:text-ink-900" onClick={(e) => e.stopPropagation()} title="Public menu">
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                    <Link to={`/c/${t.slug}`} className="text-ink-500 hover:text-ink-900" onClick={(e) => e.stopPropagation()} title="Chat">
                      <MessageSquare className="h-4 w-4" />
                    </Link>
                  </div>
                </Link>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
