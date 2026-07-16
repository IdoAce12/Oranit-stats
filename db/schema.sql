-- =============================================================
-- סכמת בסיס הנתונים למערכת הסקאוטינג של ליגה ג'
-- הרצה חד-פעמית ב-Supabase: SQL Editor -> New query -> הדבק -> Run
-- =============================================================

-- טבלת משחקים
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  opponent text not null,
  match_date date not null,
  our_team_name text not null default '',
  created_at timestamptz not null default now()
);

-- טבלת שחקנים (רשימה נפרדת לכל משחק)
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  shirt_number int not null,
  name text not null,
  position text
);

create index if not exists players_match_idx on public.players(match_id);

-- טבלת אירועים (ה-id נוצר בצד הלקוח כדי לתמוך בתור אופליין ו-Undo)
create table if not exists public.events (
  id uuid primary key,
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  action_type text not null check (action_type in ('key_pass','tackle','ball_loss','shot','corner')),
  zone text check (zone in ('def','mid','att')),
  shot_location text check (shot_location in ('in_box','out_box')),
  half int not null default 1 check (half in (1,2)),
  match_minute int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists events_match_idx on public.events(match_id);
create index if not exists events_created_idx on public.events(created_at);

-- =============================================================
-- Row Level Security
-- כלי לאיש-אחד: פותחים גישה מלאה עם anon key (ללא התחברות).
-- אם תרצה להגן, החלף ב-policies שמבוססות auth.uid().
-- =============================================================
alter table public.matches enable row level security;
alter table public.players enable row level security;
alter table public.events enable row level security;

drop policy if exists "public all matches" on public.matches;
drop policy if exists "public all players" on public.players;
drop policy if exists "public all events" on public.events;

create policy "public all matches" on public.matches for all using (true) with check (true);
create policy "public all players" on public.players for all using (true) with check (true);
create policy "public all events" on public.events for all using (true) with check (true);

-- =============================================================
-- שאילתת בונוס: כל האיבודים בשליש ההגנתי עם דקת משחק (לחיתוך וידאו)
-- =============================================================
-- select e.match_minute, e.half, p.shirt_number, p.name
-- from public.events e
-- left join public.players p on p.id = e.player_id
-- where e.match_id = '<MATCH_ID>' and e.action_type = 'ball_loss' and e.zone = 'def'
-- order by e.half, e.match_minute;
