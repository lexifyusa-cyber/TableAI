import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  ChevronDown,
  Clock,
  MapPin,
  MessageSquare,
  Phone,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { useMenu } from "@/hooks/useMenu";
import { useTenantTheme } from "@/hooks/useTenantTheme";
import { useTenantStore } from "@/stores/tenant";
import type { MenuCategory, MenuItem, Tenant } from "@/types/api";
import { cn } from "@/lib/cn";


const DAY_ORDER = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];

function formatIntervals(intervals: Array<{ open: string; close: string }>): string {
  if (!intervals || intervals.length === 0) return "Closed";
  return intervals.map((iv) => `${iv.open} – ${iv.close}`).join(", ");
}

export function PublicMenuPageModern() {
  const { slug } = useParams<{ slug: string }>();
  const setSlug = useTenantStore((s) => s.setSlug);
  const { data, isLoading, error } = useMenu(slug);
  const [activeTag, setActiveTag] = useState<string>("all");

  useTenantTheme(data?.tenant);
  useEffect(() => {
    if (slug) setSlug(slug);
  }, [slug, setSlug]);

  const allTags = useMemo(() => {
    if (!data) return [] as string[];
    const set = new Set<string>();
    data.categories.forEach((c) => c.items.forEach((i) => i.tags.forEach((t) => set.add(t))));
    return Array.from(set).sort();
  }, [data]);

  if (isLoading || !data) {
    return (
      <div className="min-h-svh bg-[var(--tenant-surface,#fafaf7)]">
        <div className="h-14 border-b border-ink-200/60 bg-white/80" />
        <div className="h-[60svh] animate-pulse bg-ink-200/40" />
        <div className="mx-auto max-w-3xl px-5 py-10 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-ink-200/40" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid min-h-svh place-items-center bg-ink-50 p-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold">Menu not found</h2>
          <p className="mt-2 text-ink-500">Couldn\'t load &ldquo;{slug}&rdquo;.</p>
          <Link to="/" className="mt-6 inline-block text-sm font-medium underline">Back to home</Link>
        </div>
      </div>
    );
  }

  const { tenant, categories } = data;
  const visibleCategories =
    activeTag === "all"
      ? categories
      : categories
          .map((c) => ({ ...c, items: c.items.filter((i) => i.tags.includes(activeTag)) }))
          .filter((c) => c.items.length > 0);

  return (
    <div
      className="min-h-svh bg-[var(--tenant-surface,#fafaf7)] text-[var(--tenant-ink,#0f172a)]"
      style={{ fontFamily: "var(--tenant-font-body, ui-sans-serif, system-ui, sans-serif)" }}
    >
      <SlimHeader tenant={tenant} />
      <Hero tenant={tenant} />
      <StickyFilters tags={allTags} active={activeTag} onChange={setActiveTag} />
      <main id="menu" className="mx-auto max-w-3xl px-5 sm:px-8 pb-24 pt-2">
        {visibleCategories.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-ink-500">No items match this filter.</p>
            <button
              onClick={() => setActiveTag("all")}
              className="mt-4 text-sm font-medium underline underline-offset-4"
            >
              Show all items
            </button>
          </div>
        ) : (
          visibleCategories.map((cat) => <CategorySection key={cat.id} category={cat} />)
        )}
      </main>
      <RestaurantFooter tenant={tenant} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Slim customer-only header — no admin chrome.                              */
/* -------------------------------------------------------------------------- */
function SlimHeader({ tenant }: { tenant: Tenant }) {
  const logo = tenant.brand?.logo_url;
  return (
    <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-[var(--tenant-surface,#fafaf7)]/85 backdrop-blur supports-[backdrop-filter]:bg-[var(--tenant-surface,#fafaf7)]/70">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5 min-w-0">
          {logo ? (
            <img src={logo} alt="" className="h-8 w-8 rounded-xl object-cover ring-1 ring-black/5" />
          ) : (
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--tenant-primary,#0f172a)] text-white">
              <UtensilsCrossed className="h-4 w-4" />
            </div>
          )}
          <span className="truncate text-sm font-semibold tracking-tight" style={{ fontFamily: "var(--tenant-font-display, inherit)" }}>
            {tenant.name}
          </span>
        </Link>
        <Link
          to={`/c/${tenant.slug}`}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[var(--tenant-primary,#0f172a)] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Chat
        </Link>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero — photo background w/ overlay text if hero_url; clean tinted text else. */
/* -------------------------------------------------------------------------- */
function Hero({ tenant }: { tenant: Tenant }) {
  const heroPath = (tenant.brand?.theme as Record<string, unknown> | undefined)?.hero_path as string | undefined;
  const heroUrl = heroPath ? `/static/media/${heroPath}` : (tenant.brand?.theme?.hero_url || null);
  const tagline = tenant.tagline || tenant.ai_persona || "";

  if (heroUrl) {
    return (
      <section className="relative isolate h-[62svh] min-h-[440px] sm:h-[72svh] sm:min-h-[560px] overflow-hidden">
        <img src={heroUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/80" />
        <div className="relative mx-auto flex h-full max-w-3xl flex-col justify-end px-5 pb-12 sm:px-8 sm:pb-16 text-white">
          <div className="mb-4 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] opacity-80">
            <span className="h-px w-6 bg-white/60" />
            Restaurant
          </div>
          <h1
            className="text-[clamp(2.4rem,6vw,4.5rem)] font-bold leading-[1.02] tracking-tight"
            style={{ fontFamily: "var(--tenant-font-display, ui-serif, Georgia, serif)" }}
          >
            {tenant.name}
          </h1>
          {tagline && (
            <p className="mt-4 max-w-xl text-base sm:text-lg leading-snug text-white/90">
              {tagline}
            </p>
          )}
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to={`/c/${tenant.slug}`}
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink-900 transition hover:bg-white/90"
            >
              <Sparkles className="h-4 w-4" />
              Ask the AI
            </Link>
            <a
              href="#menu"
              className="inline-flex items-center gap-2 rounded-full border border-white/35 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Browse menu
              <ChevronDown className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="relative isolate overflow-hidden border-b border-black/[0.04]"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in oklab, var(--tenant-primary, #0f172a) 8%, var(--tenant-surface, #fafaf7)) 0%, var(--tenant-surface, #fafaf7) 100%)",
      }}
    >
      <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8 sm:py-28 text-center">
        <div className="mb-5 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-ink-500">
          <span className="h-px w-6 bg-ink-400" />
          Restaurant
        </div>
        <h1
          className="text-[clamp(2.4rem,6vw,4.5rem)] font-bold leading-[1.02] tracking-tight text-ink-900"
          style={{ fontFamily: "var(--tenant-font-display, ui-serif, Georgia, serif)" }}
        >
          {tenant.name}
        </h1>
        {tagline && (
          <p className="mx-auto mt-5 max-w-xl text-base sm:text-lg leading-snug text-ink-600">
            {tagline}
          </p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to={`/c/${tenant.slug}`}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--tenant-primary,#0f172a)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <Sparkles className="h-4 w-4" />
            Ask the AI
          </Link>
          <a
            href="#menu"
            className="inline-flex items-center gap-2 rounded-full border border-ink-300 px-5 py-2.5 text-sm font-semibold text-ink-700 transition hover:bg-ink-100"
          >
            Browse menu
            <ChevronDown className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sticky filter chip bar.                                                    */
/* -------------------------------------------------------------------------- */
function StickyFilters({
  tags,
  active,
  onChange,
}: {
  tags: string[];
  active: string;
  onChange: (t: string) => void;
}) {
  const items = ["all", ...tags];
  return (
    <div className="sticky top-14 z-20 border-b border-black/[0.06] bg-[var(--tenant-surface,#fafaf7)]/90 backdrop-blur">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto py-3 scrollbar-none">
          {items.map((t) => {
            const isActive = t === active;
            return (
              <button
                key={t}
                onClick={() => onChange(t)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition",
                  isActive
                    ? "bg-[var(--tenant-primary,#0f172a)] text-white"
                    : "border border-ink-200 bg-white text-ink-700 hover:border-ink-300",
                )}
              >
                {t === "all" ? "All" : t}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Category section + item rows.                                              */
/* -------------------------------------------------------------------------- */
function CategorySection({ category }: { category: MenuCategory }) {
  return (
    <section className="mt-12 first:mt-8">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2
          className="text-2xl sm:text-3xl font-semibold tracking-tight"
          style={{ fontFamily: "var(--tenant-font-display, ui-serif, Georgia, serif)" }}
        >
          {category.name}
        </h2>
      </div>
      {category.description && (
        <p className="mb-5 text-sm text-ink-500 max-w-prose">{category.description}</p>
      )}
      <ul className="divide-y divide-black/[0.06] rounded-3xl border border-black/[0.06] bg-white/60 backdrop-blur-sm overflow-hidden">
        {category.items.map((item) => (
          <ItemRow key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

function formatPrice(cents?: number | null): string | null {
  if (cents == null) return null;
  const dollars = cents / 100;
  return dollars >= 100
    ? `$${dollars.toFixed(0)}`
    : `$${dollars.toFixed(2)}`;
}

const POSITIVE_TAGS = new Set(["popular", "new", "signature", "chef-special", "vegan", "vegetarian", "gluten-free", "spicy"]);

function ItemRow({ item }: { item: MenuItem }) {
  const price = formatPrice(item.price_cents);
  const positive = item.tags.filter((t) => POSITIVE_TAGS.has(t.toLowerCase()));
  const allergens = (item.allergens ?? []).slice(0, 3);

  return (
    <li className="flex gap-4 p-4 sm:p-5">
      <div className="shrink-0">
        {(item.image_path || item.image_url) ? (
          <img
            src={item.image_path ? `/static/media/${item.image_path}` : item.image_url!}
            alt=""
            className="h-20 w-20 rounded-2xl object-cover ring-1 ring-black/5 sm:h-24 sm:w-24"
            loading="lazy"
          />
        ) : (
          <div
            className="grid h-20 w-20 place-items-center rounded-2xl sm:h-24 sm:w-24"
            style={{
              background:
                "color-mix(in oklab, var(--tenant-primary, #0f172a) 10%, var(--tenant-surface, #fafaf7))",
              color: "var(--tenant-primary, #0f172a)",
            }}
          >
            <UtensilsCrossed className="h-7 w-7 opacity-50" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <h3 className="flex-1 font-semibold tracking-tight text-ink-900">{item.name}</h3>
          {price && (
            <span className="shrink-0 text-sm font-semibold text-ink-900 tabular-nums">{price}</span>
          )}
        </div>
        {item.description && (
          <p className="mt-1 line-clamp-2 text-sm leading-snug text-ink-500">{item.description}</p>
        )}
        {(positive.length > 0 || allergens.length > 0) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {positive.map((t) => (
              <span
                key={t}
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{
                  background: "color-mix(in oklab, var(--tenant-primary, #0f172a) 14%, transparent)",
                  color: "var(--tenant-primary, #0f172a)",
                }}
              >
                {t}
              </span>
            ))}
            {allergens.length > 0 && (
              <span className="text-[10px] text-ink-400" title={`Allergens: ${item.allergens.join(", ")}`}>
                {allergens.length === item.allergens.length
                  ? `contains ${item.allergens.join(" · ")}`
                  : `contains ${allergens.join(" · ")} +${item.allergens.length - allergens.length}`}
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/*  Footer: hours · contact · AI tile.                                         */
/* -------------------------------------------------------------------------- */
function RestaurantFooter({ tenant }: { tenant: Tenant }) {
  const hoursMap = (tenant.hours || {}) as Record<string, Array<{ open: string; close: string }>>;
  const hours = hoursMap;
  const contact = tenant.contact as
    | { phone?: string; email?: string; address?: string; instagram?: string; website?: string }
    | undefined;

  const hasHours = hours && Object.keys(hours).length > 0;
  const hasContact = contact && Object.keys(contact).length > 0;

  return (
    <footer className="mt-12 border-t border-black/[0.06] bg-white/40 backdrop-blur-sm">
      <div className="mx-auto grid max-w-3xl gap-8 px-5 py-12 sm:grid-cols-3 sm:px-8 sm:py-16">
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">Hours</h4>
          {hasHours ? (
            <>
              <ProvenancePill prov={tenant.provenance?.["hours"]?.source} />
              <dl className="mt-3 space-y-1 text-sm">
              {DAY_ORDER.map((day) => {
                const intervals = hoursMap[day] || [];
                return (
                  <div key={day} className="flex justify-between gap-3">
                    <dt className="capitalize text-ink-600">{day}</dt>
                    <dd className="text-ink-900">{formatIntervals(intervals)}</dd>
                  </div>
                );
              })}
            </dl>
            </>
          ) : (
            <p className="mt-3 text-sm leading-snug text-ink-500">
              Hours not listed.{" "}
              <Link to={`/c/${tenant.slug}`} className="font-medium text-ink-900 underline underline-offset-4">
                Ask the AI
              </Link>
              .
            </p>
          )}
        </div>

        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">Contact</h4>
          {hasContact ? (
            <>
              <ProvenancePill prov={tenant.provenance?.["contact.address"]?.source || tenant.provenance?.["contact.phone"]?.source} />
              <ul className="mt-3 space-y-2 text-sm">
              {contact?.address && (
                <li className="flex items-start gap-2 text-ink-700">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span>{contact.address}</span>
                </li>
              )}
              {contact?.phone && (
                <li className="flex items-start gap-2 text-ink-700">
                  <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />
                  <a href={`tel:${contact.phone}`} className="hover:underline">{contact.phone}</a>
                </li>
              )}
              {contact?.email && (
                <li className="flex items-start gap-2 text-ink-700">
                  <span className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60">@</span>
                  <a href={`mailto:${contact.email}`} className="hover:underline">{contact.email}</a>
                </li>
              )}
              {contact?.website && (
                <li className="flex items-start gap-2 text-ink-700">
                  <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" />
                  <a href={contact.website} target="_blank" rel="noreferrer" className="hover:underline">Website</a>
                </li>
              )}
            </ul>
            </>
          ) : (
            <p className="mt-3 text-sm leading-snug text-ink-500">
              Contact details not listed.
            </p>
          )}
        </div>

        <div
          className="rounded-3xl p-5 sm:col-span-1"
          style={{
            background:
              "linear-gradient(160deg, color-mix(in oklab, var(--tenant-primary, #0f172a) 18%, var(--tenant-surface, #fafaf7)) 0%, var(--tenant-surface, #fafaf7) 100%)",
          }}
        >
          <Clock className="h-5 w-5" style={{ color: "var(--tenant-primary, #0f172a)" }} />
          <h4
            className="mt-3 text-lg font-semibold leading-tight"
            style={{ fontFamily: "var(--tenant-font-display, inherit)" }}
          >
            Have a question?
          </h4>
          <p className="mt-1 text-sm leading-snug text-ink-600">
            Our AI knows every dish, allergen, and spice level.
          </p>
          <Link
            to={`/c/${tenant.slug}`}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--tenant-primary,#0f172a)] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Start chat
          </Link>
        </div>
      </div>
      <div className="border-t border-black/[0.04]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-5 text-[11px] text-ink-400 sm:px-8">
          <span>Powered by TableAI</span>
          <span>{new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}


function ProvenancePill({ prov }: { prov?: string }) {
  if (!prov) return null;
  const labels: Record<string, string> = {
    website: "from website",
    google_places_business: "from Google",
    google_places_photo: "from Google",
    yelp_business: "from Yelp",
    doordash_consumer: "from DoorDash",
    ubereats_consumer: "from UberEats",
    vision_ocr: "from menu photo",
    manual_owner_input: "edited by owner",
  };
  return (
    <span className="inline-flex items-center rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-500">
      {labels[prov] || prov}
    </span>
  );
}
