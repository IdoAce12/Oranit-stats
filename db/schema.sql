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
  status text not null default 'live' check (status in ('scheduled','live','finished')),
  match_type text not null default 'league' check (match_type in ('league','cup','friendly')),
  kickoff_at timestamptz,
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
  action_type text not null check (action_type in (
    'key_pass','tackle','ball_loss','shot','goal','assist',
    'corner_for','corner_against',
    'aerial_won','aerial_lost','ground_won','ground_lost'
  )),
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

-- =============================================================
-- כניסת מאמן / שחקן — טבלה ידנית, סיסמה מוצפנת ב-trigger
-- =============================================================
create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  password text,
  password_hash text,
  role text not null check (role in ('coach', 'player')),
  squad_player_id uuid references public.squad_players(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists app_users_username_lower
  on public.app_users (lower(username));

create or replace function public.app_users_hash_password()
returns trigger
language plpgsql
as $$
declare
  raw text;
begin
  raw := coalesce(nullif(trim(new.password), ''), nullif(trim(new.password_hash), ''));
  if raw is null then
    raise exception 'חובה למלא סיסמה בשדה password';
  end if;
  if raw like '$2%' then
    new.password_hash := raw;
  else
    new.password_hash := crypt(raw, gen_salt('bf'));
    new.password := raw;
  end if;
  return new;
end;
$$;

drop trigger if exists app_users_hash_password on public.app_users;
create trigger app_users_hash_password
  before insert or update of password, password_hash on public.app_users
  for each row execute function public.app_users_hash_password();

create or replace function public.verify_login(p_username text, p_password text)
returns table (
  id uuid,
  username text,
  role text,
  squad_player_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select u.id, u.username, u.role, u.squad_player_id
  from public.app_users u
  where lower(u.username) = lower(trim(p_username))
    and (
      (u.password is not null and u.password = p_password)
      or (u.password_hash is not null and u.password_hash = crypt(p_password, u.password_hash))
    )
  limit 1;
end;
$$;

revoke all on public.app_users from anon, authenticated, public;
alter table public.app_users enable row level security;

grant execute on function public.verify_login(text, text) to anon, authenticated;
