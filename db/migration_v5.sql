-- =============================================================
-- מיגרציה v5 — חילופים + דקות משחק
-- הרץ ב-Supabase SQL Editor
-- =============================================================

-- מי על המגרש כרגע (מתעדכן בחילוף)
alter table public.players add column if not exists on_pitch boolean not null default false;

-- סנכרון ראשוני: מי שמסומן כפותח נחשב על המגרש
update public.players set on_pitch = true where is_starter = true and on_pitch = false;

-- זמן סיום משחק (לסגירת דקות של מי שנשאר על המגרש)
alter table public.matches add column if not exists final_half int;
alter table public.matches add column if not exists final_minute int;

-- לוג חילופים
create table if not exists public.substitutions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  player_out_id uuid not null references public.players(id) on delete cascade,
  player_in_id uuid not null references public.players(id) on delete cascade,
  half int not null check (half in (1, 2)),
  match_minute int not null default 0,
  created_at timestamptz not null default now(),
  constraint substitutions_different_players check (player_out_id <> player_in_id)
);

create index if not exists substitutions_match_idx on public.substitutions(match_id);

alter table public.substitutions enable row level security;
drop policy if exists "public all substitutions" on public.substitutions;
create policy "public all substitutions" on public.substitutions for all using (true) with check (true);
