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
  Minus,
  Plus,
  ReceiptText,
  RotateCw,
  Settings,
  ShoppingCart,
  Sparkles,
  Trash2,
  UserCircle,
  UtensilsCrossed,
} from "lucide-react";
import { useTenant } from "@/hooks/useTenants";
import { useTenantTheme } from "@/hooks/useTenantTheme";
import { useChat } from "@/hooks/useChat";
import { useMenu } from "@/hooks/useMenu";
import { useTenantStore } from "@/stores/tenant";
import { useCustomerAuthStore } from "@/stores/customerAuth";
import { useCustomerOrderStore, type CustomerOrderMode, type CustomerOrderStatus } from "@/stores/customerOrders";
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

type CustomerPanelTab = "chat" | "profile" | "settings" | "games" | "orders" | "usage";

const CUSTOMER_TABS: Array<{ id: CustomerPanelTab; label: string; icon: typeof MessageSquare }> = [
  { id: "chat", label: "Menu & AI", icon: MessageSquare },
  { id: "profile", label: "Profile", icon: UserCircle },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "games", label: "Games", icon: Gamepad2 },
  { id: "orders", label: "Order Status", icon: ReceiptText },
  { id: "usage", label: "Credits", icon: Coins },
];

const ORDER_STATUS_LABELS: Record<CustomerOrderStatus, string> = {
  received: "Order received",
  preparing: "Preparing",
  ready: "Ready",
};

function buildSuggestions(menuPresent: boolean): string[] {
  if (!menuPresent) return ["What do you serve?", "Tell me about the business", "What are your hours?"];
  return [
    "What's your most popular dish?",
    "Anything vegan?",
    "What's spicy?",
    "What would you recommend for dinner?",
  ];
}

const DOTS = [
  { x: 20, y: 24 },
  { x: 52, y: 14 },
  { x: 82, y: 30 },
  { x: 72, y: 64 },
  { x: 45, y: 82 },
  { x: 18, y: 62 },
] as const;

