-- =============================================================
-- מיגרציה v3 — שערים ובישולים
-- הרץ ב-Supabase SQL Editor (New query -> הדבק -> Run)
-- =============================================================

alter table public.events drop constraint if exists events_action_type_check;
alter table public.events add constraint events_action_type_check
  check (action_type in (
    'key_pass','tackle','ball_loss','shot',
    'corner_for','corner_against','corner',
    'goal','assist'
  ));
