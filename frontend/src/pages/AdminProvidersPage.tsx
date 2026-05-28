import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, Plus, Power, Trash2, Zap } from "lucide-react";
import {
  useAdminProviders,
  useAdminCreateProvider,
  useAdminUpdateProvider,
  useAdminDeleteProvider,
  useAdminTestProvider,
  type AdminProvider,
} from "@/hooks/useAdmin";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";

export function AdminProvidersPage() {
  const { data, isLoading } = useAdminProviders();
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-100">LLM providers</h1>
          <p className="mt-1 text-sm text-ink-500">
            API keys live here, not in env. Anthropic is default; any OpenAI-compatible endpoint also works.
          </p>
        </div>
        <Button onClick={() => setAdding((v) => !v)}>
          <Plus className="h-4 w-4" />
          Add provider
        </Button>
      </div>

      {adding && <NewProviderCard onDone={() => setAdding(false)} />}

      {isLoading ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {(data ?? []).map((p) => <ProviderCard key={p.id} provider={p} />)}
        </div>
      )}
    </div>
  );
}

function ProviderCard({ provider }: { provider: AdminProvider }) {
  const update = useAdminUpdateProvider();
  const del = useAdminDeleteProvider();
  const test = useAdminTestProvider();
  const [name, setName] = useState(provider.name);
  const [baseUrl, setBaseUrl] = useState(provider.base_url ?? "");
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const save = async () => {
    try {
      await update.mutateAsync({
        id: provider.id,
        name: name.trim() !== provider.name ? name.trim() : undefined,
        base_url: (baseUrl.trim() || null),
        api_key: key.trim() || undefined,
      });
      toast.success("Provider saved.");
      setKey("");
    } catch (e) { toast.error((e as Error).message); }
  };

  const toggleEnabled = async () => {
    try {
      await update.mutateAsync({ id: provider.id, enabled: !provider.enabled });
      toast.success(provider.enabled ? "Disabled." : "Enabled.");
    } catch (e) { toast.error((e as Error).message); }
  };

  const runTest = async () => {
    try {
      const r = await test.mutateAsync(provider.id);
      if (r.ok) toast.success(r.detail); else toast.error(r.detail);
    } catch (e) { toast.error((e as Error).message); }
  };

  const remove = async () => {
    if (!confirm(`Delete provider "${provider.name}"? This cannot be undone.`)) return;
    try {
      await del.mutateAsync(provider.id);
      toast.success("Provider deleted.");
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl",
              provider.kind === "anthropic" ? "bg-orange-100 text-brand-600 dark:bg-orange-900/40" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40",
            )}>
              <Zap className="h-4.5 w-4.5" />
            </div>
            <div>
              <CardTitle>{provider.name}</CardTitle>
              <CardDescription className="capitalize">
                {provider.kind.replace("_", "-")}
                {provider.base_url ? ` · ${provider.base_url}` : ""}
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {provider.enabled ? (
              <Badge tone="success">Enabled</Badge>
            ) : (
              <Badge tone="neutral">Disabled</Badge>
            )}
            {provider.api_key_present ? (
              <Badge tone="success">Key set</Badge>
            ) : (
              <Badge tone="warning">No key</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardBody>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field
            label="Base URL"
            hint={
              provider.kind === "anthropic"
                ? "Optional. Overrides https://api.anthropic.com — useful for proxies or gateways. Leave blank for default."
                : "E.g. https://api.openai.com, https://api.groq.com/openai"
            }
          >
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={provider.kind === "anthropic" ? "leave blank for default" : "https://…"}
            />
          </Field>
          <Field label={provider.api_key_present ? "Replace key" : "Set key"} hint={provider.api_key_masked ? `Current: ${provider.api_key_masked}` : "Paste it here."} className="md:col-span-2">
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <Input
                type={showKey ? "text" : "password"}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="px-9"
                autoComplete="off"
                placeholder={provider.kind === "anthropic" ? "sk-ant-..." : "sk-..."}
              />
              <button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700" aria-label={showKey ? "Hide" : "Show"}>
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={save} loading={update.isPending} disabled={!key && name === provider.name && (provider.base_url || "") === baseUrl}>Save</Button>
          <Button variant="secondary" onClick={runTest} loading={test.isPending} disabled={!provider.api_key_present}>Test key</Button>
          <Button variant="ghost" onClick={toggleEnabled} loading={update.isPending}>
            <Power className="h-4 w-4" />
            {provider.enabled ? "Disable" : "Enable"}
          </Button>
          <Button variant="danger" size="sm" onClick={remove} className="ml-auto">
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function NewProviderCard({ onDone }: { onDone: () => void }) {
  const create = useAdminCreateProvider();
  const [kind, setKind] = useState<"anthropic" | "openai_compat">("anthropic");
  const [name, setName] = useState("Anthropic");
  const [baseUrl, setBaseUrl] = useState("");
  const [key, setKey] = useState("");

  const save = async () => {
    try {
      await create.mutateAsync({
        name: name.trim() || (kind === "anthropic" ? "Anthropic" : "OpenAI"),
        kind,
        base_url: baseUrl.trim() || null,
        api_key: key.trim(),
        enabled: true,
      });
      toast.success("Provider added.");
      onDone();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Card className="border-2 border-dashed border-brand-300 mt-4">
      <CardHeader>
        <CardTitle>Add a provider</CardTitle>
        <CardDescription>Anthropic or any OpenAI-compatible endpoint.</CardDescription>
      </CardHeader>
      <CardBody className="space-y-3">
        <Field label="Kind">
          <div className="flex gap-2">
            {(["anthropic", "openai_compat"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={cn(
                  "flex-1 rounded-xl border px-4 py-3 text-left text-sm transition",
                  kind === k
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                    : "border-ink-200 hover:border-ink-300 dark:border-ink-700",
                )}
              >
                <div className="font-semibold">{k === "anthropic" ? "Anthropic" : "OpenAI-compatible"}</div>
                <div className="mt-0.5 text-xs text-ink-500">
                  {k === "anthropic" ? "Claude SDK, prompt caching, tool use" : "OpenAI, Groq, Together, Fireworks, OpenRouter, DeepSeek, Ollama…"}
                </div>
              </button>
            ))}
          </div>
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field
            label="Base URL"
            hint={kind === "anthropic" ? "Optional — overrides https://api.anthropic.com" : undefined}
          >
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={kind === "anthropic" ? "leave blank for default" : "https://api.openai.com"}
            />
          </Field>
        </div>
        <Field label="API key"><Input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={kind === "anthropic" ? "sk-ant-..." : "sk-..."} /></Field>
        <div className="flex gap-2">
          <Button onClick={save} loading={create.isPending} disabled={!key}>Add provider</Button>
          <Button variant="ghost" onClick={onDone}>Cancel</Button>
        </div>
      </CardBody>
    </Card>
  );
}
