import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Bot, ExternalLink, Mail, MessageSquare, RefreshCw, Star, UtensilsCrossed, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAdminTenants, useCreateInvite, useInvitesForTenant, useModelConfig } from "@/hooks/useAdmin";
import { useConversationList, useMetrics } from "@/hooks/useDashboard";
import { useMenu } from "@/hooks/useMenu";
import { useTenantSettings, useUpdateTenantSettings } from "@/hooks/useTenantSettings";
import { useKnowledge, useRefreshReputation, useRefreshMenu } from "@/hooks/useKnowledge";
import { CulturalContextCard } from "@/components/admin/CulturalContextCard";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/dashboard/StatCard";
import { MetricsChart } from "@/components/dashboard/MetricsChart";
import { formatRelativeTime } from "@/lib/format";

export function AdminTenantDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: tenants } = useAdminTenants();
  const tenant = tenants?.find((t) => t.slug === slug);
  const { data: metrics } = useMetrics(slug);
  const { data: convos } = useConversationList(slug);
  const { data: menu } = useMenu(slug);
  const { data: invites, refetch: refetchInvites } = useInvitesForTenant(slug);
  const create = useCreateInvite();
  const [email, setEmail] = useState("");

  const { data: settings } = useTenantSettings(slug);
  const updateSettings = useUpdateTenantSettings(slug);
  const { data: modelCfg } = useModelConfig();
  const { data: knowledge } = useKnowledge(slug);
  const refreshRep = useRefreshReputation();
  const refreshMenu = useRefreshMenu();

  const repBucket = knowledge?.buckets.find((b) => b.kind === "reputation");
  const menuBucket = knowledge?.buckets.find((b) => b.kind === "menu");

  const doRefreshReputation = async () => {
    if (!slug) return;
    try {
      const r = await refreshRep.mutateAsync(slug);
      if (r.ok) {
        toast.success(r.detail + (r.rating ? ` (${r.rating}★, ${r.review_count} reviews)` : ""));
      } else {
        toast.error(r.detail);
      }
    } catch (e) { toast.error((e as Error).message); }
  };

  const doRefreshMenu = async () => {
    if (!slug) return;
    try {
      const r = await refreshMenu.mutateAsync(slug);
      if (r.ok) {
        toast.success(
          `Menu refreshed — ${r.item_count ?? 0} items across ${r.category_count ?? 0} categories.`,
        );
      } else {
        toast.error(r.detail || "Menu refresh failed.");
      }
    } catch (e) { toast.error((e as Error).message); }
  };
  const [chatKind, setChatKind] = useState("");
  const [chatModel, setChatModel] = useState("");
  useEffect(() => {
    if (!settings) return;
    setChatKind(settings.model_config_override?.chat?.kind ?? "");
    setChatModel(settings.model_config_override?.chat?.model ?? "");
  }, [settings]);
  const modelOptions = chatKind === "openai_compat"
    ? modelCfg?.allowed_models.openai_compat ?? []
    : modelCfg?.allowed_models.anthropic ?? [];

  const saveOverride = async () => {
    try {
      const override = chatKind && chatModel ? { chat: { kind: chatKind, model: chatModel } } : null;
      await updateSettings.mutateAsync({ model_config_override: override as any });
      toast.success(override ? "Model override saved." : "Override cleared — using platform default.");
    } catch (e) { toast.error((e as Error).message); }
  };

  const invite = async () => {
    if (!slug || !email.trim()) return;
    try {
      const r = await create.mutateAsync({ slug, email: email.trim() });
      toast.success(`Invite created — code ${r.code}`);
      setEmail("");
      refetchInvites();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div>
      <Link to="/admin" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900 dark:hover:text-ink-100">
        <ArrowLeft className="h-4 w-4" /> Tenants
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-100">
            {tenant?.name ?? slug}
          </h1>
          <p className="mt-1 text-sm text-ink-500 capitalize">
            {tenant?.business_type} · /{slug}
            {tenant?.status ? <> · <Badge tone={tenant.status === "active" ? "success" : "brand"} className="capitalize">{tenant.status}</Badge></> : null}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to={`/m/${slug}`}><Button variant="secondary"><UtensilsCrossed className="h-4 w-4" />Menu</Button></Link>
          <Link to={`/c/${slug}`}><Button variant="secondary"><MessageSquare className="h-4 w-4" />Chat</Button></Link>
          {tenant?.source_url && (
            <a href={tenant.source_url} target="_blank" rel="noreferrer">
              <Button variant="ghost">Source <ExternalLink className="h-4 w-4" /></Button>
            </a>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {!metrics ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <StatCard label="Conversations (7d)" value={metrics.conversations_7d} delta={`${metrics.conversations_30d} in 30d`} />
            <StatCard label="Messages (7d)" value={metrics.messages_7d} delta={`${metrics.messages_30d} in 30d`} />
            <StatCard label="Avg msgs / convo" value={metrics.avg_messages_per_conversation} delta="Last 30d" />
            <StatCard label="Menu items" value={menu?.categories.reduce((n, c) => n + c.items.length, 0) ?? 0} delta={`${menu?.categories.length ?? 0} categories`} />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Last 14 days</CardTitle></CardHeader>
          <CardBody>
            {metrics ? <MetricsChart data={metrics.daily} /> : <Skeleton className="h-56" />}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invite owner</CardTitle>
            <CardDescription>Generates a magic link + 6-digit code.</CardDescription>
          </CardHeader>
          <CardBody className="space-y-3">
            <Field label="Email">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" placeholder="owner@example.com" />
              </div>
            </Field>
            <Button onClick={invite} loading={create.isPending} disabled={!email.trim()} className="w-full">
              <UserPlus className="h-4 w-4" /> Create invite
            </Button>
            {invites && invites.length > 0 && (
              <div className="mt-3 space-y-2 border-t border-ink-100 pt-3 dark:border-ink-800">
                <div className="text-xs font-semibold text-ink-500">Pending invites</div>
                {invites.map((inv) => (
                  <div key={inv.token} className="rounded-lg bg-ink-50 p-2 text-xs dark:bg-ink-800/40">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{inv.email}</span>
                      <span className="font-mono text-ink-700 dark:text-ink-200">{inv.code}</span>
                    </div>
                    <div className="mt-0.5 text-ink-500">Expires {formatRelativeTime(inv.expires_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Cultural context — country + cuisine */}
      <div className="mt-6">
        {slug && <CulturalContextCard slug={slug} />}
      </div>

      {/* Menu bucket */}
      <div className="mt-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40">
                  <UtensilsCrossed className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle>Menu bucket</CardTitle>
                  <CardDescription>
                    Re-scrapes the source URL, re-extracts the menu via the LLM, and replaces this tenant's items.
                    Brand, persona, hours, and contact are left untouched.
                  </CardDescription>
                </div>
              </div>
              <Button onClick={doRefreshMenu} loading={refreshMenu.isPending} disabled={!tenant?.source_url}>
                <RefreshCw className="h-4 w-4" />
                Refresh menu
              </Button>
            </div>
          </CardHeader>
          <CardBody>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {menuBucket?.summary && (
                <span className="font-medium text-ink-900 dark:text-ink-100">{menuBucket.summary}</span>
              )}
              {menuBucket?.fetched_at && (
                <span className="text-xs text-ink-500">Fetched {formatRelativeTime(menuBucket.fetched_at)}</span>
              )}
              {!tenant?.source_url && (
                <span className="text-xs text-amber-600">No source_url on this tenant; refresh disabled.</span>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Reputation / Google Places */}
      <div className="mt-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/40">
                  <Star className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle>Reputation bucket</CardTitle>
                  <CardDescription>
                    Google reviews, rating, and popular dishes. Feeds into the AI's answers.
                  </CardDescription>
                </div>
              </div>
              <Button onClick={doRefreshReputation} loading={refreshRep.isPending}>
                <RefreshCw className="h-4 w-4" />
                {repBucket?.active ? "Refresh" : "Pull from Google"}
              </Button>
            </div>
          </CardHeader>
          <CardBody>
            {repBucket?.active ? (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Badge tone="success">Active</Badge>
                {repBucket.summary && <span className="font-medium text-ink-900 dark:text-ink-100">{repBucket.summary}</span>}
                {repBucket.fetched_at && <span className="text-xs text-ink-500">Fetched {formatRelativeTime(repBucket.fetched_at)}</span>}
              </div>
            ) : (
              <p className="text-sm text-ink-500">
                Not populated yet. Make sure a Google Maps API key is configured at{" "}
                <Link to="/admin/integrations" className="font-medium text-brand-600 hover:underline">
                  /admin/integrations
                </Link>
                , then click the button above.
              </p>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-brand-600 dark:bg-orange-900/40">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle>AI model override</CardTitle>
                  <CardDescription>
                    Staff-only. Override the platform default for this tenant's chat. Models come
                    from the allowed list at <span className="font-mono">/admin/models</span>.
                  </CardDescription>
                </div>
              </div>
              {settings?.model_config_override?.chat && <Badge tone="info">Custom override</Badge>}
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Provider kind">
                <select
                  value={chatKind}
                  onChange={(e) => { setChatKind(e.target.value); setChatModel(""); }}
                  className="h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm dark:border-ink-700 dark:bg-ink-800"
                >
                  <option value="">— use platform default —</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="openai_compat">OpenAI-compatible</option>
                </select>
              </Field>
              <Field label="Model">
                <select
                  value={chatModel}
                  onChange={(e) => setChatModel(e.target.value)}
                  disabled={!chatKind}
                  className="h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm disabled:bg-ink-100 dark:border-ink-700 dark:bg-ink-800 dark:disabled:bg-ink-900"
                >
                  <option value="">— pick a model —</option>
                  {modelOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveOverride} loading={updateSettings.isPending}>Save override</Button>
              {settings?.model_config_override?.chat && (
                <Button
                  variant="ghost"
                  onClick={() => { setChatKind(""); setChatModel(""); saveOverride(); }}
                >
                  Clear override
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Recent conversations</CardTitle></CardHeader>
          <CardBody className="p-0">
            <div className="max-h-80 overflow-y-auto divide-y divide-ink-100 dark:divide-ink-800">
              {!convos ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="mx-5 my-3 h-10" />)
              ) : convos.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-ink-500">No conversations yet.</div>
              ) : (
                convos.slice(0, 10).map((c) => (
                  <div key={c.id} className="px-5 py-3">
                    <div className="flex items-center justify-between">
                      <Badge tone="info" className="capitalize">{c.surface}</Badge>
                      <span className="text-xs text-ink-500">{formatRelativeTime(c.last_message_at || c.created_at)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-ink-700 dark:text-ink-300">
                      {c.last_message_preview || <span className="italic text-ink-400">No messages</span>}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Owners</CardTitle></CardHeader>
          <CardBody>
            {!tenant?.owners.length ? (
              <p className="text-sm text-ink-500">No owners linked yet. Invite one above.</p>
            ) : (
              <ul className="space-y-2">
                {tenant.owners.map((o) => (
                  <li key={o.user_id} className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2 dark:bg-ink-800/40">
                    <div>
                      <div className="text-sm font-medium">{o.email}</div>
                      {o.display_name && <div className="text-xs text-ink-500">{o.display_name}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
