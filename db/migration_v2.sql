-- =============================================================
-- מיגרציה v2 — הרץ ב-Supabase SQL Editor (New query -> הדבק -> Run)
-- בטוח להרצה גם אם כבר הרצת חלק (idempotent).
-- מוסיף: סגל קבוע, סטטוס משחק, קישור שחקן-לסגל, קרן לזכותנו/לחובתנו.
-- =============================================================

-- 1) סגל קבוע ברמת הקבוצה (לא קשור למשחק ספציפי)
create table if not exists public.squad_players (
  id uuid primary key default gen_random_uuid(),
  shirt_number int not null,
  name text not null,
  position text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2) סטטוס וזמן סיום למשחק
alter table public.matches add column if not exists status text not null default 'live';
alter table public.matches add column if not exists ended_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'matches_status_check'
  ) then
    alter table public.matches
      add constraint matches_status_check check (status in ('live','finished'));
  end if;
end $$;

-- 3) קישור שחקן-במשחק לשחקן-בסגל (snapshot נשמר ב-players)
alter table public.players
  add column if not exists squad_player_id uuid references public.squad_players(id) on delete set null;

-- 4) קרן לזכותנו / לחובתנו (מחליף את 'corner' הישן)
alter table public.events drop constraint if exists events_action_type_check;
alter table public.events add constraint events_action_type_check
  check (action_type in ('key_pass','tackle','ball_loss','shot','corner_for','corner_against','corner'));

-- המרת אירועי 'corner' ישנים (אם יש) לקרן לזכותנו
update public.events set action_type = 'corner_for' where action_type = 'corner';

-- 5) RLS לטבלת הסגל (כלי לאיש-אחד: גישה מלאה עם anon key)
alter table public.squad_players enable row level security;
drop policy if exists "public all squad" on public.squad_players;
create policy "public all squad" on public.squad_players for all using (true) with check (true);
