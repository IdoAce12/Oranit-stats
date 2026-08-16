-- =============================================================
-- מיגרציה v4 — הערות משחק + הרכב פותח/ספסל
-- הרץ ב-Supabase SQL Editor
-- =============================================================

alter table public.matches add column if not exists notes text not null default '';

alter table public.players add column if not exists is_starter boolean not null default true;
