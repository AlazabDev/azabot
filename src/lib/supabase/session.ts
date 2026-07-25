import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase/client";

export const SUPABASE_SESSION_STORAGE_KEY = "azab.supabase.session";

export interface SessionSnapshot {
  session: Session | null;
  user: User | null;
  hydratedAt: number;
}

export function createEmptySessionSnapshot(): SessionSnapshot {
  return {
    session: null,
    user: null,
    hydratedAt: Date.now(),
  };
}

export async function readSupabaseSession(): Promise<SessionSnapshot> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    return createEmptySessionSnapshot();
  }

  return {
    session: data.session ?? null,
    user: data.session?.user ?? null,
    hydratedAt: Date.now(),
  };
}

export function persistSessionSnapshot(snapshot: SessionSnapshot): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(SUPABASE_SESSION_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage failures in privacy-restricted browsers.
  }
}

export function loadSessionSnapshot(): SessionSnapshot | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(SUPABASE_SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionSnapshot;
  } catch {
    return null;
  }
}

export function clearSessionSnapshot(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(SUPABASE_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}
