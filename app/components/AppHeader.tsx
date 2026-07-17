"use client";

import Link from "next/link";
import { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  backHref?: string;
  right?: ReactNode;
}

export function AppHeader({ title, subtitle, backHref, right }: Props) {
  return (
    <header className="mb-5 flex items-center justify-between gap-3">
      <div className="flex w-16 justify-start">
        {backHref && (
          <Link
            href={backHref}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel)] text-lg text-[var(--muted)] active:scale-95"
            aria-label="חזרה"
          >
            ›
          </Link>
        )}
      </div>
      <div className="min-w-0 flex-1 text-center">
        <h1 className="truncate text-lg font-extrabold">{title}</h1>
        {subtitle && <p className="truncate text-xs text-[var(--muted)]">{subtitle}</p>}
      </div>
      <div className="flex w-16 justify-end">{right}</div>
    </header>
  );
}
