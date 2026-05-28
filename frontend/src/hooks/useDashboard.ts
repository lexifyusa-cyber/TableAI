import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useConversationList(slug: string | null | undefined) {
  return useQuery({
    queryKey: ["conversations", slug],
    queryFn: () => api.listConversations(slug!, 100),
    enabled: !!slug,
    staleTime: 10_000,
  });
}

export function useConversation(id: string | null | undefined) {
  return useQuery({
    queryKey: ["conversation", id],
    queryFn: () => api.getConversation(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useMetrics(slug: string | null | undefined) {
  return useQuery({
    queryKey: ["metrics", slug],
    queryFn: () => api.getMetrics(slug!),
    enabled: !!slug,
    staleTime: 30_000,
  });
}
