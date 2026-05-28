import { useState } from "react";
import {
  Boxes,
  CalendarDays,
  CheckCircle2,
  MessageCircle,
  Package,
  Sparkles,
  Star,
  Store,
  UserCircle2,
  UtensilsCrossed,
} from "lucide-react";
import { useKnowledge, type BucketKind, type BucketEntry } from "@/hooks/useKnowledge";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/format";
import { BucketDetailModal } from "./BucketDetailModal";

const META: Record<BucketKind, { label: string; icon: typeof Sparkles; blurb: string }> = {
  menu: { label: "Menu", icon: UtensilsCrossed, blurb: "Items, prices, allergens, tags" },
  business: { label: "Business", icon: Store, blurb: "Name, hours, contact, persona" },
  reputation: { label: "Reputation", icon: Star, blurb: "Reviews, ratings, popular dishes" },
  calendar: { label: "Timeline", icon: CalendarDays, blurb: "Holidays, season, time awareness" },
  social: { label: "Social", icon: Sparkles, blurb: "Instagram, TikTok presence" },
  operational: { label: "Operational", icon: Package, blurb: "Inventory, 86'd items, live menu" },
  local: { label: "Local", icon: Boxes, blurb: "Weather, events, competitors" },
  customer: { label: "Customer", icon: UserCircle2, blurb: "Chat history, preferences" },
};

const ORDER: BucketKind[] = [
  "business",
  "menu",
  "reputation",
  "calendar",
  "social",
  "operational",
  "local",
  "customer",
];

export function KnowledgeBuckets({ slug }: { slug: string | null | undefined }) {
  const { data, isLoading } = useKnowledge(slug);
  const [openKind, setOpenKind] = useState<BucketKind | null>(null);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Knowledge buckets
            </CardTitle>
            <CardDescription>
              What the AI knows about this tenant. Click any bucket to inspect public vs private data.
            </CardDescription>
          </div>
          {data && (
            <Badge tone="neutral">
              {data.buckets.filter((b) => b.active).length} / {data.buckets.length} active
            </Badge>
          )}
        </CardHeader>
        <CardBody>
          {isLoading || !data ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {ORDER.map((kind) => {
                const bucket = data.buckets.find((b) => b.kind === kind);
                return (
                  <BucketCard
                    key={kind}
                    kind={kind}
                    bucket={bucket}
                    onClick={() => setOpenKind(kind)}
                  />
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      <BucketDetailModal slug={slug} kind={openKind} onClose={() => setOpenKind(null)} />
    </>
  );
}

function BucketCard({
  kind,
  bucket,
  onClick,
}: {
  kind: BucketKind;
  bucket: BucketEntry | undefined;
  onClick: () => void;
}) {
  const meta = META[kind];
  const Icon = meta.icon;
  const active = !!bucket?.active;
  return (
    <button
      onClick={onClick}
      className={cn(
        "group rounded-xl border p-3 text-left transition-all hover:shadow-md",
        active
          ? "border-emerald-200 bg-emerald-50/40 hover:border-emerald-400 dark:border-emerald-900 dark:bg-emerald-900/20"
          : "border-ink-200 bg-ink-50/40 hover:border-ink-300 dark:border-ink-800 dark:bg-ink-800/20",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            active
              ? "bg-emerald-500 text-white"
              : "bg-ink-200 text-ink-500 dark:bg-ink-700",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        {active && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
      </div>
      <div className="mt-2">
        <div className="text-sm font-semibold text-ink-900 dark:text-ink-100">{meta.label}</div>
        <div className="mt-0.5 text-xs text-ink-500 line-clamp-2">{meta.blurb}</div>
      </div>
      <div className="mt-2 text-xs">
        {bucket?.summary ? (
          <span className="text-ink-700 dark:text-ink-300">{bucket.summary}</span>
        ) : bucket?.unlock_hint ? (
          <span className="text-ink-500 italic">{bucket.unlock_hint}</span>
        ) : null}
      </div>
      {bucket?.source && bucket?.fetched_at && (
        <div className="mt-1 text-[11px] text-ink-400">
          {bucket.source} · {formatRelativeTime(bucket.fetched_at)}
        </div>
      )}
    </button>
  );
}
