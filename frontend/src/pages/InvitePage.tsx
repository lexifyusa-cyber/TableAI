import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, KeyRound, Mail } from "lucide-react";
import { useAuth, signInWithOtp, verifyOtp } from "@/hooks/useAuth";
import { useAcceptInvite } from "@/hooks/useAdmin";
import { refreshProfile } from "@/hooks/useAuth";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";

export function InvitePage() {
  const [params] = useSearchParams();
  const { isAuthed } = useAuth();
  const accept = useAcceptInvite();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [code, setCode] = useState(params.get("code") || "");
  const [otpSent, setOtpSent] = useState(false);

  const token = params.get("token");

  useEffect(() => {
    // Auto-accept if signed in and a token is present in the URL.
    if (isAuthed && token && !accept.data && !accept.isPending) {
      (async () => {
        try {
          const r = await accept.mutateAsync({ token });
          await refreshProfile();
          toast.success(`You're linked to ${r.tenant_name}.`);
          setTimeout(() => nav("/dashboard"), 1200);
        } catch (e) { toast.error((e as Error).message); }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, token]);

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await signInWithOtp(email); setOtpSent(true); toast.success("Check your email."); }
    catch (e) { toast.error((e as Error).message); }
  };

  const verifyAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await verifyOtp(email, otp);
      await refreshProfile();
      const r = await accept.mutateAsync({ token: token || undefined, code: code || undefined });
      toast.success(`Joined ${r.tenant_name}.`);
      setTimeout(() => nav("/dashboard"), 800);
    } catch (e) { toast.error((e as Error).message); }
  };

  const manualAccept = async () => {
    try {
      const r = await accept.mutateAsync({ code });
      await refreshProfile();
      toast.success(`Joined ${r.tenant_name}.`);
      setTimeout(() => nav("/dashboard"), 800);
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-md items-center justify-center px-4 py-12">
      <div className="w-full">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500 text-white">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">You've been invited</h1>
          <p className="mt-1 text-sm text-ink-500">Sign in to link your account to the tenant.</p>
        </div>

        {isAuthed ? (
          accept.data ? (
            <Card>
              <CardBody className="py-8 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
                <p className="mt-3 font-semibold">You're in — {accept.data.tenant_name}.</p>
                <p className="mt-1 text-sm text-ink-500">Redirecting to your dashboard…</p>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHeader><CardTitle>Enter your code</CardTitle><CardDescription>You already have an invite token in the URL — otherwise paste the 6-digit code from your email.</CardDescription></CardHeader>
              <CardBody className="space-y-3">
                <Field label="6-digit code">
                  <Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} className="tracking-[0.3em] text-center font-mono" />
                </Field>
                <Button onClick={manualAccept} loading={accept.isPending} disabled={!code && !token} className="w-full">Accept invite</Button>
              </CardBody>
            </Card>
          )
        ) : !otpSent ? (
          <Card>
            <CardHeader><CardTitle>Sign in with your email</CardTitle><CardDescription>We'll send a code.</CardDescription></CardHeader>
            <CardBody>
              <form onSubmit={requestOtp} className="space-y-3">
                <Field label="Email">
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                    <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" />
                  </div>
                </Field>
                <Button type="submit" className="w-full">Send code</Button>
              </form>
              <p className="mt-4 text-center text-xs text-ink-500">
                Already have a password? <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">Sign in</Link>
              </p>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader><CardTitle>Enter the code</CardTitle><CardDescription>Sent to {email}.</CardDescription></CardHeader>
            <CardBody>
              <form onSubmit={verifyAndAccept} className="space-y-3">
                <Field label="Login code (6 digits)">
                  <Input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" maxLength={6} required className="tracking-[0.3em] text-center font-mono" />
                </Field>
                {!token && (
                  <Field label="Invite code (6 digits)">
                    <Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} className="tracking-[0.3em] text-center font-mono" />
                  </Field>
                )}
                <Button type="submit" loading={accept.isPending} className="w-full">Verify & accept</Button>
              </form>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
