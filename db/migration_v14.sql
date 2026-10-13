-- =============================================================
-- מיגרציה v14 — פעולות שוער ביחיד + הגיע/לא הגיע
-- הרץ ב-Supabase SQL Editor אחרי migration_v13.sql
-- =============================================================

alter table public.events drop constraint if exists events_action_type_check;

alter table public.events
  add constraint events_action_type_check
  check (action_type in (
    'key_pass','tackle','ball_loss','shot','goal','assist',
    'corner_for','corner_against',
    'aerial_won','aerial_lost','ground_won','ground_lost',
    'gk_save',
    'gk_pass_ok','gk_pass_miss',
    'gk_exit_ok','gk_exit_bad',
    'gk_aerial_ok','gk_aerial_miss',
    'gk_accurate_pass','gk_aerial','gk_exit'
  ));

update public.events set action_type = 'gk_pass_ok' where action_type = 'gk_accurate_pass';
update public.events set action_type = 'gk_aerial_ok' where action_type = 'gk_aerial';
update public.events set action_type = 'gk_exit_ok' where action_type = 'gk_exit';
