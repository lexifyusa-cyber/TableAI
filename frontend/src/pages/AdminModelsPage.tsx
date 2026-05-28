import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { useModelConfig, useUpdateModelConfig, type ModelConfig } from "@/hooks/useAdmin";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";

const TASKS = [
  { key: "chat", label: "Customer chat", hint: "Streaming replies to restaurant customers. Optimize for latency + quality." },
  { key: "demo_generation", label: "Demo generation", hint: "One-shot, high-stakes. Use the most capable model." },
  { key: "premium_chat", label: "Premium chat", hint: "Fallback for hard queries (allergens, complex pairings)." },
] as const;

type TaskKey = (typeof TASKS)[number]["key"];

export function AdminModelsPage() {
  const { data, isLoading } = useModelConfig();
  const update = useUpdateModelConfig();
  const [local, setLocal] = useState<ModelConfig | null>(null);

  useEffect(() => {
    if (data && !local) setLocal(data);
  }, [data, local]);

  if (isLoading || !local) {
    return <Skeleton className="h-96" />;
  }

  const save = async () => {
    try {
      await update.mutateAsync(local);
      toast.success("Model config saved.");
    } catch (e) { toast.error((e as Error).message); }
  };

  const setDefault = (task: TaskKey, kind: "anthropic" | "openai_compat", model: string) => {
    setLocal({
      ...local,
      defaults: { ...local.defaults, [task]: { kind, model } },
    });
  };

  const addAllowed = (kind: "anthropic" | "openai_compat", model: string) => {
    const current = local.allowed_models[kind] ?? [];
    if (current.includes(model) || !model.trim()) return;
    setLocal({
      ...local,
      allowed_models: { ...local.allowed_models, [kind]: [...current, model.trim()] },
    });
  };

  const removeAllowed = (kind: "anthropic" | "openai_compat", model: string) => {
    setLocal({
      ...local,
      allowed_models: {
        ...local.allowed_models,
        [kind]: (local.allowed_models[kind] ?? []).filter((m) => m !== model),
      },
    });
  };

  const anthropic = local.allowed_models.anthropic ?? [];
  const openai = local.allowed_models.openai_compat ?? [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-100">Models</h1>
          <p className="mt-1 text-sm text-ink-500">Global defaults per task and the allowed model list per provider.</p>
        </div>
        <Button onClick={save} loading={update.isPending}>Save changes</Button>
      </div>

      <div className="space-y-4">
        {TASKS.map((t) => {
          const current = local.defaults[t.key as TaskKey];
          return (
            <Card key={t.key}>
              <CardHeader>
                <CardTitle>{t.label}</CardTitle>
                <CardDescription>{t.hint}</CardDescription>
              </CardHeader>
              <CardBody className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Provider kind">
                    <select
                      value={current?.kind ?? "anthropic"}
                      onChange={(e) => setDefault(t.key as TaskKey, e.target.value as "anthropic" | "openai_compat", current?.model ?? "")}
                      className="h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm dark:border-ink-700 dark:bg-ink-800"
                    >
                      <option value="anthropic">Anthropic</option>
                      <option value="openai_compat">OpenAI-compatible</option>
                    </select>
                  </Field>
                  <Field label="Model">
                    <select
                      value={current?.model ?? ""}
                      onChange={(e) => setDefault(t.key as TaskKey, (current?.kind ?? "anthropic"), e.target.value)}
                      className="h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm dark:border-ink-700 dark:bg-ink-800"
                    >
                      <option value="">— pick a model —</option>
                      {(current?.kind === "openai_compat" ? openai : anthropic).map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </CardBody>
            </Card>
          );
        })}

        <Card>
          <CardHeader>
            <CardTitle>Allowed models</CardTitle>
            <CardDescription>Add or remove models that can be selected per task or per tenant.</CardDescription>
          </CardHeader>
          <CardBody className="space-y-6">
            <AllowedModelsEditor
              title="Anthropic"
              models={anthropic}
              onAdd={(m) => addAllowed("anthropic", m)}
              onRemove={(m) => removeAllowed("anthropic", m)}
            />
            <AllowedModelsEditor
              title="OpenAI-compatible"
              models={openai}
              onAdd={(m) => addAllowed("openai_compat", m)}
              onRemove={(m) => removeAllowed("openai_compat", m)}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function AllowedModelsEditor({
  title,
  models,
  onAdd,
  onRemove,
}: {
  title: string;
  models: string[];
  onAdd: (m: string) => void;
  onRemove: (m: string) => void;
}) {
  const [input, setInput] = useState("");
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-ink-800 dark:text-ink-200">{title}</div>
      <div className="flex flex-wrap gap-2">
        {models.map((m) => (
          <Badge key={m} tone="neutral" className="font-mono gap-1">
            {m}
            <button onClick={() => onRemove(m)} className="text-ink-500 hover:text-red-500" aria-label={`Remove ${m}`}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="model name (e.g. claude-haiku-4-5-20251001)"
          className="font-mono"
          onKeyDown={(e) => {
            if (e.key === "Enter") { onAdd(input); setInput(""); }
          }}
        />
        <Button variant="secondary" onClick={() => { onAdd(input); setInput(""); }}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
    </div>
  );
}
