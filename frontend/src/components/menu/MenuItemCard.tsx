import { Leaf, Flame, Star } from "lucide-react";
import type { MenuItem } from "@/types/api";
import { formatPrice } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

interface Props {
  item: MenuItem;
}

function iconForTag(tag: string) {
  if (tag.includes("vegan") || tag.includes("veg")) return <Leaf className="h-3 w-3" />;
  if (tag.includes("spicy") || tag.includes("hot")) return <Flame className="h-3 w-3" />;
  if (tag.includes("popular") || tag.includes("favorite")) return <Star className="h-3 w-3" />;
  return null;
}

function toneForTag(tag: string): Parameters<typeof Badge>[0]["tone"] {
  if (tag.includes("vegan") || tag.includes("veg")) return "success";
  if (tag.includes("spicy") || tag.includes("hot")) return "danger";
  if (tag.includes("popular")) return "brand";
  return "neutral";
}

export function MenuItemCard({ item }: Props) {
  return (
    <div
      className={cn(
        "group relative flex gap-4 rounded-2xl border border-ink-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md",
        "dark:border-ink-800 dark:bg-ink-900",
        !item.is_available && "opacity-50",
      )}
    >
      {item.image_url && (
        <img
          src={item.image_url}
          alt={item.name}
          className="h-20 w-20 flex-shrink-0 rounded-xl object-cover sm:h-24 sm:w-24"
          loading="lazy"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="truncate text-base font-semibold text-ink-900 dark:text-ink-100">{item.name}</h3>
          {item.price_cents != null && (
            <span className="shrink-0 text-sm font-semibold text-ink-900 dark:text-ink-100">
              {formatPrice(item.price_cents)}
            </span>
          )}
        </div>
        {item.description && (
          <p className="mt-1 line-clamp-2 text-sm text-ink-600 dark:text-ink-300">{item.description}</p>
        )}
        {(item.tags.length > 0 || item.allergens.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.tags.slice(0, 4).map((tag) => (
              <Badge key={tag} tone={toneForTag(tag)}>
                {iconForTag(tag)}
                <span className="capitalize">{tag.replace(/:/g, " ")}</span>
              </Badge>
            ))}
            {item.allergens.slice(0, 2).map((a) => (
              <Badge key={`al-${a}`} tone="warning">
                contains {a}
              </Badge>
            ))}
          </div>
        )}
        {!item.is_available && (
          <Badge tone="danger" className="mt-2">
            Unavailable
          </Badge>
        )}
      </div>
    </div>
  );
}
