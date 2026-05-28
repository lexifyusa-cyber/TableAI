import { useMemo, useState } from "react";
import { Flame, Send } from "lucide-react";
import type { MenuResponse, MenuItem } from "@/types/api";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";

interface Props {
  menu: MenuResponse | null | undefined;
  tenantName: string;
  onPickDish: (dishName: string) => void;
}

const LEVELS = [
  { n: 1, label: "Mild", blurb: "barely a whisper of heat" },
  { n: 2, label: "Gentle", blurb: "pleasantly warm" },
  { n: 3, label: "Medium", blurb: "a real kick" },
  { n: 4, label: "Hot", blurb: "you'll sweat" },
  { n: 5, label: "Fire", blurb: "challenge accepted" },
] as const;

function spiceLevel(item: MenuItem): number {
  const mildHints = ["mild", "no spice", "child"];
  const hotHints = ["fire", "ghost", "devil", "extra hot"];
  for (const tag of item.tags) {
    if (tag.startsWith("spicy:")) return Math.min(5, Math.max(1, parseInt(tag.split(":")[1] || "0")));
    if (tag === "mild") return 1;
    if (tag === "spicy") return 3;
    if (tag === "hot") return 4;
  }
  const hay = (item.name + " " + (item.description ?? "")).toLowerCase();
  if (mildHints.some((h) => hay.includes(h))) return 1;
  if (hotHints.some((h) => hay.includes(h))) return 5;
  if (/vindaloo|phaal|madras|nashville/.test(hay)) return 4;
  if (/jalapeño|chili|chipotle|sriracha|buffalo/.test(hay)) return 3;
  return 0;
}

function pickDishAt(menu: MenuResponse | null | undefined, level: number): MenuItem | null {
  if (!menu) return null;
  const all = menu.categories.flatMap((c) => c.items).filter((i) => i.is_available);
  const scored = all
    .map((i) => ({ i, s: spiceLevel(i) }))
    .filter((x) => x.s === level);
  if (scored.length === 0) {
    // Fallback: closest level above 0
    const closest = all
      .map((i) => ({ i, s: spiceLevel(i) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => Math.abs(a.s - level) - Math.abs(b.s - level));
    return closest[0]?.i ?? null;
  }
  return scored[Math.floor(Math.random() * scored.length)].i;
}

export function SpiceTrustFall({ menu, tenantName, onPickDish }: Props) {
  const [level, setLevel] = useState<number>(3);
  const dish = useMemo(() => pickDishAt(menu, level), [menu, level]);

  return (
    <Card className="border-brand-200 bg-gradient-to-br from-brand-50/50 to-white dark:from-brand-900/20 dark:to-ink-900">
      <CardBody>
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white">
            <Flame className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-ink-900 dark:text-ink-100">
              Spice Trust Fall
            </h3>
            <p className="text-xs text-ink-500">
              How hot can you go? Slide to your level and we'll pick a dish from {tenantName}.
            </p>
          </div>
        </div>

        {/* Level picker */}
        <div className="mt-4 grid grid-cols-5 gap-1.5">
          {LEVELS.map((L) => {
            const active = level === L.n;
            return (
              <button
                key={L.n}
                onClick={() => setLevel(L.n)}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2 transition-all",
                  active
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-ink-200 bg-white text-ink-700 hover:border-brand-300 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200",
                )}
                aria-label={`Spice level ${L.n} – ${L.label}`}
              >
                <div className="flex">
                  {Array.from({ length: L.n }).map((_, i) => (
                    <Flame key={i} className="h-3 w-3" />
                  ))}
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider">{L.label}</span>
              </button>
            );
          })}
        </div>

        {/* Recommendation */}
        <div className="mt-4 rounded-xl border border-ink-200 bg-white p-3 dark:border-ink-700 dark:bg-ink-800">
          {dish ? (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-semibold text-ink-900 dark:text-ink-100">{dish.name}</div>
                {dish.price_cents != null && (
                  <span className="text-sm font-semibold text-ink-900 dark:text-ink-100">
                    {formatPrice(dish.price_cents)}
                  </span>
                )}
              </div>
              {dish.description && (
                <p className="mt-0.5 line-clamp-2 text-sm text-ink-600 dark:text-ink-300">
                  {dish.description}
                </p>
              )}
              <p className="mt-2 text-xs italic text-ink-500">
                Our pick at level {level} · {LEVELS[level - 1].blurb}
              </p>
              <Button
                size="sm"
                className="mt-3 w-full"
                variant="tenant"
                onClick={() => onPickDish(dish.name)}
              >
                <Send className="h-3.5 w-3.5" />
                Tell me more about this
              </Button>
            </>
          ) : (
            <p className="text-sm text-ink-500">
              No dishes tagged at this level yet — try another number.
            </p>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
