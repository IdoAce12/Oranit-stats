-- =============================================================
-- Views לסטטיסטיקה מחושבת בצד השרת (אופציונלי)
-- הרץ ב-Supabase אחרי שהסכמה העדכנית קיימת.
-- הפרונט עדיין מחשב xG/xA מאירועים — ה-views מוכנים כשהנפח יגדל.
-- =============================================================

create or replace view public.v_player_match_xg as
select
  e.match_id,
  e.player_id,
  count(*) filter (where e.action_type = 'shot') as shots,
  count(*) filter (where e.action_type = 'shot' and e.shot_location = 'in_box') as shots_in_box,
  count(*) filter (where e.action_type = 'shot' and e.shot_location = 'out_box') as shots_out_box,
  round(
    (
      count(*) filter (where e.action_type = 'shot' and e.shot_location = 'in_box') * 0.25
      + count(*) filter (where e.action_type = 'shot' and e.shot_location = 'out_box') * 0.07
    )::numeric,
    2
  ) as xg,
  round(
    (count(*) filter (where e.action_type = 'key_pass') * 0.12)::numeric,
    2
  ) as xa,
  count(*) filter (where e.action_type = 'goal') as goals,
  count(*) filter (where e.action_type = 'assist') as assists,
  count(*) filter (where e.action_type = 'tackle') as tackles,
  count(*) filter (where e.action_type = 'ball_loss') as losses,
  count(*) filter (where e.action_type = 'key_pass') as key_passes
from public.events e
where e.player_id is not null
group by e.match_id, e.player_id;

create or replace view public.v_season_player_stats as
select
  coalesce(p.squad_player_id::text, p.name) as player_key,
  max(p.name) as name,
  max(p.shirt_number) as shirt_number,
  count(distinct p.match_id) as matches_played,
  sum(x.goals) as goals,
  sum(x.assists) as assists,
  sum(x.key_passes) as key_passes,
  sum(x.tackles) as tackles,
  sum(x.losses) as losses,
  sum(x.xg) as xg,
  sum(x.xa) as xa
from public.players p
left join public.v_player_match_xg x on x.player_id = p.id
group by coalesce(p.squad_player_id::text, p.name);
