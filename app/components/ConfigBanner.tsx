"use client";

import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function ConfigBanner() {
  if (isSupabaseConfigured) return null;
  return (
    <div className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
      <p className="font-bold">Supabase לא מחובר עדיין</p>
      <p className="mt-1 leading-relaxed text-amber-100/80">
        צור פרויקט ב-Supabase, הרץ את <code className="rounded bg-black/30 px-1">db/schema.sql</code>,
        והעתק את המפתחות לקובץ <code className="rounded bg-black/30 px-1">.env.local</code>.
      </p>
    </div>
  );
}
