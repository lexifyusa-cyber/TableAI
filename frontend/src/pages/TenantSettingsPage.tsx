import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTenantStore } from "@/stores/tenant";
import { useTenantSettings, useUpdateTenantSettings } from "@/hooks/useTenantSettings";
import { useModelConfig } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";

export function TenantSettingsPage() {
  const slug = useTenantStore((s) => s.currentSlug);
  const { role } = useAuth();
  const isStaff = role === "admin" || role === "employee";
  const { data, isLoading } = useTenantSettings(slug);
  const update = useUpdateTenantSettings(slug);
  const { data: modelCfg } = useModelConfig();

  const [name, setName] = useState("");
  const [primary, setPrimary] = useState("");
  const [accent, setAccent] = useState("");
  const [tagline, setTagline] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [persona, setPersona] = useState("");
  const [chatKind, setChatKind] = useState("");
  const [chatModel, setChatModel] = useState("");

  useEffect(() => {
    if (!data) return;
    setName(data.name);
    setPrimary(data.brand?.primary_color ?? "");
    setAccent(data.brand?.accent_color ?? "");
    setTagline(data.ai_config?.tagline ?? "");
    setPhone(data.contact?.phone ?? "");
    setAddress(data.contact?.address ?? "");
    setPersona(data.ai_config?.persona ?? "");
    setChatKind(data.model_config_override?.chat?.kind ?? "");
    setChatModel(data.model_config_override?.chat?.model ?? "");
  }, [data]);

  const saveBrand = async () => {
    try {
      await update.mutateAsync({
        name,
        brand: { ...(data?.brand || {}), primary_color: primary || null, accent_color: accent || null },
        contact: { ...(data?.contact || {}), phone: phone || null, address: address || null },
        ai_config: { ...(data?.ai_config || {}), tagline: tagline || null, persona: persona || null },
      });
      toast.success("Saved.");
    } catch (e) { toast.error((e as Error).message); }
  };

  const saveModelOverride = async () => {
    try {
      const override = chatKind && chatModel ? { chat: { kind: chatKind, model: chatModel } } : null;
      await update.mutateAsync({ model_config_override: override as any });
      toast.success(override ? "Model override saved." : "Override cleared — falling back to platform default.");
    } catch (e) { toast.error((e as Error).message); }
  };

  const models = chatKind === "openai_compat"
    ? modelCfg?.allowed_models.openai_compat ?? []
    : modelCfg?.allowed_models.anthropic ?? [];

  return (
    <DashboardShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-100">Settings</h1>
        <p className="mt-1 text-sm text-ink-500">Your business's appearance, contact, and AI behavior.</p>
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Brand & contact</CardTitle>
              <CardDescription>How you appear to customers on the menu and chat pages.</CardDescription>
            </CardHeader>
            <CardBody className="space-y-3">
              <Field label="Business name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Primary color" hint="#dc2626 or any CSS color."><Input value={primary} onChange={(e) => setPrimary(e.target.value)} placeholder="#dc2626" /></Field>
                <Field label="Accent color"><Input value={accent} onChange={(e) => setAccent(e.target.value)} placeholder="#7c2d12" /></Field>
              </div>
              <Field label="Tagline" hint="Shown under your business name on the menu page."><Input value={tagline} onChange={(e) => setTagline(e.target.value)} /></Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
                <Field label="Address"><Input value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
              </div>
              <Field label="AI persona" hint="How the chat assistant should sound. 1-3 sentences.">
                <Textarea rows={3} value={persona} onChange={(e) => setPersona(e.target.value)} />
              </Field>
              <div><Button onClick={saveBrand} loading={update.isPending}>Save</Button></div>
            </CardBody>
          </Card>

          {isStaff ? (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>AI model override</CardTitle>
                    <CardDescription>
                      Staff-only. Override the platform default for this tenant's chat. Models come
                      from the allowed list in <span className="font-mono">/admin/models</span>.
                    </CardDescription>
                  </div>
                  {data.model_config_override?.chat && <Badge tone="info">Custom override</Badge>}
                </div>
              </CardHeader>
              <CardBody className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Provider kind">
                    <select value={chatKind} onChange={(e) => { setChatKind(e.target.value); setChatModel(""); }} className="h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm dark:border-ink-700 dark:bg-ink-800">
                      <option value="">— use platform default —</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="openai_compat">OpenAI-compatible</option>
                    </select>
                  </Field>
                  <Field label="Model">
                    <select value={chatModel} onChange={(e) => setChatModel(e.target.value)} disabled={!chatKind} className="h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm disabled:bg-ink-100 dark:border-ink-700 dark:bg-ink-800 dark:disabled:bg-ink-900">
                      <option value="">— pick a model —</option>
                      {models.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveModelOverride} loading={update.isPending}>Save override</Button>
                  {data.model_config_override?.chat && (
                    <Button variant="ghost" onClick={() => { setChatKind(""); setChatModel(""); saveModelOverride(); }}>Clear override</Button>
                  )}
                </div>
              </CardBody>
            </Card>
          ) : (
            data.model_config_override?.chat && (
              <Card>
                <CardHeader>
                  <CardTitle>AI model</CardTitle>
                  <CardDescription>Set by TableAI staff. Contact support if you need a different model.</CardDescription>
                </CardHeader>
                <CardBody>
                  <Badge tone="info">
                    {data.model_config_override.chat.kind} · {data.model_config_override.chat.model}
                  </Badge>
                </CardBody>
              </Card>
            )
          )}
        </div>
      )}
    </DashboardShell>
  );
}
