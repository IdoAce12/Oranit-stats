-- =============================================================
-- מיגרציה v12 — חיבור להתאחדות לכדורגל (משחקים מתוכננים + טבלה)
-- הרץ ב-Supabase SQL Editor
-- =============================================================

alter table public.matches add column if not exists ifa_key text;

create unique index if not exists matches_ifa_key_uniq
  on public.matches (ifa_key)
  where ifa_key is not null;

create table if not exists public.ifa_cache (
  id text primary key,
  standings jsonb not null default '[]'::jsonb,
  fixtures jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now()
);

alter table public.ifa_cache enable row level security;
drop policy if exists "public all ifa_cache" on public.ifa_cache;
create policy "public all ifa_cache" on public.ifa_cache for all using (true) with check (true);

notify pgrst, 'reload schema';
