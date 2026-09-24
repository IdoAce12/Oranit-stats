"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth, usePlayerProfileHref } from "./AuthProvider";

function IconHome({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" aria-hidden>
      <path
        d="M4.5 10.5 12 4l7.5 6.5V20a1.5 1.5 0 0 1-1.5 1.5h-4.2v-6.2h-3.6V21.5H6A1.5 1.5 0 0 1 4.5 20z"
        stroke="currentColor"
        strokeWidth={active ? 1.9 : 1.5}
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.18 : 0}
      />
    </svg>
  );
}

function IconCal({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.2" stroke="currentColor" strokeWidth={active ? 1.9 : 1.5} />
      <path d="M8 3.5v3.2M16 3.5v3.2M3.5 9.5h17" stroke="currentColor" strokeWidth={active ? 1.9 : 1.5} strokeLinecap="round" />
    </svg>
  );
}

function IconStats({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" aria-hidden>
      <path
        d="M5 18.5V11M12 18.5V5.5M19 18.5v-5.2"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconSquad({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="2.4" stroke="currentColor" strokeWidth={active ? 1.9 : 1.5} />
      <circle cx="16" cy="9.2" r="2.1" stroke="currentColor" strokeWidth={active ? 1.9 : 1.5} />
      <path
        d="M4.5 18.5c.4-2.8 2.4-4.3 4.6-4.3s4.2 1.5 4.6 4.3M13.2 14.6c1.7-.3 3.6.6 4.3 3.9"
        stroke="currentColor"
        strokeWidth={active ? 1.9 : 1.5}
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconTable({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" aria-hidden>
      <path d="M4.5 5.5h15v13h-15z" stroke="currentColor" strokeWidth={active ? 1.9 : 1.5} />
      <path d="M4.5 9.2h15M10 5.5v13" stroke="currentColor" strokeWidth={active ? 1.9 : 1.5} />
    </svg>
  );
}

function Tab({
  href,
  label,
  active,
  icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`bottom-tab ${active ? "is-active" : ""}`}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const { isCoach } = useAuth();
  const profileHref = usePlayerProfileHref();
  const onHome = pathname === "/";
  const onCal = pathname === "/calendar";
  const onTable = pathname === "/table";
  const onSquad = pathname === "/squad";
  const onSeason = pathname === "/season" || pathname.startsWith("/season/compare");
  const onStats = pathname.startsWith("/season/player/");

  return (
    <nav className="bottom-nav no-print" aria-label="ניווט ראשי">
      <Tab href="/" label="בית" active={onHome} icon={<IconHome active={onHome} />} />
      <Tab href="/calendar" label="לוח" active={onCal} icon={<IconCal active={onCal} />} />
      <Tab href="/table" label="טבלה" active={onTable} icon={<IconTable active={onTable} />} />
      {isCoach ? (
        <>
          <Tab href="/season" label="נתונים" active={onSeason} icon={<IconStats active={onSeason} />} />
          <Tab href="/squad" label="סגל" active={onSquad} icon={<IconSquad active={onSquad} />} />
        </>
      ) : profileHref ? (
        <Tab href={profileHref} label="נתונים" active={onStats} icon={<IconStats active={onStats} />} />
      ) : (
        <span className="bottom-tab opacity-35">
          <IconStats active={false} />
          <span>נתונים</span>
        </span>
      )}
    </nav>
  );
}
