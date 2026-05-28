import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface TenantSettings {
  slug: string;
  name: string;
  brand: Record<string, any>;
  contact: Record<string, any>;
  hours: Record<string, any>;
  ai_config: Record<string, any>;
  pos_provider: string | null;
  pos_config: Record<string, any> | null;
  model_config_override: Record<string, any> | null;
}

export function useTenantSettings(slug: string | null | undefined) {
  return useQuery({
    queryKey: ["tenant-settings", slug],
    queryFn: () => request<TenantSettings>(`/api/tenant/settings?tenant=${encodeURIComponent(slug!)}`),
    enabled: !!slug,
  });
}

export function useUpdateTenantSettings(slug: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<TenantSettings>) =>
      request<TenantSettings>(`/api/tenant/settings?tenant=${encodeURIComponent(slug!)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant-settings", slug] }),
  });
}
