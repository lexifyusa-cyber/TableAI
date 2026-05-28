import { Link } from "react-router-dom";
import { MessageSquare, Phone, MapPin, Clock } from "lucide-react";
import type { Tenant } from "@/types/api";
import { Button } from "@/components/ui/Button";

interface Props {
  tenant: Tenant;
  showChatCTA?: boolean;
}

export function BrandHeader({ tenant, showChatCTA = true }: Props) {
  const theme = tenant.brand?.theme ?? null;
  const primary = theme?.palette?.primary || tenant.brand?.primary_color || "#f97316";
  const accent = theme?.palette?.accent || tenant.brand?.accent_color || "#0f172a";
  const heroUrl = theme?.hero_url || null;

  const baseStyle: React.CSSProperties = heroUrl
    ? {
        backgroundImage: `linear-gradient(135deg, ${primary}cc 0%, ${accent}cc 100%), url("${heroUrl}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : {
        background: `linear-gradient(135deg, ${primary} 0%, ${accent} 120%)`,
      };

  return (
    <div className="vibe-card overflow-hidden bg-[var(--tenant-primary)] text-white">
      <div className="relative px-5 py-8 sm:px-8 sm:py-10" style={baseStyle}>
        <div className="flex items-start gap-4">
          {tenant.brand?.logo_url ? (
            <img
              src={tenant.brand.logo_url}
              alt=""
              className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-2 ring-white/30 bg-white/10 backdrop-blur"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-2xl font-bold ring-1 ring-white/25 backdrop-blur">
              {tenant.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="vibe-display truncate text-2xl font-semibold tracking-tight sm:text-3xl">
              {tenant.name}
            </h1>
            {(tenant.ai_config?.tagline || tenant.tagline) && (
              <p className="vibe-body mt-1 text-sm text-white/90 sm:text-base">
                {tenant.ai_config?.tagline || tenant.tagline}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/85 sm:text-sm">
              {tenant.contact?.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {tenant.contact.phone}
                </span>
              )}
              {tenant.contact?.address && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="line-clamp-1">{tenant.contact.address}</span>
                </span>
              )}
              {tenant.hours && Object.keys(tenant.hours).length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Hours available
                </span>
              )}
            </div>
          </div>
          {showChatCTA && (
            <Link to={`/c/${tenant.slug}`} className="hidden shrink-0 sm:block">
              <Button className="bg-white text-ink-900 hover:bg-ink-100">
                <MessageSquare className="h-4 w-4" />
                Chat with us
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
