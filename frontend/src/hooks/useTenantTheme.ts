import { useEffect } from "react";
import type { Tenant, TenantVibe } from "@/types/api";

const VIBES: ReadonlyArray<TenantVibe> = [
  "fine-dining",
  "casual-modern",
  "rustic-warm",
  "street-fast",
  "cafe-bright",
  "bar-night",
];

function isVibe(v: unknown): v is TenantVibe {
  return typeof v === "string" && (VIBES as readonly string[]).includes(v);
}

function injectFontLink(display?: string | null, body?: string | null) {
  const id = "tenant-fonts-link";
  let link = document.getElementById(id) as HTMLLinkElement | null;
  const params: string[] = [];
  const seen = new Set<string>();
  for (const fam of [display, body]) {
    if (!fam) continue;
    const f = fam.trim();
    if (!f || seen.has(f)) continue;
    seen.add(f);
    params.push(`family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700`);
  }
  if (params.length === 0) {
    if (link) link.remove();
    return;
  }
  const href = `https://fonts.googleapis.com/css2?${params.join("&")}&display=swap`;
  if (!link) {
    link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  if (link.href !== href) link.href = href;
}

/**
 * Reads tenant.brand + tenant.brand.theme and applies a tenant-specific
 * visual identity to the document: palette as CSS vars, vibe as a data attribute
 * (which drives radii/shadow presets via CSS), Google Fonts loaded on demand,
 * and an optional hero backdrop image.
 *
 * Resets everything on unmount so admin pages aren't tinted by the last tenant viewed.
 */
export function useTenantTheme(tenant: Tenant | null | undefined) {
  useEffect(() => {
    const root = document.documentElement;
    const brand = tenant?.brand ?? null;
    const theme = brand?.theme ?? null;
    const palette = theme?.palette ?? null;

    const primary = palette?.primary || brand?.primary_color || "#f97316";
    const accent = palette?.accent || brand?.accent_color || "#0f172a";
    const surface = palette?.surface || brand?.background_color || "#ffffff";
    const ink = palette?.ink || "#0f172a";

    root.style.setProperty("--tenant-primary", primary);
    root.style.setProperty("--tenant-accent", accent);
    root.style.setProperty("--tenant-bg", surface);
    root.style.setProperty("--tenant-surface", surface);
    root.style.setProperty("--tenant-ink", ink);

    const display = theme?.fonts?.display ?? null;
    const body = theme?.fonts?.body ?? null;
    if (display) {
      root.style.setProperty("--tenant-font-display", `'${display}', ui-serif, Georgia, serif`);
    } else {
      root.style.removeProperty("--tenant-font-display");
    }
    if (body) {
      root.style.setProperty("--tenant-font-body", `'${body}', ui-sans-serif, system-ui, sans-serif`);
    } else {
      root.style.removeProperty("--tenant-font-body");
    }
    if (display || body) injectFontLink(display, body);

    if (isVibe(theme?.vibe ?? "")) {
      root.dataset.vibe = theme!.vibe as string;
    } else {
      delete root.dataset.vibe;
    }

    if (theme?.hero_url) {
      root.style.setProperty("--tenant-hero", `url("${theme.hero_url}")`);
    } else {
      root.style.removeProperty("--tenant-hero");
    }

    return () => {
      // Reset on unmount so admin pages stay neutral.
      root.style.setProperty("--tenant-primary", "#f97316");
      root.style.setProperty("--tenant-accent", "#0f172a");
      root.style.setProperty("--tenant-bg", "#ffffff");
      root.style.removeProperty("--tenant-surface");
      root.style.removeProperty("--tenant-ink");
      root.style.removeProperty("--tenant-font-display");
      root.style.removeProperty("--tenant-font-body");
      root.style.removeProperty("--tenant-hero");
      delete root.dataset.vibe;
    };
  }, [tenant]);
}
