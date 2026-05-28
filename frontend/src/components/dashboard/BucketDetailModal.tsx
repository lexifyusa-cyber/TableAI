import { Eye, EyeOff, Globe, Lock, X } from "lucide-react";
import { useBucketDetail, type BucketKind } from "@/hooks/useKnowledge";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/format";

interface Props {
  slug: string | null | undefined;
  kind: BucketKind | null;
  onClose: () => void;
}

export function BucketDetailModal({ slug, kind, onClose }: Props) {
  const { data, isLoading } = useBucketDetail(slug, kind);

  if (!kind) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-ink-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4 dark:border-ink-800">
          <div>
            <h2 className="text-lg font-semibold capitalize text-ink-900 dark:text-ink-100">
              {kind} bucket
            </h2>
            {data?.source && data?.fetched_at && (
              <p className="mt-0.5 text-xs text-ink-500">
                {data.source} · updated {formatRelativeTime(data.fetched_at)}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto p-5">
          {isLoading || !data ? (
            <div className="space-y-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ) : !data.public && !data.private ? (
            <div className="py-10 text-center text-sm text-ink-500">
              This bucket has no data yet.
            </div>
          ) : (
            <div className="space-y-5">
              {data.public && (
                <Section
                  tone="public"
                  title="Public"
                  subtitle="Visible to customers and used in their chat answers"
                  data={data.public}
                />
              )}
              {data.private && (
                <Section
                  tone="private"
                  title="Private"
                  subtitle="Owner / staff only. Never exposed to customer chat."
                  data={data.private}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  tone,
  title,
  subtitle,
  data,
}: {
  tone: "public" | "private";
  title: string;
  subtitle: string;
  data: any;
}) {
  const Icon = tone === "public" ? Globe : Lock;
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        tone === "public"
          ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-900/20"
          : "border-amber-200 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-900/20",
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <Icon className={cn("h-4 w-4", tone === "public" ? "text-emerald-600" : "text-amber-700")} />
        <span className="font-semibold text-ink-900 dark:text-ink-100">{title}</span>
        <Badge tone={tone === "public" ? "success" : "warning"}>
          {tone === "public" ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          {tone === "public" ? "customer-visible" : "owner-only"}
        </Badge>
      </div>
      <p className="mb-3 text-xs text-ink-500">{subtitle}</p>
      <DataRenderer data={data} />
    </div>
  );
}

function DataRenderer({ data }: { data: any }) {
  if (data == null) return <p className="text-sm text-ink-500 italic">empty</p>;
  if (typeof data === "string") {
    return (
      <pre className="whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-ink-700 dark:bg-ink-800 dark:text-ink-200">
        {data}
      </pre>
    );
  }
  if (Array.isArray(data)) {
    if (data.length === 0) return <p className="text-sm text-ink-500 italic">none</p>;
    return (
      <div className="space-y-2">
        {data.map((item, i) => (
          <div key={i} className="rounded-lg bg-white p-3 dark:bg-ink-800">
            <DataRenderer data={item} />
          </div>
        ))}
      </div>
    );
  }
  if (typeof data === "object") {
    const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== "");
    if (entries.length === 0) return <p className="text-sm text-ink-500 italic">empty</p>;
    return (
      <dl className="space-y-2">
        {entries.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[140px_1fr] gap-3 text-sm">
            <dt className="font-mono text-xs text-ink-500">{k}</dt>
            <dd className="min-w-0 break-words text-ink-800 dark:text-ink-200">
              {typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? (
                String(v)
              ) : (
                <div className="rounded bg-ink-50 p-2 dark:bg-ink-900/60">
                  <DataRenderer data={v} />
                </div>
              )}
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return <span>{String(data)}</span>;
}
