-- =============================================================
-- סכמת בסיס הנתונים למערכת הסקאוטינג של ליגה ג'
-- הרצה חד-פעמית ב-Supabase: SQL Editor -> New query -> הדבק -> Run
-- (אם כבר הרצת גרסה קודמת, הרץ במקום זאת את db/migration_v2.sql)
-- =============================================================

-- סגל קבוע ברמת הקבוצה (לא קשור למשחק ספציפי)
create table if not exists public.squad_players (
  id uuid primary key default gen_random_uuid(),
  shirt_number int not null,
  name text not null,
  position text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- טבלת משחקים
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  opponent text not null,
  match_date date not null,
  our_team_name text not null default '',
  status text not null default 'live' check (status in ('live','finished')),
  match_type text not null default 'league' check (match_type in ('league','cup','friendly')),
  ended_at timestamptz,
  notes text not null default '',
  final_half int,
  final_minute int,
  created_at timestamptz not null default now()
);

-- שחקנים במשחק (snapshot נשמר לכל משחק, מקושר לסגל הקבוע)
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  squad_player_id uuid references public.squad_players(id) on delete set null,
  shirt_number int not null,
  name text not null,
  position text,
  is_starter boolean not null default true,
  on_pitch boolean not null default false,
  lineup_slot int check (lineup_slot is null or (lineup_slot >= 0 and lineup_slot <= 9))
);

create index if not exists players_match_idx on public.players(match_id);

-- טבלת אירועים (ה-id נוצר בצד הלקוח כדי לתמוך בתור אופליין ו-Undo)
create table if not exists public.events (
  id uuid primary key,
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  action_type text not null check (action_type in ('key_pass','tackle','ball_loss','shot','goal','assist','corner_for','corner_against')),
  zone text check (zone in ('def','mid','att')),
  shot_location text check (shot_location in ('in_box','out_box')),
  half int not null default 1 check (half in (1,2)),
  match_minute int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists events_match_idx on public.events(match_id);
create index if not exists events_created_idx on public.events(created_at);

-- חילופים (פותח ↔ ספסל) לחישוב דקות משחק
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

-- =============================================================
-- Row Level Security
-- כלי לאיש-אחד: פותחים גישה מלאה עם anon key (ללא התחברות).
-- אם תרצה להגן, החלף ב-policies שמבוססות auth.uid().
-- =============================================================
alter table public.squad_players enable row level security;
alter table public.matches enable row level security;
alter table public.players enable row level security;
alter table public.events enable row level security;
alter table public.substitutions enable row level security;

drop policy if exists "public all squad" on public.squad_players;
drop policy if exists "public all matches" on public.matches;
drop policy if exists "public all players" on public.players;
drop policy if exists "public all events" on public.events;
drop policy if exists "public all substitutions" on public.substitutions;

create policy "public all squad" on public.squad_players for all using (true) with check (true);
create policy "public all matches" on public.matches for all using (true) with check (true);
create policy "public all players" on public.players for all using (true) with check (true);
create policy "public all events" on public.events for all using (true) with check (true);
create policy "public all substitutions" on public.substitutions for all using (true) with check (true);
