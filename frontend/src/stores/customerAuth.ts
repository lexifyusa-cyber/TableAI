import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CustomerProfile } from "@/types/api";

interface CustomerAuthState {
  customers: Record<string, CustomerProfile>;
  setCustomer: (slug: string, profile: CustomerProfile) => void;
  getCustomer: (slug: string) => CustomerProfile | null;
  clearCustomer: (slug: string) => void;
  clearAll: () => void;
}

export const useCustomerAuthStore = create<CustomerAuthState>()(
  persist(
    (set, get) => ({
      customers: {},
      setCustomer: (slug, profile) =>
        set((s) => ({ customers: { ...s.customers, [slug]: profile } })),
      getCustomer: (slug) => get().customers[slug] ?? null,
      clearCustomer: (slug) =>
        set((s) => {
          const next = { ...s.customers };
          delete next[slug];
          return { customers: next };
        }),
      clearAll: () => set({ customers: {} }),
    }),
    { name: "tableai.customer-auth" },
  ),
);
