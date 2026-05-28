import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "@/lib/api";

export type BucketKind =
  | "menu"
  | "business"
  | "reputation"
  | "social"
  | "operational"
  | "local"
  | "customer"
  | "calendar";

export interface BucketEntry {
  kind: BucketKind;
  active: boolean;
  source?: string | null;
  fetched_at?: string | null;
  summary?: string | null;
  unlock_hint?: string | null;
}

export interface KnowledgeResponse {
  tenant: string;
  buckets: BucketEntry[];
}

export function useKnowledge(slug: string | null | undefined) {
  return useQuery({
    queryKey: ["knowledge", slug],
    queryFn: () =>
      request<KnowledgeResponse>(`/api/tenant/knowledge?tenant=${encodeURIComponent(slug!)}`),
    enabled: !!slug,
    staleTime: 30_000,
  });
}

export interface BucketDetail {
  kind: BucketKind;
  public?: Record<string, any> | any[] | null;
  private?: Record<string, any> | any[] | null;
  source?: string | null;
  fetched_at?: string | null;
}

export function useBucketDetail(slug: string | null | undefined, kind: BucketKind | null) {
  return useQuery({
    queryKey: ["bucket-detail", slug, kind],
    queryFn: () =>
      request<BucketDetail>(
        `/api/tenant/knowledge/${kind}?tenant=${encodeURIComponent(slug!)}`,
      ),
    enabled: !!slug && !!kind,
  });
}

export interface CulturalUpdate {
  country_code?: string | null;
  cultural_context?: Record<string, any>;
}

export interface PublicTimeline {
  tenant: string;
  public: {
    today: string;
    season: string;
    next_holiday: {
      name: string;
      date: string;
      days_away: number;
      emoji: string | null;
      theme_accent: string | null;
    } | null;
  };
}

export function useTimeline(slug: string | null | undefined) {
  return useQuery({
    queryKey: ["timeline", slug],
    queryFn: () =>
      request<PublicTimeline>(`/api/tenant/timeline?tenant=${encodeURIComponent(slug!)}`),
    enabled: !!slug,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateCultural() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { slug: string } & CulturalUpdate) =>
      request<{ slug: string; country_code: string | null; cultural_context: any }>(
        `/api/admin/tenants/${body.slug}/cultural`,
        {
          method: "PATCH",
          body: JSON.stringify({
            country_code: body.country_code,
            cultural_context: body.cultural_context,
          }),
        },
      ),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["knowledge", v.slug] });
      qc.invalidateQueries({ queryKey: ["admin", "tenants"] });
    },
  });
}

export interface IntegrationsResponse {
  google_maps_api_key_masked: string;
  google_maps_api_key_present: boolean;
}

export function useIntegrations() {
  return useQuery({
    queryKey: ["integrations"],
    queryFn: () => request<IntegrationsResponse>("/api/admin/integrations"),
  });
}

export function useUpdateIntegrations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { google_maps_api_key?: string }) =>
      request<IntegrationsResponse>("/api/admin/integrations", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations"] }),
  });
}

export interface RefreshReputationResult {
  ok: boolean;
  detail: string;
  rating?: number | null;
  review_count?: number | null;
}

export function useRefreshReputation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) =>
      request<RefreshReputationResult>(
        `/api/admin/tenants/${encodeURIComponent(slug)}/refresh/reputation`,
        { method: "POST" },
      ),
    onSuccess: (_r, slug) => {
      qc.invalidateQueries({ queryKey: ["knowledge", slug] });
    },
  });
}


export interface RefreshMenuResult {
  ok: boolean;
  bucket: string;
  category_count?: number | null;
  item_count?: number | null;
  source_url?: string | null;
  detail?: string | null;
}

export function useRefreshMenu() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) =>
      request<RefreshMenuResult>(
        `/api/admin/tenants/${encodeURIComponent(slug)}/refresh/menu`,
        { method: "POST" },
      ),
    onSuccess: (_r, slug) => {
      qc.invalidateQueries({ queryKey: ["knowledge", slug] });
      qc.invalidateQueries({ queryKey: ["menu", slug] });
    },
  });
}
