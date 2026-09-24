"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { BottomNav } from "./BottomNav";
import { isTabPath } from "@/lib/authPaths";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const showNav = Boolean(user && !loading && isTabPath(pathname));

  return (
    <>
      {children}
      {showNav ? <BottomNav /> : null}
    </>
  );
}
