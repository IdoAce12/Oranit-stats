-- =============================================================
-- מיגרציה v9 — משחקים מתוכננים + כניסת מאמן/שחקן
-- הרץ ב-Supabase SQL Editor
-- =============================================================

-- 1) משחק מתוכנן (עוד לא לייב)
alter table public.matches drop constraint if exists matches_status_check;
alter table public.matches
  add constraint matches_status_check
  check (status in ('scheduled', 'live', 'finished'));

alter table public.matches add column if not exists kickoff_at timestamptz;

update public.matches
set kickoff_at = (match_date::timestamptz + interval '20 hours')
where kickoff_at is null and match_date is not null;

-- 2) משתמשים — מגדירים ידנית בטבלה (שם + סיסמה + תפקיד)
create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  password_hash text not null,
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
begin
  if new.password_hash is null or length(trim(new.password_hash)) = 0 then
    raise exception 'חובה סיסמה';
  end if;
  if new.password_hash like '$2%' then
    return new;
  end if;
  new.password_hash := crypt(new.password_hash, gen_salt('bf'));
  return new;
end;
$$;

drop trigger if exists app_users_hash_password on public.app_users;
create trigger app_users_hash_password
  before insert or update of password_hash on public.app_users
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
    and u.password_hash = crypt(p_password, u.password_hash)
  limit 1;
end;
$$;

revoke all on public.app_users from anon, authenticated, public;
alter table public.app_users enable row level security;
drop policy if exists "public all app_users" on public.app_users;

grant execute on function public.verify_login(text, text) to anon, authenticated;

-- =============================================================
-- דוגמאות — הרץ אחרי המיגרציה, החלף סיסמאות ו-uuid
--
-- מאמן:
-- insert into public.app_users (username, password_hash, role)
-- values ('מאמן', 'סיסמה-של-מאמן', 'coach');
--
-- שחקן (squad_player_id מטבלת squad_players):
-- insert into public.app_users (username, password_hash, role, squad_player_id)
-- values ('גיא חזן', 'סיסמה-לשחקן', 'player', '00000000-0000-0000-0000-000000000000');
-- =============================================================
