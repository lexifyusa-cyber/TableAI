import { Link } from "react-router-dom";
import { ArrowUpRight, MessageSquare, Sparkles, TrendingUp, Users } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { StatCard } from "@/components/dashboard/StatCard";
import { MetricsChart } from "@/components/dashboard/MetricsChart";
import { KnowledgeBuckets } from "@/components/dashboard/KnowledgeBuckets";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { useTenantStore } from "@/stores/tenant";
import { useTenants } from "@/hooks/useTenants";
import { useConversationList, useMetrics } from "@/hooks/useDashboard";
import { useAuth } from "@/hooks/useAuth";
import { formatRelativeTime } from "@/lib/format";

export function DashboardPage() {
  const currentSlug = useTenantStore((s) => s.currentSlug);
  const { data: tenants } = useTenants();
  const { user } = useAuth();
  const active = tenants?.find((t) => t.slug === currentSlug) ?? tenants?.[0];
  const slug = active?.slug ?? null;

  const { data: metrics, isLoading: metricsLoading } = useMetrics(slug);
  const { data: conversations, isLoading: convoLoading } = useConversationList(slug);

  return (
    <DashboardShell>
      {/* Greeting */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-100">
            Welcome{user?.email ? `, ${user.email.split("@")[0]}` : ""}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {active ? `Insights for ${active.name}` : "Pick a tenant to get started."}
          </p>
        </div>
        {!active && (
          <Link to="/demo">
            <Button>
              <Sparkles className="h-4 w-4" />
              Generate your first demo
            </Button>
          </Link>
        )}
      </div>

      {!active ? (
        <EmptyState
          title="No tenants yet"
          description="Generate a demo from a website URL — it'll show up here with full metrics."
          action={
            <Link to="/demo">
              <Button>Generate demo</Button>
            </Link>
          }
        />
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metricsLoading || !metrics ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
            ) : (
              <>
                <StatCard
                  icon={<MessageSquare className="h-4 w-4" />}
                  label="Conversations (7d)"
                  value={metrics.conversations_7d}
                  delta={`${metrics.conversations_30d} in 30d`}
                  tone="default"
                />
                <StatCard
                  icon={<TrendingUp className="h-4 w-4" />}
                  label="Messages (7d)"
                  value={metrics.messages_7d}
                  delta={`${metrics.messages_30d} in 30d`}
                />
                <StatCard
                  icon={<Users className="h-4 w-4" />}
                  label="Avg msgs / conversation"
                  value={metrics.avg_messages_per_conversation}
                  delta="Based on last 30d"
                />
                <StatCard
                  icon={<Sparkles className="h-4 w-4" />}
                  label="Status"
                  value={active.status || "demo"}
                  delta={active.pos_provider ? `POS: ${active.pos_provider}` : "No POS linked"}
                />
              </>
            )}
          </div>

          {/* Knowledge buckets */}
          <div className="mt-6">
            <KnowledgeBuckets slug={slug} />
          </div>

          {/* Chart + recent */}
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Last 14 days</CardTitle>
              </CardHeader>
              <CardBody>
                {metricsLoading || !metrics ? (
                  <Skeleton className="h-64" />
                ) : (
                  <MetricsChart data={metrics.daily} />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recent conversations</CardTitle>
                <Link to="/dashboard/conversations" className="text-xs text-brand-600 hover:text-brand-700">
                  View all
                </Link>
              </CardHeader>
              <CardBody className="p-0">
                <div className="max-h-96 overflow-y-auto divide-y divide-ink-100 dark:divide-ink-800">
                  {convoLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="px-5 py-3">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="mt-1.5 h-3 w-full" />
                      </div>
                    ))
                  ) : !conversations || conversations.length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-ink-500">No conversations yet.</div>
                  ) : (
                    conversations.slice(0, 8).map((c) => (
                      <Link
                        key={c.id}
                        to={`/dashboard/conversations?id=${c.id}`}
                        className="block px-5 py-3 hover:bg-ink-50 dark:hover:bg-ink-800/50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Badge tone="info" className="capitalize">{c.surface}</Badge>
                          <span className="text-xs text-ink-500">
                            {formatRelativeTime(c.last_message_at || c.created_at)}
                          </span>
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-sm text-ink-700 dark:text-ink-300">
                          {c.last_message_preview || <span className="italic text-ink-400">No messages</span>}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-ink-500">
                          <span>{c.message_count} {c.message_count === 1 ? "message" : "messages"}</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </DashboardShell>
  );
}
