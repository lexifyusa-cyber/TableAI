import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { KeyRound, LogOut, Mail, MessageSquare, Store, UserCircle } from "lucide-react";
import { signInWithPassword, signInWithOtp, verifyOtp, refreshProfile } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/auth";
import { useCustomerAuthStore } from "@/stores/customerAuth";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

type Tab = "password" | "magic";
type AuthMode = "owner" | "customer";

export function LoginPage() {
  const [authMode, setAuthMode] = useState<AuthMode>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has("tenant") ? "customer" : "owner";
  });
  const [tab, setTab] = useState<Tab>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [token, setToken] = useState("");
  const [customerTenant, setCustomerTenant] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tenant") || "gif";
  });
  const [submitting, setSubmitting] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: string })?.from ?? null;
  const getCustomer = useCustomerAuthStore((s) => s.getCustomer);
  const clearCustomer = useCustomerAuthStore((s) => s.clearCustomer);
  const customerSlug = customerTenant.trim().replace(/^\/+|\/+$/g, "");
  const customer = customerSlug ? getCustomer(customerSlug) : null;

  const redirectByRole = async () => {
    await refreshProfile();
    const profile = useAuthStore.getState().profile;
    if (from) return nav(from, { replace: true });
    if (profile?.role === "admin" || profile?.role === "employee") return nav("/admin", { replace: true });
    return nav("/dashboard", { replace: true });
  };

  const onPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signInWithPassword(email, password);
      toast.success("Welcome back.");
      await redirectByRole();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const onMagicRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signInWithOtp(email);
      setOtpSent(true);
      toast.success("Check your email for a 6-digit code.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const onMagicVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await verifyOtp(email, token);
      toast.success("Signed in.");
      await redirectByRole();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-5xl items-center justify-center px-4 py-12">
      <div className="w-full">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-900 text-white dark:bg-white dark:text-ink-900">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-100">
            Sign in to TableAI
          </h1>
          <p className="mt-1 text-sm text-ink-500">Choose owner dashboard access or customer menu chat.</p>
        </div>

        <Card className="mx-auto max-w-lg">
          <CardHeader>
            <div className="mb-4 grid grid-cols-2 rounded-xl bg-ink-100 p-1 dark:bg-ink-800">
              {(["owner", "customer"] as AuthMode[]).map((mode) => {
                const active = authMode === mode;
                const Icon = mode === "owner" ? Store : MessageSquare;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAuthMode(mode)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-ink-100"
                        : "text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-200",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {mode === "owner" ? "Owner" : "Customer"}
                  </button>
                );
              })}
            </div>

            {authMode === "owner" ? (
              <>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-ink-900 text-white dark:bg-white dark:text-ink-900">
                  <Store className="h-5 w-5" />
                </div>
                <CardTitle>Owner login</CardTitle>
                <CardDescription>For owners and staff managing tenants, menus, providers, and analytics.</CardDescription>
              </>
            ) : (
              <>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <CardTitle>Customer login</CardTitle>
                <CardDescription>For diners or customers opening one tenant's menu and AI chat.</CardDescription>
              </>
            )}
          </CardHeader>
          <CardBody>
            {authMode === "owner" ? (
              <>
                <div className="mb-5 grid grid-cols-2 rounded-xl bg-ink-100 p-1 dark:bg-ink-800">
                  {(["password", "magic"] as Tab[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setTab(t); setOtpSent(false); }}
                      className={cn(
                        "rounded-lg py-2 text-sm font-medium transition-colors",
                        tab === t
                          ? "bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-ink-100"
                          : "text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-200",
                      )}
                    >
                      {t === "password" ? "Password" : "Magic code"}
                    </button>
                  ))}
                </div>

                {tab === "password" ? (
                  <form onSubmit={onPassword} className="space-y-3.5">
                    <Field label="Email">
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                        <Input
                          type="email"
                          autoComplete="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-9"
                          placeholder="owner@tableai.local"
                        />
                      </div>
                    </Field>
                    <Field label="Password">
                      <Input
                        type="password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </Field>
                    <Button type="submit" className="w-full" loading={submitting}>
                      Sign in as owner
                    </Button>
                    <p className="text-center text-xs text-ink-500">
                      Local dev seed: <code className="font-mono">owner@tableai.local</code> / <code className="font-mono">tableai-dev-2026</code>
                    </p>
                  </form>
                ) : !otpSent ? (
                  <form onSubmit={onMagicRequest} className="space-y-3.5">
                    <Field label="Email" hint="We'll send a 6-digit code.">
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                        <Input
                          type="email"
                          autoComplete="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </Field>
                    <Button type="submit" className="w-full" loading={submitting}>
                      Send owner code
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={onMagicVerify} className="space-y-3.5">
                    <Field label="6-digit code" hint={`Sent to ${email}.`}>
                      <Input
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        inputMode="numeric"
                        maxLength={6}
                        autoComplete="one-time-code"
                        required
                        className="tracking-[0.3em] text-center font-mono"
                        placeholder="______"
                      />
                    </Field>
                    <Button type="submit" className="w-full" loading={submitting}>
                      Verify owner login
                    </Button>
                    <button
                      type="button"
                      onClick={() => setOtpSent(false)}
                      className="block w-full text-center text-xs text-ink-500 hover:text-ink-700"
                    >
                      Use a different email
                    </button>
                  </form>
                )}
              </>
            ) : customer ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-ink-200 bg-ink-50 p-4 dark:border-ink-800 dark:bg-ink-900/40">
                  <div className="flex items-start gap-3">
                    <UserCircle className="mt-0.5 h-6 w-6 text-ink-500" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-ink-900 dark:text-ink-100">
                        {customer.display_name || customer.email || "Customer"}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-ink-500">
                        Signed in for /{customer.tenant}
                      </div>
                    </div>
                  </div>
                </div>
                <Link to={`/c/${customer.tenant}`} className="block">
                  <Button type="button" variant="secondary" className="w-full">
                    <MessageSquare className="h-4 w-4" />
                    Open menu and chat
                  </Button>
                </Link>
                <button
                  type="button"
                  onClick={() => clearCustomer(customer.tenant)}
                  className="flex w-full items-center justify-center gap-2 text-sm text-ink-500 hover:text-ink-900 dark:hover:text-ink-200"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out customer
                </button>
              </div>
            ) : (
              <form
                className="space-y-3.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!customerSlug) return toast.error("Enter a tenant slug.");
                  nav(`/c/${encodeURIComponent(customerSlug)}/login`);
                }}
              >
                <Field label="Tenant slug" hint="Example: gif">
                  <Input
                    value={customerTenant}
                    onChange={(e) => setCustomerTenant(e.target.value)}
                    autoComplete="off"
                    placeholder="gif"
                  />
                </Field>
                <Button type="submit" variant="secondary" className="w-full">
                  <MessageSquare className="h-4 w-4" />
                  Continue as customer
                </Button>
                <p className="text-xs leading-5 text-ink-500">
                  Customer accounts are separate from owner accounts and only attach to the selected tenant's menu and chat.
                </p>
              </form>
            )}
          </CardBody>
        </Card>

        <p className="mt-6 text-center text-xs text-ink-500">
          <Link to="/" className="hover:text-ink-900 dark:hover:text-ink-200">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
