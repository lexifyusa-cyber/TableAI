import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Eye, EyeOff, KeyRound, MapPin, XCircle } from "lucide-react";
import { useIntegrations, useUpdateIntegrations } from "@/hooks/useKnowledge";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";

export function AdminIntegrationsPage() {
  const { data, isLoading } = useIntegrations();
  const update = useUpdateIntegrations();
  const [gmaps, setGmaps] = useState("");
  const [show, setShow] = useState(false);

  const save = async () => {
    try {
      await update.mutateAsync({ google_maps_api_key: gmaps });
      toast.success("Google Maps key saved.");
      setGmaps("");
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-100">
          Integrations
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Non-LLM external data sources. Reputation (Google reviews) flows from here into every tenant's Reputation bucket.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <CardTitle>Google Maps (Places API)</CardTitle>
                <CardDescription>
                  Powers public-read of ratings, reviews, hours. Enable the Places API in your
                  Google Cloud project, then create an API key restricted to Places API requests.{" "}
                  <a
                    href="https://developers.google.com/maps/documentation/places/web-service/get-api-key"
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-600 hover:underline"
                  >
                    Docs
                  </a>
                  .
                </CardDescription>
              </div>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-24" />
            ) : data?.google_maps_api_key_present ? (
              <Badge tone="success">
                <CheckCircle2 className="h-3 w-3" /> Configured
              </Badge>
            ) : (
              <Badge tone="warning">
                <XCircle className="h-3 w-3" /> Not set
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardBody>
          {isLoading ? (
            <Skeleton className="h-12" />
          ) : (
            <>
              {data?.google_maps_api_key_present && (
                <div className="mb-3 rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 font-mono text-xs text-ink-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200">
                  Current: {data.google_maps_api_key_masked}
                </div>
              )}
              <Field
                label={data?.google_maps_api_key_present ? "Replace key" : "Set key"}
                hint="Typically starts with 'AIza'"
              >
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <Input
                    type={show ? "text" : "password"}
                    value={gmaps}
                    onChange={(e) => setGmaps(e.target.value)}
                    placeholder="AIza…"
                    className="px-9"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
                    aria-label={show ? "Hide" : "Show"}
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
              <div className="mt-3 flex gap-2">
                <Button onClick={save} disabled={!gmaps} loading={update.isPending}>
                  Save key
                </Button>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      <Card className="mt-5 border-dashed">
        <CardBody>
          <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100">Coming next</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-500">
            <li>• Yelp Fusion API (secondary review source)</li>
            <li>• Instagram public profile (Social bucket)</li>
            <li>• POS (Toast / Square) — unlocks Operational bucket, post-signup</li>
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
