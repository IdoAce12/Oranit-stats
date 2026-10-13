-- =============================================================
-- מיגרציה v13 — שוערים, מערך שמור, ותיקון משחק טייבה
-- הרץ ב-Supabase SQL Editor
-- =============================================================

-- פעולות שוער בלייב
alter table public.events drop constraint if exists events_action_type_check;

alter table public.events
  add constraint events_action_type_check
  check (action_type in (
    'key_pass','tackle','ball_loss','shot','goal','assist',
    'corner_for','corner_against',
    'aerial_won','aerial_lost','ground_won','ground_lost',
    'gk_save','gk_accurate_pass','gk_aerial','gk_exit'
  ));

-- מערך שנבחר בהקמה נשמר למשחק החי
alter table public.matches add column if not exists formation_id text;

-- אינדקסים לטעינה מהירה של לוח / טבלה
create index if not exists matches_status_date_idx on public.matches(status, match_date desc);
create index if not exists events_match_action_idx on public.events(match_id, action_type);

-- תיקון באג שעון במשחק מול טייבה: הסיום לא עצר את השעון (~6666 דק׳)
update public.matches
set final_minute = 90,
    final_half = 2
where status = 'finished'
  and (
    opponent ilike '%טייבה%'
    or opponent ilike '%tayibe%'
    or opponent ilike '%taibe%'
  )
  and coalesce(final_minute, 0) > 120;

update public.events e
set match_minute = least(e.match_minute, 90)
from public.matches m
where e.match_id = m.id
  and (
    m.opponent ilike '%טייבה%'
    or m.opponent ilike '%tayibe%'
    or m.opponent ilike '%taibe%'
  )
  and e.match_minute > 90;

update public.substitutions s
set match_minute = least(s.match_minute, 90)
from public.matches m
where s.match_id = m.id
  and (
    m.opponent ilike '%טייבה%'
    or m.opponent ilike '%tayibe%'
    or m.opponent ilike '%taibe%'
  )
  and s.match_minute > 90;
