import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { MenuItemCard } from "@/components/menu/MenuItemCard";
import { Button } from "@/components/ui/Button";
import { useTenantStore } from "@/stores/tenant";
import { useTenants } from "@/hooks/useTenants";
import { useMenu } from "@/hooks/useMenu";

export function DashboardMenuPage() {
  const currentSlug = useTenantStore((s) => s.currentSlug);
  const { data: tenants } = useTenants();
  const tenant = tenants?.find((t) => t.slug === currentSlug) ?? tenants?.[0];
  const slug = tenant?.slug ?? null;
  const { data: menu, isLoading } = useMenu(slug);

  return (
    <DashboardShell>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-100">Menu</h1>
          <p className="mt-1 text-sm text-ink-500">
            Read-only view of {tenant?.name ?? "your tenant"}'s menu as it appears to customers.
          </p>
        </div>
        {slug && (
          <Link to={`/m/${slug}`}>
            <Button variant="secondary">
              View public page
              <ExternalLink className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>

      {!tenant ? (
        <EmptyState title="No tenant selected" description="Pick one from the switcher." />
      ) : isLoading || !menu ? (
        <div className="space-y-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-40" />
        </div>
      ) : menu.categories.length === 0 ? (
        <EmptyState title="No menu items" description="Generate a demo to populate the menu." />
      ) : (
        <div className="space-y-8">
          {menu.categories.map((cat) => (
            <Card key={cat.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{cat.name}</CardTitle>
                    {cat.description && <CardDescription>{cat.description}</CardDescription>}
                  </div>
                  <Badge>{cat.items.length} items</Badge>
                </div>
              </CardHeader>
              <CardBody>
                <div className="grid gap-3 sm:grid-cols-2">
                  {cat.items.map((item) => (
                    <MenuItemCard key={item.id} item={item} />
                  ))}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
