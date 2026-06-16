import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { localAuthEnabled } from "@/lib/env";
import { useAuthStore } from "@/stores/auth";
import { useCustomerAuthStore } from "@/stores/customerAuth";
import { useTenant } from "@/hooks/useTenants";
import { useTenantTheme } from "@/hooks/useTenantTheme";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";

export function CustomerLoginPage() {
  const { slug } = useParams<{ slug: string }>();
  const nav = useNavigate();
  const { data: tenant } = useTenant(slug);
  useTenantTheme(tenant);

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [submitting, setSubmitting] = useState(false);
  const setCustomer = useCustomerAuthStore((s) => s.setCustomer);
  const completedRef = useRef(false);

  const completeLogin = async () => {
    if (!slug || completedRef.current) return;
    completedRef.current = true;
    try {
      const profile = await api.customerJoin({ tenant: slug });
      setCustomer(slug, profile);
      nav(`/c/${slug}`, { replace: true });
    } catch (err) {
      completedRef.current = false;
      toast.error((err as Error).message);
    }
  };

  // Listen for Supabase SIGNED_IN (fired after OTP verification).
  useEffect(() => {
    const supa = getSupabase();
    if (!supa) return;
    const { data: sub } = supa.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        useAuthStore.getState().setSession(session);
        completeLogin();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [slug]);

  const onSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const supa = getSupabase();
      if (!supa) {
        // Local dev — skip Supabase, jump straight to join.
        useAuthStore.getState().setProfile({
          user_id: email.toLowerCase(),
          email,
          role: "owner",
          display_name: null,
          tenants: [],
        });
        useAuthStore.getState().setReady(true);
        await completeLogin();
        return;
      }
      const { error } = await supa.auth.signInWithOtp({ email });
      if (error) throw error;
      setStep("otp");
      toast.success("Check your email for a 6-digit code.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const onVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const supa = getSupabase();
      if (!supa) return;
      const { error } = await supa.auth.verifyOtp({ email, token: otp, type: "email" });
      if (error) throw error;
      // onAuthStateChange fires SIGNED_IN → completeLogin() is called there.
    } catch (err) {
      toast.error((err as Error).message);
      setSubmitting(false);
    }
  };

  const primaryColor = tenant?.brand?.primary_color ?? "#f97316";
  const initials = tenant?.name?.slice(0, 2).toUpperCase() ?? "AI";

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-md items-center justify-center px-4 py-12">
      <div className="w-full">
        <div className="mb-6 text-center">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-white text-lg font-bold shadow-md"
            style={{ backgroundColor: primaryColor }}
          >
            {initials}
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-100">
            {tenant ? `Welcome to ${tenant.name}` : "Welcome"}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Sign in to chat with our AI assistant and explore the menu.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              {step === "email"
                ? "Enter your email to receive a one-time sign-in code."
                : `Enter the 6-digit code we sent to ${email}.`}
            </CardDescription>
          </CardHeader>
          <CardBody>
            {step === "email" ? (
              <form onSubmit={onSendOtp} className="space-y-3.5">
                <Field label="Email address">
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                    <Input
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9"
                      placeholder="you@example.com"
                    />
                  </div>
                </Field>
                <Button
                  type="submit"
                  className="w-full"
                  loading={submitting}
                  style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
                >
                  Send code
                </Button>
                {localAuthEnabled && (
                  <p className="text-center text-xs text-ink-400">
                    Local dev: any email → instant sign-in
                  </p>
                )}
              </form>
            ) : (
              <form onSubmit={onVerifyOtp} className="space-y-3.5">
                <Field label="6-digit code" hint={`Sent to ${email}.`}>
                  <Input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="one-time-code"
                    required
                    className="tracking-[0.3em] text-center font-mono text-lg"
                    placeholder="______"
                    autoFocus
                  />
                </Field>
                <Button
                  type="submit"
                  className="w-full"
                  loading={submitting}
                  style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
                >
                  Verify &amp; sign in
                </Button>
                <button
                  type="button"
                  onClick={() => { setStep("email"); setOtp(""); }}
                  className="block w-full text-center text-xs text-ink-500 hover:text-ink-700 dark:hover:text-ink-300"
                >
                  Use a different email
                </button>
              </form>
            )}
          </CardBody>
        </Card>

        <p className="mt-6 text-center text-xs text-ink-500">
          <Link
            to={`/c/${slug}`}
            className="hover:text-ink-900 dark:hover:text-ink-200 underline underline-offset-2"
          >
            Continue without signing in →
          </Link>
        </p>
      </div>
    </div>
  );
}
