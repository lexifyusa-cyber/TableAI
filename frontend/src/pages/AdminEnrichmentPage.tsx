import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { useEffect, useCallback } from "react";

interface EnrichStatusEntry {
  source: string;
  bucket: string;
  fetched_at: string | null;
  has_data: boolean;
  summary: string | null;
}

interface EnrichStatusResponse {
  tenant: string;
  sources: EnrichStatusEntry[];
}

interface RunResult {
  tenant: string;
  sources: Record<string, { ok: boolean; error?: string }>;
  merge: { tenant_fields?: Record<string, string>; items_filled_count?: number };
}

const SOURCE_LABELS: Record<string, string> = {
  "google_places_business": "Google Places (business)",
  "google_places_photo":    "Google Places (photos)",
  "google_places":          "Google Places (reviews)",
  "website":                "Tenant website",
  "site_menu":              "Website menu",
  "doordash_consumer":      "DoorDash menu",
  "ubereats_consumer":      "UberEats menu",
  "yelp_business":          "Yelp",
  "yelp_fusion":            "Yelp (reviews)",
  "vision_website":         "Vision — website screenshots",
  "vision_delivery":        "Vision — delivery app screenshots",
  "vision_ocr":             "Vision — menu image OCR",
  "delivery_discovery":     "Delivery URL discovery",
  "manual_owner_input":     "Owner edits",
};

function fmtRelative(iso: string | null): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  const ago = Date.now() - t;
  if (ago < 60_000) return "just now";
  if (ago < 3_600_000) return `${Math.floor(ago / 60_000)}m ago`;
  if (ago < 86_400_000) return `${Math.floor(ago / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function AdminEnrichmentPage() {
  const { slug } = useParams<{ slug: string }>();
  const [status, setStatus] = useState<EnrichStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<RunResult | null>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const { api } = await import("@/lib/api");
      const data = await (api as unknown as { request: <T>(p: string, init?: RequestInit) => Promise<T> }).request<EnrichStatusResponse>(
        `/api/admin/tenants/${encodeURIComponent(slug)}/enrich/status`,
      );
      setStatus(data);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  const runAll = async () => {
    if (!slug) return;
    setRunning(true);
    try {
      const { api } = await import("@/lib/api");
      const r = await (api as unknown as { request: <T>(p: string, init?: RequestInit) => Promise<T> }).request<RunResult>(
        `/api/admin/tenants/${encodeURIComponent(slug)}/enrich/run`,
        { method: "POST" },
      );
      setLastRun(r);
      toast.success("Enrichment complete.");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  if (loading || !status) {
    return <div className="mx-auto max-w-3xl p-8"><Skeleton className="h-40" /></div>;
  }

  // Group by bucket
  const byBucket: Record<string, EnrichStatusEntry[]> = {};
  for (const s of status.sources) {
    (byBucket[s.bucket] ||= []).push(s);
  }
  const bucketOrder = ["business", "menu", "social", "reputation", "operational", "customer", "calendar", "local"];

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <div className="mb-6 flex items-center gap-2 text-sm text-ink-500">
        <Link to="/admin" className="inline-flex items-center gap-1 hover:text-ink-900">
          <ArrowLeft className="h-4 w-4" /> Tenants
        </Link>
        <span>/</span>
        <Link to={`/admin/tenants/${slug}`} className="hover:text-ink-900">{slug}</Link>
        <span>/</span>
        <span className="text-ink-900">Enrichment</span>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Enrichment sources</h1>
          <p className="mt-1 text-sm text-ink-500">
            Each source contributes facts about the tenant. Merge picks the highest-priority non-null value per field.
          </p>
        </div>
        <Button onClick={runAll} loading={running}>
          <Sparkles className="h-4 w-4" /> Run all sources
        </Button>
      </div>

      {lastRun && (
        <Card className="mb-6 border-2 border-brand-300">
          <CardHeader><CardTitle>Last run</CardTitle></CardHeader>
          <CardBody>
            <ul className="space-y-1 text-sm">
              {Object.entries(lastRun.sources).map(([src, res]) => (
                <li key={src} className="flex items-center gap-2">
                  <span className={"inline-block h-2 w-2 rounded-full " + (res.ok ? "bg-emerald-500" : "bg-red-500")}/>
                  <code className="text-ink-700">{src}</code>
                  {!res.ok && <span className="text-xs text-red-600">{res.error}</span>}
                </li>
              ))}
            </ul>
            {lastRun.merge.tenant_fields && Object.keys(lastRun.merge.tenant_fields).length > 0 && (
              <div className="mt-4 text-xs text-ink-600">
                Fields filled: {Object.entries(lastRun.merge.tenant_fields).map(([f, s]) => `${f} (${s})`).join(", ")}
                {typeof lastRun.merge.items_filled_count === "number" && lastRun.merge.items_filled_count > 0 && (
                  <span>. Item fields filled: {lastRun.merge.items_filled_count}.</span>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <div className="space-y-5">
        {bucketOrder.filter((b) => byBucket[b]?.length).map((bucket) => (
          <Card key={bucket}>
            <CardHeader>
              <CardTitle className="capitalize">{bucket}</CardTitle>
            </CardHeader>
            <CardBody>
              <ul className="divide-y divide-ink-200">
                {byBucket[bucket].map((s) => (
                  <li key={s.source} className="flex items-center gap-3 py-3">
                    <span
                      className={"inline-block h-2.5 w-2.5 rounded-full shrink-0 " + (s.has_data ? "bg-emerald-500" : "bg-ink-300")}
                      title={s.has_data ? "Has data" : "Empty"}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-ink-900">{SOURCE_LABELS[s.source] || s.source}</div>
                      {s.summary && <div className="text-xs text-ink-500">{s.summary}</div>}
                    </div>
                    <Badge tone="neutral">{fmtRelative(s.fetched_at)}</Badge>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ))}

        {Object.keys(byBucket).length === 0 && (
          <Card>
            <CardBody>
              <p className="text-sm text-ink-500">No enrichment data yet. Click <strong>Run all sources</strong>.</p>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
