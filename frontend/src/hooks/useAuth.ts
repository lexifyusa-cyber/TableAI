import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase";
import { localAuthEnabled } from "@/lib/env";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/lib/api";

const LOCAL_AUTH_KEY = "tableai.local-auth";

function loadLocalProfile() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: string; role?: string; display_name?: string | null };
    if (!parsed.email) return null;
    return {
      user_id: parsed.email.toLowerCase(),
      email: parsed.email,
      role: (parsed.role as "admin" | "employee" | "owner") || "owner",
      display_name: parsed.display_name ?? null,
      tenants: [],
    };
  } catch {
    return null;
  }
}

function saveLocalProfile(email: string, role: "admin" | "employee" | "owner" = "owner") {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify({ email, role, display_name: null }));
}

function clearLocalProfile() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LOCAL_AUTH_KEY);
}

async function refreshProfile() {
  const store = useAuthStore.getState();
  store.setProfileLoading(true);
  try {
    const profile = await api.me();
    store.setProfile(profile);
  } catch {
    if (localAuthEnabled) {
      store.setProfile(loadLocalProfile());
    } else {
      store.setProfile(null);
    }
  } finally {
    store.setProfileLoading(false);
  }
}

export function useAuthSync() {
  const setSession = useAuthStore((s) => s.setSession);
  const setReady = useAuthStore((s) => s.setReady);
  const setProfile = useAuthStore((s) => s.setProfile);
  const qc = useQueryClient();

  useEffect(() => {
    const supa = getSupabase();
    if (!supa) {
      if (localAuthEnabled) {
        const local = loadLocalProfile();
        if (local) setProfile(local);
      }
      setReady(true);
      return;
    }

    let mounted = true;

    // NOTE: do NOT call supa.auth.getSession() here — it can deadlock with
    // other Supabase calls in flight. onAuthStateChange fires INITIAL_SESSION
    // on mount with the current session, which gives us the same data without
    // grabbing the auth lock.

    const { data: sub } = supa.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      setSession(session);
      if (session) {
        await refreshProfile();
        // New/refreshed session → refetch anything that went out anonymous.
        qc.invalidateQueries();
      } else {
        setProfile(null);
        qc.clear();
      }
      if (event === "INITIAL_SESSION") setReady(true);
    });

    // Safety net: mark ready after 2s even if INITIAL_SESSION never fires
    // (e.g. if Supabase is down). Prevents eternal spinner.
    const readyTimeout = setTimeout(() => {
      if (mounted) setReady(true);
    }, 2000);

    return () => {
      mounted = false;
      clearTimeout(readyTimeout);
      sub.subscription.unsubscribe();
    };
  }, [setSession, setReady, setProfile, qc]);
}

export function useAuth() {
  const { session, user, profile, ready, profileLoading } = useAuthStore();
  return {
    session,
    user,
    profile,
    ready,
    isAuthed: localAuthEnabled ? !!profile : !!session,
    role: profile?.role ?? null,
    tenants: profile?.tenants ?? [],
    profileLoading,
  };
}

export async function signInWithPassword(email: string, password: string) {
  const supa = getSupabase();
  if (!supa) {
    const role = email.toLowerCase().startsWith("admin@") ? "admin" : "owner";
    const profile = {
      user_id: email.toLowerCase(),
      email,
      role: role as "admin" | "employee" | "owner",
      display_name: null,
      tenants: [],
    };
    saveLocalProfile(email, profile.role);
    useAuthStore.getState().setProfile(profile);
    useAuthStore.getState().setReady(true);
    return;
  }
  const { error } = await supa.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signInWithOtp(email: string) {
  const supa = getSupabase();
  if (!supa) {
    const profile = {
      user_id: email.toLowerCase(),
      email,
      role: "owner" as const,
      display_name: null,
      tenants: [],
    };
    saveLocalProfile(email, profile.role);
    useAuthStore.getState().setProfile(profile);
    useAuthStore.getState().setReady(true);
    return;
  }
  const { error } = await supa.auth.signInWithOtp({ email });
  if (error) throw error;
}

export async function verifyOtp(email: string, token: string) {
  const supa = getSupabase();
  if (!supa) {
    const profile = {
      user_id: email.toLowerCase(),
      email,
      role: "owner" as const,
      display_name: null,
      tenants: [],
    };
    saveLocalProfile(email, profile.role);
    useAuthStore.getState().setProfile(profile);
    useAuthStore.getState().setReady(true);
    return;
  }
  const { error } = await supa.auth.verifyOtp({ email, token, type: "email" });
  if (error) throw error;
}

export async function signOut() {
  const supa = getSupabase();
  if (!supa) {
    clearLocalProfile();
    useAuthStore.getState().clear();
    return;
  }
  await supa.auth.signOut();
  useAuthStore.getState().clear();
}

export { refreshProfile };
