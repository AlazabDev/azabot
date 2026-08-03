import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface SessionSnapshot {
  session: Session | null;
  user: User | null;
  hydratedAt: number;
}

const KEY = "azabot.session.snapshot";

const isBrowser = () => typeof window !== "undefined";

export function loadSessionSnapshot(): SessionSnapshot | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionSnapshot;
  } catch {
    return null;
  }
}

export function persistSessionSnapshot(snapshot: SessionSnapshot) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore */
  }
}

export function clearSessionSnapshot() {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export async function readSupabaseSession(): Promise<SessionSnapshot> {
  const { data } = await supabase.auth.getSession();
  return {
    session: data.session ?? null,
    user: data.session?.user ?? null,
    hydratedAt: Date.now(),
  };
}
