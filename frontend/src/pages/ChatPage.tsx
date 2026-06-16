import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bot,
  Coins,
  Gamepad2,
  LogIn,
  LogOut,
  MessageSquare,
  RotateCw,
  Settings,
  Sparkles,
  UserCircle,
  UtensilsCrossed,
} from "lucide-react";
import type { MenuItem } from "@/types/api";
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
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";

type CustomerPanelTab = "chat" | "profile" | "settings" | "games" | "usage";

const CUSTOMER_TABS: Array<{ id: CustomerPanelTab; label: string; icon: typeof MessageSquare }> = [
  { id: "chat", label: "Menu & AI", icon: MessageSquare },
  { id: "profile", label: "Profile", icon: UserCircle },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "games", label: "Games", icon: Gamepad2 },
  { id: "usage", label: "Credits", icon: Coins },
];

function buildSuggestions(menuPresent: boolean): string[] {
  if (!menuPresent) return ["What do you serve?", "Tell me about the business", "What are your hours?"];
  return [
    "What's your most popular dish?",
    "Anything vegan?",
    "What's spicy?",
    "What would you recommend for dinner?",
  ];
}

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

function PriceGuessGame({ items }: { items: MenuItem[] }) {
  const pricedItems = useMemo(() => items.filter((item) => item.price_cents != null), [items]);
  const [item, setItem] = useState<MenuItem | null>(() => pickRandom(pricedItems));
  const [guess, setGuess] = useState("");
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (!item && pricedItems.length > 0) setItem(pickRandom(pricedItems));
  }, [item, pricedItems]);

  const submitGuess = () => {
    if (!item?.price_cents) return;
    const guessedCents = Math.round(Number.parseFloat(guess) * 100);
    if (Number.isNaN(guessedCents)) {
      setResult("Enter a price first.");
      return;
    }
    const diff = Math.abs(guessedCents - item.price_cents);
    if (diff <= 100) setResult(`Close. Actual price: ${formatPrice(item.price_cents)}.`);
    else setResult(`Actual price: ${formatPrice(item.price_cents)}. Try the next one.`);
  };

  const nextItem = () => {
    setItem(pickRandom(pricedItems));
    setGuess("");
    setResult(null);
  };

  if (!item) {
    return (
      <GameCard title="Price Guess" description="Guess menu prices from memory.">
        <p className="text-sm text-ink-500">No priced menu items are available for this game yet.</p>
      </GameCard>
    );
  }

  return (
    <GameCard title="Price Guess" description="Guess the menu price, then reveal how close you were.">
      <div className="rounded-2xl border border-ink-200 bg-ink-50 p-4 dark:border-ink-800 dark:bg-ink-950/40">
        <div className="text-xs font-medium uppercase tracking-wide text-ink-500">Dish</div>
        <div className="mt-1 text-lg font-semibold text-ink-900 dark:text-ink-100">{item.name}</div>
        {item.description && <p className="mt-1 line-clamp-2 text-sm text-ink-500">{item.description}</p>}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          inputMode="decimal"
          placeholder="12.99"
          className="min-w-0 flex-1 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm dark:border-ink-800 dark:bg-ink-900"
        />
        <Button type="button" size="sm" onClick={submitGuess}>Check</Button>
      </div>
      {result && <p className="mt-2 text-sm font-medium text-ink-700 dark:text-ink-200">{result}</p>}
      <Button type="button" variant="secondary" size="sm" className="mt-3 w-full" onClick={nextItem}>
        Next dish
      </Button>
    </GameCard>
  );
}

