import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TenantState {
  currentSlug: string | null;
  setSlug: (slug: string | null) => void;
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set) => ({
      currentSlug: null,
      setSlug: (slug) => set({ currentSlug: slug }),
    }),
    { name: "tableai.tenant" },
  ),
);
