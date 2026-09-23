"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AppSession } from "@/lib/types";
import { isPublicPath, playerProfilePath } from "@/lib/authPaths";

interface AuthValue {
  user: AppSession | null;
  loading: boolean;
  isCoach: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue>({
  user: null,
  loading: true,
  isCoach: false,
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppSession | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      if (!res.ok) {
        setUser(null);
        return;
      }
      const data = (await res.json()) as { user: AppSession | null };
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await fetch("/api/logout", { method: "POST" });
    setUser(null);
    router.replace("/login");
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublicPath(pathname)) {
      router.replace("/login");
    }
  }, [loading, user, pathname, router]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isCoach: user?.role === "coach",
      refresh,
      logout,
    }),
    [user, loading, refresh, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function usePlayerProfileHref() {
  const { user } = useAuth();
  return playerProfilePath(user?.squadPlayerId ?? null);
}
