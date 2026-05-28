import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";

export type Role = "admin" | "employee" | "owner";

export interface MeProfile {
  user_id: string;
  email: string;
  role: Role;
  display_name?: string | null;
  tenants: Array<{ slug: string; name: string; business_type: string }>;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: MeProfile | null;
  ready: boolean;
  profileLoading: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: MeProfile | null) => void;
  setProfileLoading: (loading: boolean) => void;
  setReady: (ready: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  profile: null,
  ready: false,
  profileLoading: false,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setProfile: (profile) => set({ profile }),
  setProfileLoading: (profileLoading) => set({ profileLoading }),
  setReady: (ready) => set({ ready }),
  clear: () => set({ session: null, user: null, profile: null }),
}));
