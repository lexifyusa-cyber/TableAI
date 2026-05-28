import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface AdminUser {
  user_id: string;
  email: string;
  role: "admin" | "employee" | "owner";
  display_name: string | null;
  tenant_count: number;
}

export interface AdminProvider {
  id: string;
  name: string;
  kind: "anthropic" | "openai_compat";
  base_url: string | null;
  api_key_masked: string;
  api_key_present: boolean;
  enabled: boolean;
}

export interface ModelEntry {
  kind: "anthropic" | "openai_compat";
  model: string;
}

export interface ModelConfig {
  defaults: {
    chat?: ModelEntry;
    demo_generation?: ModelEntry;
    premium_chat?: ModelEntry;
  };
  allowed_models: {
    anthropic?: string[];
    openai_compat?: string[];
  };
}

export interface AdminTenant {
  id: string;
  slug: string;
  name: string;
  business_type: string;
  status: string;
  source_url: string | null;
  created_at: string | null;
  owners: Array<{ user_id: string; email: string; display_name: string | null }>;
}

export interface Invite {
  token: string;
  code: string;
  tenant_slug: string;
  email: string;
  expires_at: string;
}

export function useAdminUsers() {
  return useQuery({ queryKey: ["admin", "users"], queryFn: () => request<AdminUser[]>("/api/admin/users") });
}

export function useAdminUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { user_id: string; role?: string; display_name?: string }) =>
      request<AdminUser>(`/api/admin/users/${body.user_id}`, {
        method: "PATCH",
        body: JSON.stringify({ role: body.role, display_name: body.display_name }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useAdminDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (user_id: string) => request(`/api/admin/users/${user_id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useAdminProviders() {
  return useQuery({
    queryKey: ["admin", "providers"],
    queryFn: () => request<AdminProvider[]>("/api/admin/providers"),
  });
}

export function useAdminCreateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; kind: string; base_url?: string | null; api_key: string; enabled: boolean }) =>
      request<AdminProvider>("/api/admin/providers", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "providers"] }),
  });
}

export function useAdminUpdateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { id: string; name?: string; base_url?: string | null; api_key?: string; enabled?: boolean }) =>
      request<AdminProvider>(`/api/admin/providers/${body.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: body.name,
          base_url: body.base_url,
          api_key: body.api_key,
          enabled: body.enabled,
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "providers"] }),
  });
}

export function useAdminDeleteProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request(`/api/admin/providers/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "providers"] }),
  });
}

export function useAdminTestProvider() {
  return useMutation({
    mutationFn: (id: string) =>
      request<{ ok: boolean; detail: string }>(`/api/admin/providers/${id}/test`, { method: "POST" }),
  });
}

export function useModelConfig() {
  return useQuery({
    queryKey: ["admin", "model-config"],
    queryFn: () => request<ModelConfig>("/api/admin/model-config"),
  });
}

export function useUpdateModelConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<ModelConfig>) =>
      request<ModelConfig>("/api/admin/model-config", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "model-config"] }),
  });
}

export function useAdminTenants() {
  return useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: () => request<AdminTenant[]>("/api/admin/tenants"),
  });
}

export function useCreateInvite() {
  return useMutation({
    mutationFn: (body: { slug: string; email: string; note?: string }) =>
      request<Invite>(`/api/admin/tenants/${body.slug}/invite`, {
        method: "POST",
        body: JSON.stringify({ email: body.email, note: body.note }),
      }),
  });
}

export function useInvitesForTenant(slug: string | null | undefined) {
  return useQuery({
    queryKey: ["admin", "invites", slug],
    queryFn: () => request<Invite[]>(`/api/admin/tenants/${slug}/invites`),
    enabled: !!slug,
  });
}

export function useAcceptInvite() {
  return useMutation({
    mutationFn: (body: { token?: string; code?: string }) =>
      request<{ tenant_slug: string; tenant_name: string }>("/api/invites/accept", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}
