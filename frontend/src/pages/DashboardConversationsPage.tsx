import { useSearchParams } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTenantStore } from "@/stores/tenant";
import { useTenants } from "@/hooks/useTenants";
import { useConversation, useConversationList } from "@/hooks/useDashboard";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

export function DashboardConversationsPage() {
  const [params, setParams] = useSearchParams();
  const activeId = params.get("id");
  const currentSlug = useTenantStore((s) => s.currentSlug);
  const { data: tenants } = useTenants();
  const tenant = tenants?.find((t) => t.slug === currentSlug) ?? tenants?.[0];
  const slug = tenant?.slug ?? null;

  const { data: list, isLoading: listLoading } = useConversationList(slug);
  const { data: thread, isLoading: threadLoading } = useConversation(activeId);

  return (
    <DashboardShell>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-100">Conversations</h1>
        <p className="mt-1 text-sm text-ink-500">
          All chats across {tenant?.name ?? "your tenant"}'s surfaces (QR, tablet, kiosk).
        </p>
      </div>

      {!tenant ? (
        <EmptyState title="No tenant selected" description="Pick one from the switcher." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-12">
          {/* List */}
          <Card className={cn("lg:col-span-5", activeId && "hidden lg:block")}>
            <CardHeader>
              <CardTitle>{list?.length ?? 0} conversations</CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              <div className="max-h-[70vh] overflow-y-auto divide-y divide-ink-100 dark:divide-ink-800">
                {listLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="px-5 py-3">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="mt-1.5 h-3 w-full" />
                    </div>
                  ))
                ) : !list || list.length === 0 ? (
                  <div className="px-5 py-12 text-center text-sm text-ink-500">No conversations yet.</div>
                ) : (
                  list.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setParams({ id: c.id })}
                      className={cn(
                        "block w-full px-5 py-3 text-left hover:bg-ink-50 dark:hover:bg-ink-800/50",
                        activeId === c.id && "bg-ink-50 dark:bg-ink-800/50",
                      )}
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
                      <div className="mt-1 text-xs text-ink-500">
                        {c.message_count} {c.message_count === 1 ? "message" : "messages"} · started {formatDateTime(c.created_at)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </CardBody>
          </Card>

          {/* Detail */}
          <Card className={cn("lg:col-span-7", !activeId && "hidden lg:block")}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                {activeId ? "Transcript" : "Select a conversation"}
              </CardTitle>
              {activeId && (
                <button
                  onClick={() => setParams({})}
                  className="text-xs text-ink-500 hover:text-ink-900 dark:hover:text-ink-100 lg:hidden"
                >
                  ← Back to list
                </button>
              )}
            </CardHeader>
            <CardBody>
              {!activeId ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <MessageSquare className="h-10 w-10 text-ink-300" />
                  <p className="mt-3 text-sm text-ink-500">Pick a conversation on the left to see the full transcript.</p>
                </div>
              ) : threadLoading || !thread ? (
                <div className="space-y-3">
                  <Skeleton className="h-16" />
                  <Skeleton className="h-12 w-3/4" />
                  <Skeleton className="h-24" />
                </div>
              ) : (
                <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                  <div className="flex items-center gap-2 text-xs text-ink-500">
                    <Badge tone="info" className="capitalize">{thread.surface}</Badge>
                    <span>{formatDateTime(thread.created_at)}</span>
                  </div>
                  {thread.messages.map((m) => {
                    const isUser = m.role === "user";
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          "rounded-xl px-4 py-2.5 text-sm leading-relaxed",
                          isUser
                            ? "ml-8 bg-ink-900 text-white dark:bg-white dark:text-ink-900"
                            : "mr-8 bg-ink-100 text-ink-900 dark:bg-ink-800 dark:text-ink-100",
                        )}
                      >
                        <div className="mb-0.5 text-xs font-semibold uppercase opacity-60">
                          {m.role}
                          {m.output_tokens ? ` · ${m.output_tokens} out` : ""}
                        </div>
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </DashboardShell>
  );
}
