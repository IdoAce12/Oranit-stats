-- =============================================================
-- מיגרציה v10 — שדה password ברור למילוי ידני בטבלת app_users
-- הרץ ב-Supabase SQL Editor (אחרי v9, או ביחד איתו)
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

alter table public.app_users add column if not exists password text;
alter table public.app_users alter column password_hash drop not null;

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
drop policy if exists "public all app_users" on public.app_users;

grant execute on function public.verify_login(text, text) to anon, authenticated;
