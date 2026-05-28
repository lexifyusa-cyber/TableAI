import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { MenuResponse } from "@/types/api";

export function useMenu(slug: string | undefined | null) {
  const [data, setData] = useState<MenuResponse | undefined>();
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!slug);
  useEffect(() => {
    if (!slug) { setData(undefined); setIsLoading(false); return; }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    api.getMenu(slug)
      .then((d) => { if (!cancelled) { setData(d); setIsLoading(false); } })
      .catch((e: Error) => { if (!cancelled) { setError(e); setIsLoading(false); } });
    return () => { cancelled = true; };
  }, [slug]);
  return { data, error, isLoading };
}