function MenuQuizGame({ items }: { items: MenuItem[] }) {
  const playableItems = useMemo(() => items.filter((item) => item.description || item.tags.length > 0), [items]);
  const [item, setItem] = useState<MenuItem | null>(() => pickRandom(playableItems));
  const [answer, setAnswer] = useState<string | null>(null);

  useEffect(() => {
    if (!item && playableItems.length > 0) setItem(pickRandom(playableItems));
  }, [item, playableItems]);

  const choices = useMemo(() => {
    if (!item) return [];
    const distractors = playableItems
      .filter((candidate) => candidate.id !== item.id)
      .sort(() => 0.5 - Math.random())
      .slice(0, 2);
    return [item, ...distractors].sort(() => 0.5 - Math.random());
  }, [item, playableItems]);

  const nextQuestion = () => {
    setItem(pickRandom(playableItems));
    setAnswer(null);
  };

  if (!item || choices.length === 0) {
    return (
      <GameCard title="Menu Quiz" description="Match clues to dishes.">
        <p className="text-sm text-ink-500">Add menu descriptions or tags to unlock this game.</p>
      </GameCard>
    );
  }

  return (
    <GameCard title="Menu Quiz" description="Pick the dish that matches the clue.">
      <div className="rounded-2xl border border-dashed border-ink-300 bg-white p-4 dark:border-ink-700 dark:bg-ink-900">
        <div className="text-xs font-medium uppercase tracking-wide text-ink-500">Clue</div>
        <p className="mt-1 text-sm text-ink-700 dark:text-ink-200">
          {item.description || `Tagged with ${item.tags.slice(0, 2).join(", ")}`}
        </p>
      </div>
      <div className="mt-3 grid gap-2">
        {choices.map((choice) => {
          const selected = answer === choice.id;
          const correct = choice.id === item.id;
          return (
            <button
              key={choice.id}
              type="button"
              onClick={() => setAnswer(choice.id)}
              className={cn(
                "rounded-xl border px-3 py-2 text-left text-sm transition",
                selected && correct
                  ? "border-emerald-400 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"
                  : selected
                    ? "border-rose-300 bg-rose-50 text-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
                    : "border-ink-200 bg-white text-ink-700 hover:border-[var(--tenant-primary)] dark:border-ink-800 dark:bg-ink-900 dark:text-ink-200",
              )}
            >
              {choice.name}
            </button>
          );
        })}
      </div>
      {answer && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-ink-700 dark:text-ink-200">
            {answer === item.id ? "Correct." : `Not quite. It was ${item.name}.`}
          </p>
          <Button type="button" size="sm" variant="secondary" onClick={nextQuestion}>Next</Button>
        </div>
      )}
    </GameCard>
  );
}

function MoodPickerGame({ tenantName, onAsk }: { tenantName: string; onAsk: (prompt: string) => void }) {
  const moods = [
    { label: "Comfort", prompt: `Recommend a comforting meal from ${tenantName}.` },
    { label: "Healthy", prompt: `Recommend a lighter or healthier option from ${tenantName}.` },
    { label: "Adventure", prompt: `Pick the most adventurous menu item from ${tenantName}.` },
    { label: "Sweet", prompt: `Recommend something sweet or dessert-like from ${tenantName}.` },
  ];

  return (
    <GameCard title="Mood Picker" description="Choose a mood and let the AI turn it into a menu recommendation.">
      <div className="grid gap-2 sm:grid-cols-2">
        {moods.map((mood) => (
          <button
            key={mood.label}
            type="button"
            onClick={() => onAsk(mood.prompt)}
            className="rounded-2xl border border-ink-200 bg-white p-4 text-left transition hover:border-[var(--tenant-primary)] hover:shadow-sm dark:border-ink-800 dark:bg-ink-900"
          >
            <div className="font-semibold text-ink-900 dark:text-ink-100">{mood.label}</div>
            <div className="mt-1 text-xs text-ink-500">Ask the assistant for a matching pick.</div>
          </button>
        ))}
      </div>
    </GameCard>
  );
}

function GameCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  );
}

