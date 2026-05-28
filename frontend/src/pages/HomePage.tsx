import { Link } from "react-router-dom";
import { ArrowRight, MessageSquare, Sparkles, UtensilsCrossed, Zap } from "lucide-react";
import { useTenants } from "@/hooks/useTenants";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTenantStore } from "@/stores/tenant";

export function HomePage() {
  const { data: tenants, isLoading } = useTenants();
  const setSlug = useTenantStore((s) => s.setSlug);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900 px-6 py-12 text-white sm:px-10 sm:py-16">
        <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(60% 80% at 80% 0%, #f97316 0%, transparent 60%)" }} />
        <div className="relative max-w-3xl">
          <Badge tone="brand" className="mb-4">
            <Zap className="h-3 w-3" />
            AI for small businesses
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Every storefront, <span className="text-gradient">chatting back</span>.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-300">
            Scrape a website, build an AI assistant, hand over a tablet. TableAI is the sales demo, the
            customer chat, and the owner dashboard — all in one.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/demo">
              <Button size="lg" className="bg-white text-ink-900 hover:bg-ink-100">
                <Sparkles className="h-4 w-4" />
                Generate a demo
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button size="lg" variant="ghost" className="text-white hover:bg-white/10">
                Owner dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Tenants */}
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold text-ink-900 dark:text-ink-100">Live demos</h2>
            <p className="text-sm text-ink-500">Pick a tenant to browse its menu or chat with its AI.</p>
          </div>
          <Link to="/demo" className="hidden text-sm font-medium text-brand-600 hover:text-brand-700 sm:inline">
            + New demo
          </Link>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
        ) : !tenants || tenants.length === 0 ? (
          <Card>
            <CardBody className="py-12 text-center">
              <UtensilsCrossed className="mx-auto h-10 w-10 text-ink-300" />
              <h3 className="mt-3 text-base font-semibold">No demos yet</h3>
              <p className="mt-1 text-sm text-ink-500">Generate your first tenant to see it here.</p>
              <Link to="/demo" className="mt-4 inline-block">
                <Button>
                  <Sparkles className="h-4 w-4" />
                  Generate demo
                </Button>
              </Link>
            </CardBody>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tenants.map((t) => {
              const primary = t.brand?.primary_color || "#f97316";
              return (
                <Card key={t.id} className="overflow-hidden transition-shadow hover:shadow-md">
                  <div className="h-1" style={{ backgroundColor: primary }} />
                  <CardBody>
                    <div className="flex items-start gap-3">
                      {t.brand?.logo_url ? (
                        <img src={t.brand.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white text-sm font-bold"
                          style={{ backgroundColor: primary }}
                        >
                          {t.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-base font-semibold text-ink-900 dark:text-ink-100">{t.name}</h3>
                        </div>
                        <p className="mt-0.5 text-xs text-ink-500 capitalize">
                          {t.business_type} · /{t.slug}
                        </p>
                      </div>
                    </div>
                    {t.ai_config?.tagline || t.tagline ? (
                      <p className="mt-3 line-clamp-2 text-sm text-ink-600 dark:text-ink-300">
                        {t.ai_config?.tagline || t.tagline}
                      </p>
                    ) : null}
                    <div className="mt-4 flex gap-2">
                      <Link to={`/m/${t.slug}`} className="flex-1" onClick={() => setSlug(t.slug)}>
                        <Button variant="secondary" size="sm" className="w-full">
                          <UtensilsCrossed className="h-4 w-4" />
                          Menu
                        </Button>
                      </Link>
                      <Link to={`/c/${t.slug}`} className="flex-1" onClick={() => setSlug(t.slug)}>
                        <Button size="sm" className="w-full" variant="tenant">
                          <MessageSquare className="h-4 w-4" />
                          Chat
                        </Button>
                      </Link>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Feature strip */}
      <section className="mt-12 grid gap-4 sm:grid-cols-3">
        <FeatureCard
          icon={<Sparkles className="h-5 w-5" />}
          title="AI-built demos"
          body="Paste a URL — Claude scrapes, structures, and stages a full tenant in ~30s."
        />
        <FeatureCard
          icon={<MessageSquare className="h-5 w-5" />}
          title="Real-time chat"
          body="Server-sent events stream Claude's response token-by-token with a warmed menu cache."
        />
        <FeatureCard
          icon={<UtensilsCrossed className="h-5 w-5" />}
          title="Multi-tenant by design"
          body="One codebase, every storefront. Isolated data, per-tenant theming, shared intelligence."
        />
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <Card>
      <CardBody>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-900 text-white dark:bg-white dark:text-ink-900">
          {icon}
        </div>
        <h3 className="mt-3 font-semibold text-ink-900 dark:text-ink-100">{title}</h3>
        <p className="mt-1 text-sm text-ink-500">{body}</p>
      </CardBody>
    </Card>
  );
}
