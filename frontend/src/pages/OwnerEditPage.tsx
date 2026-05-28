import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Sparkles, Send } from "lucide-react";
import { useTenant } from "@/hooks/useTenants";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface ProposeResult {
  tenant_fields: Record<string, unknown>;
  item_edits: Array<{ match: { name?: string }; set: Record<string, unknown> }>;
  notes?: string | null;
}

export function OwnerEditPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: tenant } = useTenant(slug);
  const [text, setText] = useState("");
  const [proposal, setProposal] = useState<ProposeResult | null>(null);
  const [busy, setBusy] = useState(false);

  if (!tenant) return <div className="mx-auto max-w-3xl p-8"><Skeleton className="h-40" /></div>;

  const onPropose = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const res = await (api as unknown as { request: <T>(p: string, init?: RequestInit) => Promise<T> }).request<ProposeResult>(
        "/api/owner/edit/propose",
        {
          method: "POST",
          body: JSON.stringify({ tenant: slug, text }),
        },
      );
      setProposal(res);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onApply = async () => {
    if (!proposal) return;
    setBusy(true);
    try {
      await (api as unknown as { request: <T>(p: string, init?: RequestInit) => Promise<T> }).request<unknown>(
        "/api/owner/edit/apply",
        {
          method: "POST",
          body: JSON.stringify({ tenant: slug, ...proposal }),
        },
      );
      toast.success("Edits applied.");
      setText("");
      setProposal(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <div className="mb-6 flex items-center gap-2 text-sm text-ink-500">
        <Link to={`/dashboard`} className="inline-flex items-center gap-1 hover:text-ink-900">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <span>/</span>
        <span className="text-ink-900">{tenant.name}</span>
      </div>

      <h1 className="text-3xl font-semibold tracking-tight text-ink-900">Edit your restaurant</h1>
      <p className="mt-2 text-sm text-ink-500 max-w-xl">
        Describe what you want to change in plain English. Our AI will translate it into specific edits and show you a preview before anything goes live.
      </p>

      <Card className="mt-8">
        <CardBody>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-600">
            Your changes
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={'E.g. "The Burrito should be $9.95. The address is wrong — fix to 250 Park Ave, Manhattan. Remove the Spicy 2 tag from Buffalo Chicken Burrito."'}
            className="mt-2 w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm leading-snug placeholder:text-ink-400 focus:border-ink-400 focus:outline-none dark:border-ink-700 dark:bg-ink-900"
          />
          <div className="mt-3 flex gap-2">
            <Button onClick={onPropose} loading={busy} disabled={!text.trim()}>
              <Sparkles className="h-4 w-4" />
              Preview changes
            </Button>
          </div>
        </CardBody>
      </Card>

      {proposal && (
        <Card className="mt-6 border-2 border-brand-300">
          <CardBody>
            <h2 className="text-lg font-semibold">Proposed changes</h2>
            {proposal.notes && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                Note: {proposal.notes}
              </p>
            )}

            {Object.keys(proposal.tenant_fields).length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">Tenant fields</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {Object.entries(proposal.tenant_fields).map(([k, v]) => (
                    <li key={k} className="flex gap-2">
                      <code className="text-ink-600">{k}</code>
                      <span className="text-ink-400">→</span>
                      <code className="text-ink-900">{typeof v === "string" ? v : JSON.stringify(v)}</code>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {proposal.item_edits.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">Item edits</h3>
                <ul className="mt-2 space-y-2 text-sm">
                  {proposal.item_edits.map((ie, idx) => (
                    <li key={idx} className="rounded-lg border border-ink-200 p-3">
                      <div className="font-medium text-ink-900">{ie.match.name || "?"}</div>
                      <ul className="mt-1 ml-3 list-disc space-y-0.5 text-xs text-ink-600">
                        {Object.entries(ie.set).map(([k, v]) => (
                          <li key={k}>
                            <code>{k}</code>{" = "}
                            <code className="text-ink-900">{typeof v === "string" ? v : JSON.stringify(v)}</code>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 flex gap-2">
              <Button onClick={onApply} loading={busy}>
                <Send className="h-4 w-4" />
                Apply changes
              </Button>
              <Button variant="ghost" onClick={() => setProposal(null)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