export function ChatPage() {
  const { slug } = useParams<{ slug: string }>();
  const [panelTab, setPanelTab] = useState<CustomerPanelTab>("chat");
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
  const menuItems = useMemo(
    () => menu?.categories.flatMap((category) => category.items) ?? [],
    [menu],
  );
  const availableMenuItems = useMemo(
    () => menuItems.filter((item) => item.is_available),
    [menuItems],
  );
  const creditLimit = 50;
  const creditsUsed = Math.min(creditLimit, messages.filter((message) => message.role === "user").length);
  const creditsRemaining = Math.max(0, creditLimit - creditsUsed);

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

  if (customer) {
    return (
      <div className="mx-auto min-h-[calc(100vh-3.5rem)] w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
        <div className="mb-4 flex flex-col gap-3 rounded-3xl border border-ink-200 bg-white p-4 shadow-sm dark:border-ink-800 dark:bg-ink-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link to={`/m/${slug}`} className="rounded-xl p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-900 dark:hover:bg-ink-800 dark:hover:text-ink-100">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            {tenantLoading ? (
              <Skeleton className="h-12 w-48" />
            ) : (
              <>
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white"
                  style={{ backgroundColor: tenant?.brand?.primary_color || "#f97316" }}
                >
                  {(tenant?.name ?? "AI").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-ink-900 dark:text-ink-100">
                    {tenant?.name ?? "Customer panel"}
                  </h1>
                  <p className="text-sm text-ink-500">
                    Signed in as {customer.display_name ?? customer.email ?? "Customer"} for /{slug}
                  </p>
                </div>
              </>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { if (slug) clearCustomer(slug); }}
            className="self-start sm:self-auto"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[230px_1fr]">
          <Card className="h-fit">
            <CardBody className="space-y-2">
              {CUSTOMER_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = panelTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPanelTab(tab.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                      active
                        ? "bg-[var(--tenant-primary)] text-white shadow-sm"
                        : "text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-ink-100",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </CardBody>
          </Card>

          {panelTab === "chat" && (
            <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
              <Card className="h-fit">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <UtensilsCrossed className="h-5 w-5 text-[var(--tenant-primary)]" />
                    <CardTitle>Menu</CardTitle>
                  </div>
                  <CardDescription>Browse available items for this tenant while chatting with the AI assistant.</CardDescription>
                </CardHeader>
                <CardBody>
                  {availableMenuItems.length > 0 ? (
                    <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
                      {availableMenuItems.slice(0, 18).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => send(`Tell me about ${item.name}`)}
                          className="w-full rounded-2xl border border-ink-200 bg-white p-3 text-left transition hover:border-[var(--tenant-primary)] hover:shadow-sm dark:border-ink-800 dark:bg-ink-900"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-ink-900 dark:text-ink-100">{item.name}</div>
                              {item.description && (
                                <p className="mt-1 line-clamp-2 text-sm text-ink-500">{item.description}</p>
                              )}
                            </div>
                            {item.price_cents != null && (
                              <span className="shrink-0 text-sm font-semibold text-ink-900 dark:text-ink-100">
                                {formatPrice(item.price_cents)}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-ink-500">No available menu items found yet.</p>
                  )}
                </CardBody>
              </Card>

              <Card className="flex min-h-[680px] flex-col">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Bot className="h-5 w-5 text-[var(--tenant-primary)]" />
                        <CardTitle>Interactive AI assistant</CardTitle>
                      </div>
                      <CardDescription>Ask about menu items, dietary options, recommendations, and ordering help.</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" onClick={reset} disabled={messages.length === 0}>
                      <RotateCw className="h-4 w-4" />
                      New chat
                    </Button>
                  </div>
                </CardHeader>
                <CardBody className="flex min-h-0 flex-1 flex-col">
                  <div
                    ref={listRef}
                    className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-ink-200 bg-ink-50/50 p-3 dark:border-ink-800 dark:bg-ink-950/40 sm:p-4"
                  >
                    {messages.length === 0 ? (
                      <div className="flex flex-col gap-4">
                        <SeasonalBanner nextHoliday={timeline?.public?.next_holiday} />
                        <AttractMode menu={menu} tenantName={tenant?.name ?? "us"} />
                        <div className="rounded-2xl border border-dashed border-ink-300 bg-white/70 px-4 py-5 text-center dark:border-ink-700 dark:bg-ink-800/30">
                          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--tenant-primary)] text-white">
                            <Sparkles className="h-5 w-5" />
                          </div>
                          <h3 className="mt-2 text-sm font-semibold text-ink-900 dark:text-ink-100">
                            Ask {tenant?.name ?? "our AI"} directly
                          </h3>
                          <div className="mt-3">
                            <SuggestedPrompts prompts={suggestions} onPick={send} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      messages.map((m) => <MessageBubble key={m.id} msg={m} />)
                    )}
                  </div>
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
                      placeholder={tenant ? `Message ${tenant.name}...` : "Loading..."}
                    />
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {panelTab === "profile" && (
            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>Your customer identity for this tenant.</CardDescription>
              </CardHeader>
              <CardBody className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-ink-200 bg-ink-50 p-4 dark:border-ink-800 dark:bg-ink-950/40">
                  <div className="text-xs font-medium uppercase tracking-wide text-ink-500">Name</div>
                  <div className="mt-1 text-sm font-semibold text-ink-900 dark:text-ink-100">
                    {customer.display_name || "Customer"}
                  </div>
                </div>
                <div className="rounded-2xl border border-ink-200 bg-ink-50 p-4 dark:border-ink-800 dark:bg-ink-950/40">
                  <div className="text-xs font-medium uppercase tracking-wide text-ink-500">Email</div>
                  <div className="mt-1 break-all text-sm font-semibold text-ink-900 dark:text-ink-100">
                    {customer.email || "Not provided"}
                  </div>
                </div>
                <div className="rounded-2xl border border-ink-200 bg-ink-50 p-4 dark:border-ink-800 dark:bg-ink-950/40">
                  <div className="text-xs font-medium uppercase tracking-wide text-ink-500">Tenant</div>
                  <div className="mt-1 text-sm font-semibold text-ink-900 dark:text-ink-100">/{customer.tenant}</div>
                </div>
                <div className="rounded-2xl border border-ink-200 bg-ink-50 p-4 dark:border-ink-800 dark:bg-ink-950/40">
                  <div className="text-xs font-medium uppercase tracking-wide text-ink-500">Customer ID</div>
                  <div className="mt-1 break-all text-sm font-semibold text-ink-900 dark:text-ink-100">{customer.customer_id}</div>
                </div>
              </CardBody>
            </Card>
          )}

          {panelTab === "settings" && (
            <Card>
              <CardHeader>
                <CardTitle>Settings</CardTitle>
                <CardDescription>Customer preferences for this tenant experience.</CardDescription>
              </CardHeader>
              <CardBody className="space-y-3">
                {["Save chat history for this tenant", "Use dietary preferences in AI responses", "Show menu recommendations first"].map((label) => (
                  <label key={label} className="flex items-center justify-between rounded-2xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
                    <span className="text-sm font-medium text-ink-800 dark:text-ink-100">{label}</span>
                    <input type="checkbox" defaultChecked className="h-4 w-4 accent-[var(--tenant-primary)]" />
                  </label>
                ))}
              </CardBody>
            </Card>
          )}

          {panelTab === "games" && (
            <div className="grid gap-4 xl:grid-cols-2">
              <PriceGuessGame items={availableMenuItems} />
              <MenuQuizGame items={availableMenuItems} />
              <MoodPickerGame
                tenantName={tenant?.name ?? "this restaurant"}
                onAsk={(prompt) => {
                  setPanelTab("chat");
                  send(prompt);
                }}
              />
              <SpiceTrustFall menu={menu} tenantName={tenant?.name ?? "us"} onPickDish={(name) => {
                setPanelTab("chat");
                send(`Tell me about the ${name}`);
              }} />
            </div>
          )}

          {panelTab === "usage" && (
            <Card>
              <CardHeader>
                <CardTitle>Credits and usage</CardTitle>
                <CardDescription>Session-level usage for this customer panel.</CardDescription>
              </CardHeader>
              <CardBody className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-ink-200 bg-ink-50 p-4 dark:border-ink-800 dark:bg-ink-950/40">
                  <div className="text-xs font-medium uppercase tracking-wide text-ink-500">Credits used</div>
                  <div className="mt-2 text-3xl font-semibold text-ink-900 dark:text-ink-100">{creditsUsed}</div>
                </div>
                <div className="rounded-2xl border border-ink-200 bg-ink-50 p-4 dark:border-ink-800 dark:bg-ink-950/40">
                  <div className="text-xs font-medium uppercase tracking-wide text-ink-500">Credits remaining</div>
                  <div className="mt-2 text-3xl font-semibold text-ink-900 dark:text-ink-100">{creditsRemaining}</div>
                </div>
                <div className="rounded-2xl border border-ink-200 bg-ink-50 p-4 dark:border-ink-800 dark:bg-ink-950/40">
                  <div className="text-xs font-medium uppercase tracking-wide text-ink-500">Menu items viewed</div>
                  <div className="mt-2 text-3xl font-semibold text-ink-900 dark:text-ink-100">{availableMenuItems.length}</div>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
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

        <Link
          to={`/c/${slug}/login`}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-200"
        >
          <LogIn className="h-3.5 w-3.5" />
          Sign in
        </Link>

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
            <Link
              to={`/c/${slug}/login`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-ink-300 bg-white/60 px-4 py-3 text-sm text-ink-600 hover:border-ink-400 hover:bg-white dark:border-ink-700 dark:bg-ink-800/30 dark:text-ink-400 dark:hover:bg-ink-800/60"
            >
              <div className="flex items-center gap-2">
                <UserCircle className="h-5 w-5 text-ink-400" />
                <span>Sign in to open your customer panel and save conversation history</span>
              </div>
              <LogIn className="h-4 w-4 shrink-0" />
            </Link>
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