function ConnectDotsGame() {
  const [nextDot, setNextDot] = useState(0);
  const complete = nextDot >= DOTS.length;

  const reset = () => setNextDot(0);

  return (
    <GameCard title="Connect Dots" description="Tap the dots in order to complete the shape.">
      <div className="relative h-72 overflow-hidden rounded-3xl border border-ink-200 bg-gradient-to-br from-sky-50 to-orange-50 dark:border-ink-800 dark:from-ink-950 dark:to-ink-900">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {DOTS.slice(0, Math.max(0, nextDot - 1)).map((dot, index) => {
            const next = DOTS[index + 1];
            if (!next) return null;
            return (
              <line
                key={`${dot.x}-${dot.y}`}
                x1={dot.x}
                y1={dot.y}
                x2={next.x}
                y2={next.y}
                stroke="var(--tenant-primary)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            );
          })}
          {complete && (
            <line
              x1={DOTS[DOTS.length - 1].x}
              y1={DOTS[DOTS.length - 1].y}
              x2={DOTS[0].x}
              y2={DOTS[0].y}
              stroke="var(--tenant-primary)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}
        </svg>
        {DOTS.map((dot, index) => {
          const active = index === nextDot;
          const done = index < nextDot;
          return (
            <button
              key={index}
              type="button"
              onClick={() => { if (active) setNextDot((value) => value + 1); }}
              className={cn(
                "absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-sm font-bold shadow-sm transition",
                active
                  ? "scale-110 border-[var(--tenant-primary)] bg-[var(--tenant-primary)] text-white"
                  : done
                    ? "border-emerald-300 bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
                    : "border-ink-200 bg-white text-ink-500 dark:border-ink-700 dark:bg-ink-900",
              )}
              style={{ left: `${dot.x}%`, top: `${dot.y}%` }}
              aria-label={`Dot ${index + 1}`}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink-700 dark:text-ink-200">
          {complete ? "Shape complete." : `Next dot: ${nextDot + 1}`}
        </p>
        <Button type="button" size="sm" variant="secondary" onClick={reset}>Reset</Button>
      </div>
    </GameCard>
  );
}

function SnakeAndLadderGame() {
  const [position, setPosition] = useState(1);
  const [roll, setRoll] = useState<number | null>(null);
  const [message, setMessage] = useState("Roll to start.");
  const jumps: Record<number, number> = { 4: 14, 9: 31, 17: 7, 20: 30, 28: 12, 35: 22 };

  const rollDice = () => {
    const dice = Math.floor(Math.random() * 6) + 1;
    let next = Math.min(36, position + dice);
    const jumped = jumps[next];
    setRoll(dice);
    if (jumped) {
      const isLadder = jumped > next;
      setMessage(`${isLadder ? "Ladder" : "Snake"}: ${next} -> ${jumped}`);
      next = jumped;
    } else if (next === 36) {
      setMessage("You reached the finish.");
    } else {
      setMessage(`Moved to ${next}.`);
    }
    setPosition(next);
  };

  const reset = () => {
    setPosition(1);
    setRoll(null);
    setMessage("Roll to start.");
  };

  return (
    <GameCard title="Snake and Ladder" description="Roll the dice, climb ladders, and dodge snakes.">
      <div className="grid grid-cols-6 gap-1 rounded-3xl border border-ink-200 bg-ink-50 p-2 dark:border-ink-800 dark:bg-ink-950/40">
        {Array.from({ length: 36 }, (_, i) => 36 - i).map((cell) => {
          const jump = jumps[cell];
          return (
            <div
              key={cell}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-xl border text-xs font-semibold",
                position === cell
                  ? "border-[var(--tenant-primary)] bg-[var(--tenant-primary)] text-white"
                  : "border-ink-200 bg-white text-ink-700 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-200",
              )}
            >
              {cell}
              {jump && (
                <span className="absolute bottom-1 right-1 text-[10px]">
                  {jump > cell ? "L" : "S"}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">
            Position {position}{roll ? ` · rolled ${roll}` : ""}
          </p>
          <p className="text-sm text-ink-500">{message}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={rollDice} disabled={position === 36}>Roll</Button>
          <Button type="button" size="sm" variant="secondary" onClick={reset}>Reset</Button>
        </div>
      </div>
    </GameCard>
  );
}

function PingPongGame() {
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [paddleX, setPaddleX] = useState(42);
  const [ball, setBall] = useState({ x: 50, y: 34, dx: 2.2, dy: 2 });
  const [status, setStatus] = useState("Press Start, then keep the ball above your paddle.");

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setBall((current) => {
        let { x, y, dx, dy } = current;
        x += dx;
        y += dy;
        if (x <= 3 || x >= 97) dx *= -1;
        if (y <= 4) dy *= -1;
        const hitsPaddle = y >= 86 && y <= 92 && x >= paddleX && x <= paddleX + 16;
        if (hitsPaddle) {
          dy = -Math.abs(dy);
          setScore((value) => value + 1);
          setStatus("Nice return.");
        } else if (y > 98) {
          setRunning(false);
          setStatus("Missed. Start again.");
          return { x: 50, y: 34, dx: 2.2, dy: 2 };
        }
        return { x, y, dx, dy };
      });
    }, 35);
    return () => window.clearInterval(timer);
  }, [running, paddleX]);

  const start = () => {
    setScore(0);
    setStatus("Game running.");
    setBall({ x: 50, y: 34, dx: 2.2, dy: 2 });
    setRunning(true);
  };

  const movePaddle = (delta: number) => {
    setPaddleX((value) => Math.min(84, Math.max(0, value + delta)));
  };

  return (
    <GameCard title="Ping Pong" description="Move the paddle and keep the ball alive.">
      <div className="relative h-72 overflow-hidden rounded-3xl border border-ink-200 bg-ink-950 dark:border-ink-800">
        <div
          className="absolute h-4 w-4 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,0.8)]"
          style={{ left: `${ball.x}%`, top: `${ball.y}%`, transform: "translate(-50%, -50%)" }}
        />
        <div
          className="absolute bottom-4 h-3 rounded-full bg-[var(--tenant-primary)]"
          style={{ left: `${paddleX}%`, width: "16%" }}
        />
        <div className="absolute left-4 top-4 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
          Score {score}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-600 dark:text-ink-300">{status}</p>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => movePaddle(-10)}>Left</Button>
          <Button type="button" size="sm" onClick={start}>{running ? "Restart" : "Start"}</Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => movePaddle(10)}>Right</Button>
        </div>
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
  const [orderMode, setOrderMode] = useState<CustomerOrderMode>("dine-in");
  const setSlug = useTenantStore((s) => s.setSlug);
  const { data: tenant, isLoading: tenantLoading, error: tenantError } = useTenant(slug);
  const { data: menu } = useMenu(slug);
  const { data: timeline } = useTimeline(slug);

  const getCustomer = useCustomerAuthStore((s) => s.getCustomer);
  const clearCustomer = useCustomerAuthStore((s) => s.clearCustomer);
  const customer = slug ? getCustomer(slug) : null;
  const carts = useCustomerOrderStore((s) => s.carts);
  const orders = useCustomerOrderStore((s) => s.orders);
  const addItem = useCustomerOrderStore((s) => s.addItem);
  const updateQuantity = useCustomerOrderStore((s) => s.updateQuantity);
  const clearCart = useCustomerOrderStore((s) => s.clearCart);
  const submitOrder = useCustomerOrderStore((s) => s.submitOrder);
  const updateOrderStatus = useCustomerOrderStore((s) => s.updateOrderStatus);

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
  const cart = slug ? carts[slug] ?? [] : [];
  const customerOrders = slug ? orders[slug] ?? [] : [];
  const cartTotalCents = cart.reduce((sum, item) => sum + (item.price_cents ?? 0) * item.quantity, 0);
  const creditLimit = 50;
  const creditsUsed = Math.min(creditLimit, messages.filter((message) => message.role === "user").length);
  const creditsRemaining = Math.max(0, creditLimit - creditsUsed);

  useEffect(() => {
    if (!slug || customerOrders.length === 0) return;
    const timers = customerOrders.flatMap((order) => {
      if (order.status === "ready") return [];
      const age = Date.now() - new Date(order.created_at).getTime();
      const preparingDelay = Math.max(0, 5_000 - age);
      const readyDelay = Math.max(0, 15_000 - age);
      const nextTimers: number[] = [];
      if (order.status === "received") {
        nextTimers.push(window.setTimeout(() => updateOrderStatus(slug, order.id, "preparing"), preparingDelay));
      }
      nextTimers.push(window.setTimeout(() => updateOrderStatus(slug, order.id, "ready"), readyDelay));
      return nextTimers;
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [slug, customerOrders, updateOrderStatus]);

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
                      {availableMenuItems.slice(0, 18).map((item) => {
                        const cartItem = cart.find((entry) => entry.item_id === item.id);
                        return (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-ink-200 bg-white p-3 transition hover:border-[var(--tenant-primary)] hover:shadow-sm dark:border-ink-800 dark:bg-ink-900"
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
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => send(`Tell me about ${item.name}`)}
                              className="text-xs font-medium text-ink-500 hover:text-[var(--tenant-primary)]"
                            >
                              Ask AI
                            </button>
                            <Button type="button" size="sm" variant="tenant" onClick={() => { if (slug) addItem(slug, item); }}>
                              <Plus className="h-3.5 w-3.5" />
                              {cartItem ? `Add (${cartItem.quantity})` : "Add"}
                            </Button>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-ink-500">No available menu items found yet.</p>
                  )}

                  <div className="mt-4 rounded-2xl border border-ink-200 bg-ink-50 p-4 dark:border-ink-800 dark:bg-ink-950/40">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4 text-[var(--tenant-primary)]" />
                        <div className="text-sm font-semibold text-ink-900 dark:text-ink-100">Cart</div>
                      </div>
                      {cart.length > 0 && slug && (
                        <button
                          type="button"
                          onClick={() => clearCart(slug)}
                          className="text-xs font-medium text-ink-500 hover:text-rose-600"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {cart.length === 0 ? (
                      <p className="text-sm text-ink-500">Add menu items to start an order.</p>
                    ) : (
                      <div className="space-y-3">
                        {cart.map((item) => (
                          <div key={item.item_id} className="flex items-center justify-between gap-3 rounded-xl bg-white p-2 dark:bg-ink-900">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">{item.name}</div>
                              <div className="text-xs text-ink-500">
                                {item.price_cents != null ? formatPrice(item.price_cents) : "Market price"}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button type="button" size="sm" variant="secondary" onClick={() => slug && updateQuantity(slug, item.item_id, item.quantity - 1)}>
                                {item.quantity === 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                              </Button>
                              <span className="w-6 text-center text-sm font-semibold text-ink-900 dark:text-ink-100">{item.quantity}</span>
                              <Button type="button" size="sm" variant="secondary" onClick={() => slug && updateQuantity(slug, item.item_id, item.quantity + 1)}>
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}

                        <div className="grid grid-cols-2 gap-2">
                          {(["dine-in", "take-out"] as CustomerOrderMode[]).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setOrderMode(mode)}
                              className={cn(
                                "rounded-xl border px-3 py-2 text-sm font-medium transition",
                                orderMode === mode
                                  ? "border-[var(--tenant-primary)] bg-[var(--tenant-primary)] text-white"
                                  : "border-ink-200 bg-white text-ink-700 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-200",
                              )}
                            >
                              {mode === "dine-in" ? "Dine-in" : "Take-out"}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center justify-between border-t border-ink-200 pt-3 dark:border-ink-800">
                          <div>
                            <div className="text-xs text-ink-500">Total</div>
                            <div className="text-lg font-semibold text-ink-900 dark:text-ink-100">{formatPrice(cartTotalCents)}</div>
                          </div>
                          <Button
                            type="button"
                            variant="tenant"
                            onClick={() => {
                              if (!slug || !customer) return;
                              const order = submitOrder(slug, customer.customer_id, orderMode);
                              if (!order) return;
                              toast.success(`Order placed. Token #${order.token_number}.`);
                              setPanelTab("orders");
                            }}
                          >
                            Place order
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
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
              <ConnectDotsGame />
              <SnakeAndLadderGame />
              <div className="xl:col-span-2">
                <PingPongGame />
              </div>
            </div>
          )}

          {panelTab === "orders" && (
            <Card>
              <CardHeader>
                <CardTitle>Order status</CardTitle>
                <CardDescription>Track current and recent customer orders for this tenant.</CardDescription>
              </CardHeader>
              <CardBody>
                {customerOrders.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-ink-300 bg-ink-50 p-6 text-center dark:border-ink-700 dark:bg-ink-950/40">
                    <ReceiptText className="mx-auto h-8 w-8 text-ink-400" />
                    <p className="mt-2 text-sm font-medium text-ink-900 dark:text-ink-100">No orders yet</p>
                    <p className="mt-1 text-sm text-ink-500">Add menu items to your cart and place an order.</p>
                    <Button type="button" variant="secondary" className="mt-4" onClick={() => setPanelTab("chat")}>
                      Browse menu
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {customerOrders.map((order) => (
                      <div key={order.id} className="rounded-2xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-[var(--tenant-primary)] px-3 py-1 text-xs font-semibold text-white">
                                Token #{order.token_number}
                              </span>
                              <span className="rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-600 dark:border-ink-700 dark:text-ink-300">
                                {order.mode === "dine-in" ? "Dine-in" : "Take-out"}
                              </span>
                              {order.table_number && (
                                <span className="rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-600 dark:border-ink-700 dark:text-ink-300">
                                  Table #{order.table_number}
                                </span>
                              )}
                            </div>
                            <div className="mt-3 text-sm text-ink-500">
                              Ordered {new Date(order.created_at).toLocaleString()}
                            </div>
                          </div>
                          <div
                            className={cn(
                              "rounded-2xl px-4 py-2 text-sm font-semibold",
                              order.status === "ready"
                                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                                : order.status === "preparing"
                                  ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                                  : "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200",
                            )}
                          >
                            {ORDER_STATUS_LABELS[order.status]}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-2">
                          {order.items.map((item) => (
                            <div key={item.item_id} className="flex items-center justify-between gap-3 rounded-xl bg-ink-50 px-3 py-2 dark:bg-ink-950/40">
                              <div className="text-sm font-medium text-ink-900 dark:text-ink-100">
                                {item.quantity}x {item.name}
                              </div>
                              <div className="text-sm text-ink-500">
                                {item.price_cents != null ? formatPrice(item.price_cents * item.quantity) : "Market price"}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 pt-3 dark:border-ink-800">
                          <div className="text-sm text-ink-500">
                            Total <span className="font-semibold text-ink-900 dark:text-ink-100">{formatPrice(order.total_cents)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-ink-500">
                            <span className={cn("h-2 w-2 rounded-full", order.status === "ready" ? "bg-emerald-500" : "bg-amber-500")} />
                            {order.status === "ready" ? "Food is ready." : "Status updates automatically."}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
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
