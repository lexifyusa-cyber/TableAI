import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, Globe, Loader2, Sparkles, Store } from "lucide-react";
import { api } from "@/lib/api";
import type { GenerateDemoResponse } from "@/types/api";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";

interface FormValues {
  url: string;
  slug: string;
}

const EXAMPLES = [
  { label: "GR8 Indian Food (restaurant)", url: "https://www.gr8indianfood.com/", slug: "gif" },
  { label: "Any URL…", url: "", slug: "" },
];

const STAGES = [
  "Scraping website",
  "Analyzing with Claude",
  "Extracting menu & brand",
  "Saving tenant",
];

export function DemoPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [stageIdx, setStageIdx] = useState(0);
  const [result, setResult] = useState<GenerateDemoResponse | null>(null);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormValues>({
    defaultValues: { url: "", slug: "" },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      setStageIdx(0);
      const stageTimer = setInterval(() => {
        setStageIdx((i) => Math.min(i + 1, STAGES.length - 1));
      }, 4000);
      try {
        const res = await api.generateDemo({
          url: values.url.trim(),
          slug: values.slug.trim() || undefined,
        });
        return res;
      } finally {
        clearInterval(stageTimer);
      }
    },
    onSuccess: (data) => {
      setResult(data);
      qc.invalidateQueries({ queryKey: ["tenants"] });
      toast.success(`${data.name} is ready.`);
    },
    onError: (e: Error) => {
      toast.error(`Generation failed: ${e.message}`);
    },
  });

  const onSubmit = (values: FormValues) => {
    mutation.mutate(values);
  };

  const applyExample = (ex: (typeof EXAMPLES)[number]) => {
    setValue("url", ex.url);
    setValue("slug", ex.slug);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8">
        <Badge tone="brand" className="mb-3">
          <Sparkles className="h-3 w-3" />
          Demo generator
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900 dark:text-ink-100 sm:text-4xl">
          Build an AI demo in <span className="text-gradient">30 seconds</span>
        </h1>
        <p className="mt-2 max-w-2xl text-ink-600 dark:text-ink-400">
          Paste a small business's website. We'll scrape the menu, structure it, and spin up a tenant
          you can show them on a tablet.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate a tenant</CardTitle>
          <CardDescription>Any restaurant or retail website with a visible menu works best.</CardDescription>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Field
              label="Website URL"
              error={errors.url?.message}
              hint="Must start with https://"
            >
              <div className="relative">
                <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <Input
                  {...register("url", {
                    required: "URL is required",
                    pattern: {
                      value: /^https?:\/\/.+/i,
                      message: "Must be a valid https:// URL",
                    },
                  })}
                  className="pl-9"
                  placeholder="https://www.example.com"
                  invalid={!!errors.url}
                />
              </div>
            </Field>

            <Field label="Slug (optional)" hint="Letters, numbers, dashes. Leave blank to auto-generate.">
              <div className="relative">
                <Store className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <Input
                  {...register("slug", {
                    pattern: { value: /^[a-z0-9-]*$/, message: "Lowercase letters, numbers, dashes only" },
                  })}
                  className="pl-9"
                  placeholder="gif"
                  invalid={!!errors.slug}
                />
              </div>
            </Field>

            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-ink-500">Quick start:</span>
              {EXAMPLES.filter((e) => e.url).map((ex) => (
                <button
                  key={ex.slug}
                  type="button"
                  onClick={() => applyExample(ex)}
                  className="rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-medium text-ink-700 hover:border-brand-500 hover:text-brand-600 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200"
                >
                  {ex.label}
                </button>
              ))}
            </div>

            <Button type="submit" size="lg" className="w-full sm:w-auto" loading={mutation.isPending}>
              {mutation.isPending ? "Generating…" : (<><Sparkles className="h-4 w-4" />Generate demo</>)}
            </Button>
          </form>
        </CardBody>
      </Card>

      {/* Progress */}
      {mutation.isPending && (
        <Card className="mt-6">
          <CardBody>
            <div className="space-y-3">
              {STAGES.map((stage, i) => {
                const done = i < stageIdx;
                const active = i === stageIdx;
                return (
                  <div key={stage} className="flex items-center gap-3">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                        done
                          ? "bg-emerald-500 text-white"
                          : active
                          ? "bg-brand-500 text-white"
                          : "bg-ink-200 text-ink-500 dark:bg-ink-700"
                      }`}
                    >
                      {done ? "✓" : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : i + 1}
                    </div>
                    <span
                      className={
                        done || active
                          ? "text-sm font-medium text-ink-900 dark:text-ink-100"
                          : "text-sm text-ink-500"
                      }
                    >
                      {stage}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Result */}
      {result && !mutation.isPending && (
        <Card className="mt-6 border-emerald-200 dark:border-emerald-900">
          <CardBody>
            <Badge tone="success" className="mb-2">Demo ready</Badge>
            <h3 className="text-xl font-semibold text-ink-900 dark:text-ink-100">{result.name}</h3>
            <p className="mt-1 text-sm text-ink-500 capitalize">
              {result.business_type}
              {result.pos_provider ? ` · POS: ${result.pos_provider}` : ""}
              {" · /"}{result.slug}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => nav(`/m/${result.slug}`)}>
                View menu
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="secondary" onClick={() => nav(`/c/${result.slug}`)}>
                Open chat
              </Button>
              <Link to="/" className="inline-flex items-center px-3 py-2 text-sm text-ink-500 hover:text-ink-900 dark:hover:text-ink-100">
                Back to home
              </Link>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
