import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase/client";
import { clearSessionSnapshot, persistSessionSnapshot, readSupabaseSession, type SessionSnapshot } from "@/lib/supabase/session";
import type { AppRole } from "@/lib/auth/roles";
import { isAppRole } from "@/lib/auth/roles";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  snapshot: SessionSnapshot;
  loading: boolean;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function resolveRole(user: User | null): Promise<AppRole | null> {
  if (!user) return null;

  const metadataRole = user.user_metadata?.role;
  if (isAppRole(metadataRole)) {
    return metadataRole;
  }

  const roles: AppRole[] = ["super_admin", "admin", "manager", "support", "user"];
  for (const role of roles) {
    const { data, error } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: role,
    });

    if (!error && data) {
      return role;
    }
  }

  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<SessionSnapshot>(() => ({
    session: null,
    user: null,
    hydratedAt: Date.now(),
  }));
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const syncSnapshot = async () => {
    const next = await readSupabaseSession();
    setSnapshot(next);
    persistSessionSnapshot(next);
    setRole(await resolveRole(next.user));
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      const cached = typeof window !== "undefined" ? null : null;
      void cached;
      if (!mounted) return;
      await syncSnapshot();
      setLoading(false);
    })();

    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const next: SessionSnapshot = {
        session,
        user: session?.user ?? null,
        hydratedAt: Date.now(),
      };
      setSnapshot(next);
      if (session) {
        persistSessionSnapshot(next);
      } else {
        clearSessionSnapshot();
      }
      setRole(await resolveRole(session?.user ?? null));
      setLoading(false);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session: snapshot.session,
      user: snapshot.user,
      role,
      snapshot,
      loading,
      refreshSession: async () => {
        setLoading(true);
        await syncSnapshot();
        setLoading(false);
      },
    }),
    [loading, role, snapshot],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
