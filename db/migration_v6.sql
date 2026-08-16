-- =============================================================
-- מיגרציה v6 — עמדת הרכב על המגרש (פורמציה 4-3-3, 10 שחקני שדה)
-- הרץ ב-Supabase SQL Editor
-- =============================================================

alter table public.players
  add column if not exists lineup_slot int;

alter table public.players
  drop constraint if exists players_lineup_slot_range;

alter table public.players
  add constraint players_lineup_slot_range
  check (lineup_slot is null or (lineup_slot >= 0 and lineup_slot <= 9));
