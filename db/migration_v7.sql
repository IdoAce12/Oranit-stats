-- =============================================================
-- מיגרציה v7 — סוג משחק (ליגה / גביע / אימון) לסיווג וסינון בטבלאות
-- הרץ ב-Supabase SQL Editor
-- =============================================================

alter table public.matches
  add column if not exists match_type text not null default 'league';

alter table public.matches
  drop constraint if exists matches_match_type_check;

alter table public.matches
  add constraint matches_match_type_check
  check (match_type in ('league', 'cup', 'friendly'));
