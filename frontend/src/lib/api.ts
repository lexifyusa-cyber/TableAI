import { env } from "./env";
import { useAuthStore } from "@/stores/auth";
import { localAuthEnabled } from "@/lib/env";
import type {
  ConversationSummary,
  ConversationThread,
  CustomerProfile,
  GenerateDemoRequest,
  GenerateDemoResponse,
  MenuResponse,
  MetricsResponse,
  Tenant,
} from "@/types/api";

const base = env.apiUrl.replace(/\/$/, "");

// Read token from the in-memory auth store (populated by useAuthSync via
// Supabase's onAuthStateChange). We intentionally do NOT call
// supabase.auth.getSession() here — it can deadlock on the auth lock when
// multiple requests fire in parallel right after sign-in.
function authHeader(): Record<string, string> {
  const store = useAuthStore.getState();
  const token = store.session?.access_token;
  if (token) return { Authorization: `Bearer ${token}` };
  if (localAuthEnabled && store.profile) {
    return {
      "X-Dev-Auth": "1",
      "X-Dev-Email": store.profile.email,
      "X-Dev-Role": store.profile.role,
    };
  }
  return {};
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...authHeader(),
    ...((init?.headers as Record<string, string>) || {}),
  };
  const res = await fetch(`${base}${path}`, { ...init, headers });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {}
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  request,
  health: () => request<{ status: string }>("/health"),

  me: () => request<import("@/stores/auth").MeProfile>("/api/me"),

  listTenants: () => request<Tenant[]>("/api/tenants"),
  getTenant: (slug: string) => request<Tenant>(`/api/tenants/${encodeURIComponent(slug)}`),

  getMenu: (tenant: string) =>
    request<MenuResponse>(`/api/menu?tenant=${encodeURIComponent(tenant)}`),

  generateDemo: (body: GenerateDemoRequest) =>
    request<GenerateDemoResponse>("/api/demo/generate", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listConversations: (tenant: string, limit = 50) =>
    request<ConversationSummary[]>(
      `/api/conversations?tenant=${encodeURIComponent(tenant)}&limit=${limit}`,
    ),

  getConversation: (id: string) =>
    request<ConversationThread>(`/api/conversations/${encodeURIComponent(id)}/messages`),

  getMetrics: (tenant: string) =>
    request<MetricsResponse>(`/api/metrics?tenant=${encodeURIComponent(tenant)}`),

  customerJoin: (body: { tenant: string; display_name?: string }, localEmail?: string) =>
    request<CustomerProfile>("/api/customer/join", {
      method: "POST",
      headers: localEmail && localAuthEnabled ? {
        "X-Customer-Dev-Auth": "1",
        "X-Customer-Dev-Email": localEmail,
      } : undefined,
      body: JSON.stringify(body),
    }),

  customerMe: (tenant: string, localEmail?: string) =>
    request<CustomerProfile>(`/api/customer/me?tenant=${encodeURIComponent(tenant)}`, {
      headers: localEmail && localAuthEnabled ? {
        "X-Customer-Dev-Auth": "1",
        "X-Customer-Dev-Email": localEmail,
      } : undefined,
    }),
};

export function chatUrl(): string {
  return `${base}/api/chat`;
}
