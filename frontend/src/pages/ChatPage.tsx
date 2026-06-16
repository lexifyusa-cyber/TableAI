import { useEffect, useMemo, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, LogIn, LogOut, RotateCw, Sparkles, UserCircle } from "lucide-react";
import { useTenant } from "@/hooks/useTenants";
import { useTenantTheme } from "@/hooks/useTenantTheme";
import { useChat } from "@/hooks/useChat";
import { useMenu } from "@/hooks/useMenu";
import { useTenantStore } from "@/stores/tenant";
import { useCustomerAuthStore } from "@/stores/customerAuth";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { SuggestedPrompts } from "@/components/chat/SuggestedPrompts";
import { AttractMode } from "@/components/chat/AttractMode";
import { SpiceTrustFall } from "@/components/chat/SpiceTrustFall";
import { SeasonalBanner } from "@/components/chat/SeasonalBanner";
import { useTimeline } from "@/hooks/useKnowledge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

function buildSuggestions(menuPresent: boolean): string[] {
  if (!menuPresent) return ["What do you serve?", "Tell me about the business", "What are your hours?"];
  return [
    "What's your most popular dish?",
    "Anything vegan?",
    "What's spicy?",
    "What would you recommend for dinner?",
  ];
}

export function ChatPage() {
  const { slug } = useParams<{ slug: string }>();
  const setSlug = useTenantStore((s) => s.setSlug);
  const { data: tenant, isLoading: tenantLoading, error: tenantError } = useTenant(slug);
  const { data: menu } = useMenu(slug);
  const { data: timeline } = useTimeline(slug);

  const getCustomer = useCustomerAuthStore((s) => s.getCustomer);
  const clearCustomer = useCustomerAuthStore((s) => s.clearCustomer);
  const customer = slug ? getCustomer(slug) : null;

  const { messages, send, stop, reset, isStreaming, error } = useChat({
    tenant: slug ?? "",
    surface: "qr",
    customer,
  });
  const listRef = useRef<HTMLDivElement>(null);

  useTenantTheme(tenant);

  useEffect(() => {
    if (slug) setSlug(slug);
  }, [slug, setSlug]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const suggestions = useMemo(
    () => buildSuggestions(!!menu && menu.categories.length > 0),
    [menu],
  );

  if (tenantError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <p className="text-ink-600">Tenant "{slug}" not found.</p>
        <Link to="/" className="mt-4 inline-block text-sm font-medium text-brand-600">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem-3.5rem)] w-full max-w-3xl flex-col px-3 py-3 sm:h-[calc(100vh-3.5rem)] sm:px-6 sm:py-5">
      {/* Chat header */}
      <div className="mb-3 flex items-center gap-3 rounded-2xl border border-ink-200 bg-white px-4 py-3 shadow-sm dark:border-ink-800 dark:bg-ink-900">
        <Link to={`/m/${slug}`} className="text-ink-500 hover:text-ink-900 dark:hover:text-ink-100">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        {tenantLoading ? (
          <Skeleton className="h-9 w-40" />
        ) : tenant ? (
          <>
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold"
              style={{ backgroundColor: tenant.brand?.primary_color || "#f97316" }}
            >
              {tenant.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-ink-900 dark:text-ink-100">{tenant.name}</div>
              <div className="truncate text-xs text-ink-500">AI assistant · replies in real time</div>
            </div>
          </>
        ) : null}

        {customer ? (
          <div className="flex items-center gap-1.5">
            <UserCircle className="h-4 w-4 text-ink-400" />
            <span className="hidden text-xs text-ink-600 dark:text-ink-400 sm:inline">
              {customer.display_name ?? customer.email ?? "Guest"}
            </span>
            <button
              onClick={() => { if (slug) clearCustomer(slug); }}
              className="ml-1 rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-ink-200"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <Link
            to={`/c/${slug}/login`}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-200"
          >
            <LogIn className="h-3.5 w-3.5" />
            Sign in
          </Link>
        )}

        <Button variant="ghost" size="sm" onClick={reset} disabled={messages.length === 0}>
          <RotateCw className="h-4 w-4" />
          <span className="hidden sm:inline">New chat</span>
        </Button>
      </div>

      {/* Message stream */}
      <div
        ref={listRef}
        className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-ink-200 bg-ink-50/50 p-3 dark:border-ink-800 dark:bg-ink-900/30 sm:p-5"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col gap-4">
            <SeasonalBanner nextHoliday={timeline?.public?.next_holiday} />
            {!customer && (
              <Link
                to={`/c/${slug}/login`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-ink-300 bg-white/60 px-4 py-3 text-sm text-ink-600 hover:border-ink-400 hover:bg-white dark:border-ink-700 dark:bg-ink-800/30 dark:text-ink-400 dark:hover:bg-ink-800/60"
              >
                <div className="flex items-center gap-2">
                  <UserCircle className="h-5 w-5 text-ink-400" />
                  <span>Sign in to save your conversation history</span>
                </div>
                <LogIn className="h-4 w-4 shrink-0" />
              </Link>
            )}
            <AttractMode menu={menu} tenantName={tenant?.name ?? "us"} />
            <SpiceTrustFall menu={menu} tenantName={tenant?.name ?? "us"} onPickDish={(name) => send(`Tell me about the ${name}`)} />
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-ink-300 bg-white/50 px-4 py-5 text-center dark:border-ink-700 dark:bg-ink-800/30">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--tenant-primary)] text-white">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="mt-2 text-sm font-semibold text-ink-900 dark:text-ink-100">
                Or ask {tenant?.name ?? "our AI"} directly
              </h3>
              <div className="mt-3 max-w-md">
                <SuggestedPrompts prompts={suggestions} onPick={send} />
              </div>
            </div>
          </div>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} msg={m} />)
        )}
      </div>

      {/* Input */}
      <div className="mt-3">
        {messages.length > 0 && !isStreaming && (
          <div className="mb-2">
            <SuggestedPrompts prompts={suggestions.slice(0, 3)} onPick={send} />
          </div>
        )}
        <ChatInput
          onSend={send}
          onStop={stop}
          isStreaming={isStreaming}
          placeholder={tenant ? `Message ${tenant.name}…` : "Loading…"}
        />
      </div>
    </div>
  );
}
