import { useCallback, useRef, useState } from "react";
import { chatUrl } from "@/lib/api";
import { localAuthEnabled } from "@/lib/env";
import { readSSE } from "@/lib/sse";
import { useAuthStore } from "@/stores/auth";
import type { ChatMessage, ChatStreamEvent, ConversationSurface, CustomerProfile } from "@/types/api";

interface UseChatOptions {
  tenant: string;
  surface?: ConversationSurface;
  sessionId?: string;
  customer?: CustomerProfile | null;
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function useChat({ tenant, surface = "qr", sessionId, customer }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isStreaming) return;

      setError(null);
      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: trimmed,
        createdAt: new Date(),
        status: "complete",
      };
      const assistantMsgId = uid();
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        createdAt: new Date(),
        status: "streaming",
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      const abort = new AbortController();
      abortRef.current = abort;

      try {
        const token = useAuthStore.getState().session?.access_token;
        const customerHeaders: Record<string, string> = token
          ? { Authorization: `Bearer ${token}` }
          : localAuthEnabled && customer?.email
            ? {
                "X-Customer-Dev-Auth": "1",
                "X-Customer-Dev-Email": customer.email,
              }
            : {};
        const res = await fetch(chatUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...customerHeaders },
          body: JSON.stringify({
            tenant,
            message: trimmed,
            surface,
            session_id: sessionId,
            conversation_id: conversationIdRef.current,
            customer_id: customer?.customer_id ?? null,
          }),
          signal: abort.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `${res.status} ${res.statusText}`);
        }

        for await (const ev of readSSE<ChatStreamEvent>(res, abort.signal)) {
          if (ev.conversation_id) conversationIdRef.current = ev.conversation_id;
          if (ev.error) {
            setError(ev.error);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, status: "error", content: m.content || ev.error! } : m,
              ),
            );
            break;
          }
          if (ev.text) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, content: m.content + ev.text } : m,
              ),
            );
          }
          if (ev.done) {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, status: "complete" } : m)),
            );
            break;
          }
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, status: "complete" } : m)),
          );
        } else {
          const msg = (e as Error).message || "Network error";
          setError(msg);
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, status: "error", content: msg } : m)),
          );
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [tenant, surface, sessionId, customer?.customer_id, customer?.email, isStreaming],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    conversationIdRef.current = null;
    setMessages([]);
    setError(null);
  }, []);

  return { messages, send, stop, reset, isStreaming, error, conversationId: conversationIdRef.current };
}
