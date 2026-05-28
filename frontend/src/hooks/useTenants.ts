import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Tenant } from "@/types/api";

export function useTenants() {
  const [data, setData] = useState<Tenant[] | undefined>();
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  useEffect(() => {
    let cancelled = false;
    api.listTenants()
      .then((d) => { if (!cancelled) { setData(d); setIsLoading(false); } })
      .catch((e: Error) => { if (!cancelled) { setError(e); setIsLoading(false); } });
    return () => { cancelled = true; };
  }, []);
  return { data, error, isLoading };
}

export function useTenant(slug: string | undefined | null) {
  const [data, setData] = useState<Tenant | undefined>();
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!slug);
  useEffect(() => {
    if (!slug) { setData(undefined); setIsLoading(false); return; }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    api.getTenant(slug)
      .then((d) => { if (!cancelled) { setData(d); setIsLoading(false); } })
      .catch((e: Error) => { if (!cancelled) { setError(e); setIsLoading(false); } });
    return () => { cancelled = true; };
  }, [slug]);
  return { data, error, isLoading };
}
