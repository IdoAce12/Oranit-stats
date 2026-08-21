-- =============================================================
-- מיגרציה v8 — מאבקי אוויר / קרקע (זכה / הפסיד)
-- הרץ ב-Supabase SQL Editor
-- =============================================================

alter table public.events drop constraint if exists events_action_type_check;

alter table public.events
  add constraint events_action_type_check
  check (action_type in (
    'key_pass','tackle','ball_loss','shot','goal','assist',
    'corner_for','corner_against',
    'aerial_won','aerial_lost','ground_won','ground_lost'
  ));
