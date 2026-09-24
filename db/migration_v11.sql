-- =============================================================
-- מיגרציה v11 — תיקון התחברות
-- ב-Supabase, crypt יושב ב-extensions. verify_login הוגדר עם
-- search_path = public בלבד, לכן ההתחברות נכשלה גם כשהסיסמה נכונה.
-- הרץ ב-SQL Editor ואז נסה שוב להתחבר.
-- =============================================================

create extension if not exists pgcrypto with schema extensions;

create or replace function public.app_users_hash_password()
returns trigger
language plpgsql
set search_path = public, extensions
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
    new.password_hash := extensions.crypt(raw, extensions.gen_salt('bf'));
    new.password := raw;
  end if;
  return new;
end;
$$;

create or replace function public.verify_login(p_username text, p_password text)
returns table (
  id uuid,
  username text,
  role text,
  squad_player_id uuid
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  select u.id, u.username, u.role, u.squad_player_id
  from public.app_users u
  where lower(u.username) = lower(trim(p_username))
    and case
      when nullif(trim(coalesce(u.password, '')), '') is not null
        and u.password = p_password then true
      when u.password_hash is not null
        then u.password_hash = extensions.crypt(p_password, u.password_hash)
      else false
    end
  limit 1;
end;
$$;

grant execute on function public.verify_login(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
