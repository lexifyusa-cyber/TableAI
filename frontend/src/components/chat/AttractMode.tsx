import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { MenuResponse, MenuItem } from "@/types/api";
import { formatPrice } from "@/lib/format";

interface Props {
  menu: MenuResponse | null | undefined;
  tenantName: string;
}

/**
 * Auto-rotating showcase for idle chat screens.
 * Picks the most interesting menu items (popular tag first, then alphabetical)
 * and cycles through them every 8 seconds. Pure visual — no input capture.
 */
export function AttractMode({ menu, tenantName }: Props) {
  const featured = useMemo<MenuItem[]>(() => {
    if (!menu) return [];
    const all = menu.categories.flatMap((c) => c.items).filter((i) => i.is_available);
    const popular = all.filter((i) => i.tags.some((t) => t.includes("popular")));
    const rest = all.filter((i) => !popular.includes(i));
    return [...popular, ...rest].slice(0, 6);
  }, [menu]);

  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (featured.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % featured.length), 8000);
    return () => clearInterval(t);
  }, [featured.length]);

  if (featured.length === 0) return null;
  const item = featured[idx];
  if (!item) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-ink-200 bg-gradient-to-br from-ink-900 to-ink-700 p-0 dark:border-ink-700">
      <div className="absolute left-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur">
        <Sparkles className="h-3 w-3" />
        Featured at {tenantName}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.5 }}
          className="flex min-h-[180px] flex-col justify-end p-5"
        >
          {item.image_url && (
            <img
              src={item.image_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-30"
            />
          )}
          <div className="relative">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-xl font-semibold text-white">{item.name}</h3>
              {item.price_cents != null && (
                <span className="text-lg font-semibold text-brand-400">
                  {formatPrice(item.price_cents)}
                </span>
              )}
            </div>
            {item.description && (
              <p className="mt-1 line-clamp-2 text-sm text-white/80">{item.description}</p>
            )}
            {item.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wider text-white/90"
                  >
                    {tag.replace(/:/g, " ")}
                  </span>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Progress dots */}
      <div className="absolute bottom-3 right-4 flex gap-1">
        {featured.map((_, i) => (
          <span
            key={i}
            className={`h-1 rounded-full transition-all ${i === idx ? "w-6 bg-white" : "w-1 bg-white/30"}`}
          />
        ))}
      </div>
    </div>
  );
}
