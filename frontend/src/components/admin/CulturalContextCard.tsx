import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Globe } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useUpdateCultural } from "@/hooks/useKnowledge";
import { useAdminTenants } from "@/hooks/useAdmin";

// Top 40-ish market ISO codes we care about. Free-text still allowed for long tail.
const COMMON_COUNTRIES: Array<[string, string]> = [
  ["US", "United States"], ["IN", "India"], ["CA", "Canada"], ["GB", "United Kingdom"],
  ["MX", "Mexico"], ["AU", "Australia"], ["DE", "Germany"], ["FR", "France"],
  ["IT", "Italy"], ["ES", "Spain"], ["NL", "Netherlands"], ["JP", "Japan"],
  ["KR", "South Korea"], ["CN", "China"], ["SG", "Singapore"], ["MY", "Malaysia"],
  ["TH", "Thailand"], ["VN", "Vietnam"], ["PH", "Philippines"], ["ID", "Indonesia"],
  ["BR", "Brazil"], ["AR", "Argentina"], ["CL", "Chile"], ["CO", "Colombia"],
  ["AE", "UAE"], ["SA", "Saudi Arabia"], ["ZA", "South Africa"], ["NG", "Nigeria"],
  ["KE", "Kenya"], ["EG", "Egypt"], ["TR", "Turkey"], ["IL", "Israel"],
  ["IE", "Ireland"], ["SE", "Sweden"], ["NO", "Norway"], ["DK", "Denmark"],
  ["FI", "Finland"], ["PL", "Poland"], ["PT", "Portugal"], ["NZ", "New Zealand"],
];

export function CulturalContextCard({ slug }: { slug: string }) {
  const { data: tenants } = useAdminTenants();
  const update = useUpdateCultural();

  // Pull current country + cultural_context from tenant admin list
  // (we include these in AdminTenant via backend — see below if not).
  const tenant = tenants?.find((t: any) => t.slug === slug);
  const [countryCode, setCountryCode] = useState<string>("");
  const [cuisine, setCuisine] = useState<string>("");

  useEffect(() => {
    const t: any = tenant;
    if (!t) return;
    setCountryCode(t.country_code ?? "");
    setCuisine(t.cultural_context?.cuisine ?? "");
  }, [tenant]);

  const save = async () => {
    try {
      await update.mutateAsync({
        slug,
        country_code: countryCode.trim().toUpperCase() || null,
        cultural_context: { cuisine: cuisine.trim() || undefined },
      });
      toast.success("Cultural context saved.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-900/40">
            <Globe className="h-4 w-4" />
          </div>
          <div>
            <CardTitle>Cultural context</CardTitle>
            <CardDescription>
              Drives timeline awareness — e.g. Diwali for Indian tenants, Christmas everywhere, Cinco de Mayo for US/Mexico.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Country" hint="ISO-3166 alpha-2 (e.g. US, IN, MX). Pick from the list or type.">
            <div className="flex gap-2">
              <select
                value={COMMON_COUNTRIES.some(([c]) => c === countryCode) ? countryCode : ""}
                onChange={(e) => setCountryCode(e.target.value)}
                className="h-10 flex-1 rounded-xl border border-ink-200 bg-white px-3 text-sm dark:border-ink-700 dark:bg-ink-800"
              >
                <option value="">— pick —</option>
                {COMMON_COUNTRIES.map(([code, name]) => (
                  <option key={code} value={code}>{code} · {name}</option>
                ))}
              </select>
              <Input
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                maxLength={2}
                placeholder="Or type"
                className="w-24 uppercase"
              />
            </div>
          </Field>
          <Field label="Cuisine" hint="Free-form: 'north indian', 'mexican', 'pan-asian'…">
            <Input value={cuisine} onChange={(e) => setCuisine(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4">
          <Button onClick={save} loading={update.isPending}>Save</Button>
        </div>
      </CardBody>
    </Card>
  );
}
