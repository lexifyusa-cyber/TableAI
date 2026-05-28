import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/lib/api";

async function refreshProfile() {
  const store = useAuthStore.getState();
  store.setProfileLoading(true);
  try {
    const profile = await api.me();
    store.setProfile(profile);
  } catch {
    store.setProfile(null);
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
    isAuthed: !!session,
    role: profile?.role ?? null,
    tenants: profile?.tenants ?? [],
    profileLoading,
  };
}

export async function signInWithPassword(email: string, password: string) {
  const supa = getSupabase();
  if (!supa) throw new Error("Supabase not configured.");
  const { error } = await supa.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signInWithOtp(email: string) {
  const supa = getSupabase();
  if (!supa) throw new Error("Supabase not configured.");
  const { error } = await supa.auth.signInWithOtp({ email });
  if (error) throw error;
}

export async function verifyOtp(email: string, token: string) {
  const supa = getSupabase();
  if (!supa) throw new Error("Supabase not configured.");
  const { error } = await supa.auth.verifyOtp({ email, token, type: "email" });
  if (error) throw error;
}

export async function signOut() {
  const supa = getSupabase();
  if (!supa) return;
  await supa.auth.signOut();
  useAuthStore.getState().clear();
}

export { refreshProfile };
