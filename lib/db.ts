import { getSupabase } from "./supabaseClient";
import { Match, MatchEvent, Player, SquadPlayer } from "./types";

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "Supabase לא מוגדר. הגדר NEXT_PUBLIC_SUPABASE_URL ו-NEXT_PUBLIC_SUPABASE_ANON_KEY בקובץ .env.local"
    );
    this.name = "SupabaseNotConfiguredError";
  }
}

function requireClient() {
  const client = getSupabase();
  if (!client) throw new SupabaseNotConfiguredError();
  return client;
}

// ---------------- סגל קבוע ----------------

export async function listSquad(): Promise<SquadPlayer[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("squad_players")
    .select("*")
    .order("shirt_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SquadPlayer[];
}

export async function addSquadPlayer(input: {
  shirt_number: number;
  name: string;
  position?: string | null;
}): Promise<SquadPlayer> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("squad_players")
    .insert({
      shirt_number: input.shirt_number,
      name: input.name,
      position: input.position ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as SquadPlayer;
}

export async function updateSquadPlayer(
  id: string,
  patch: Partial<Pick<SquadPlayer, "shirt_number" | "name" | "position" | "active">>
): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from("squad_players").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteSquadPlayer(id: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from("squad_players").delete().eq("id", id);
  if (error) throw error;
}

// ---------------- משחקים ----------------

export async function listMatches(): Promise<Match[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .order("match_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Match[];
}

export async function getMatch(id: string): Promise<Match | null> {
  const supabase = requireClient();
  const { data, error } = await supabase.from("matches").select("*").eq("id", id).single();
  if (error) return null;
  return data as Match;
}

export async function createMatch(input: {
  opponent: string;
  match_date: string;
  our_team_name: string;
}): Promise<Match> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("matches")
    .insert({
      opponent: input.opponent,
      match_date: input.match_date,
      our_team_name: input.our_team_name,
      status: "live",
    })
    .select()
    .single();
  if (error) throw error;
  return data as Match;
}

export async function finishMatch(id: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase
    .from("matches")
    .update({ status: "finished", ended_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function reopenMatch(id: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase
    .from("matches")
    .update({ status: "live", ended_at: null })
    .eq("id", id);
  if (error) throw error;
}

export async function updateMatchNotes(id: string, notes: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from("matches").update({ notes }).eq("id", id);
  if (error) throw error;
}

// ---------------- שחקנים במשחק ----------------

export async function getPlayers(matchId: string): Promise<Player[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("match_id", matchId)
    .order("shirt_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Player[];
}

export async function addPlayers(
  matchId: string,
  players: {
    squad_player_id?: string | null;
    shirt_number: number;
    name: string;
    position?: string | null;
    is_starter?: boolean;
  }[]
): Promise<Player[]> {
  const supabase = requireClient();
  const rows = players.map((p) => ({
    match_id: matchId,
    squad_player_id: p.squad_player_id ?? null,
    shirt_number: p.shirt_number,
    name: p.name,
    position: p.position ?? null,
    is_starter: p.is_starter ?? true,
  }));
  const { data, error } = await supabase.from("players").insert(rows).select();
  if (error) throw error;
  return (data ?? []) as Player[];
}

export async function updatePlayerStarter(id: string, is_starter: boolean): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from("players").update({ is_starter }).eq("id", id);
  if (error) throw error;
}

// ---------------- אירועים ----------------

export async function getEvents(matchId: string): Promise<MatchEvent[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MatchEvent[];
}

// ---------------- נתונים עונתיים (כל המשחקים) ----------------

export async function getAllPlayers(): Promise<Player[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("players")
    .select("id,match_id,squad_player_id,shirt_number,name,position")
    .limit(5000);
  if (error) throw error;
  return (data ?? []) as Player[];
}

export async function getAllEvents(): Promise<MatchEvent[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("events")
    .select("id,match_id,player_id,action_type,zone,shot_location,half,match_minute,created_at")
    .limit(10000);
  if (error) throw error;
  return (data ?? []) as MatchEvent[];
}

/** טעינה מרוכזת לטבלה עונתית — עמודות מינימליות בלבד */
export async function loadSeasonBundle(): Promise<{
  events: MatchEvent[];
  players: Player[];
  squad: SquadPlayer[];
  matches: Match[];
  matchesCount: number;
}> {
  const supabase = requireClient();
  const [evRes, plRes, sqRes, mRes] = await Promise.all([
    supabase
      .from("events")
      .select("id,match_id,player_id,action_type,zone,shot_location,half,match_minute,created_at")
      .limit(10000),
    supabase
      .from("players")
      .select("id,match_id,squad_player_id,shirt_number,name,position,is_starter")
      .limit(5000),
    supabase
      .from("squad_players")
      .select("id,shirt_number,name,position,active,created_at")
      .order("shirt_number", { ascending: true }),
    supabase
      .from("matches")
      .select("id,opponent,match_date,our_team_name,status,ended_at,created_at,notes")
      .order("match_date", { ascending: false })
      .limit(2000),
  ]);
  if (evRes.error) throw new Error(evRes.error.message);
  if (plRes.error) throw new Error(plRes.error.message);
  if (sqRes.error) throw new Error(sqRes.error.message);
  if (mRes.error) throw new Error(mRes.error.message);
  const matches = (mRes.data ?? []) as Match[];
  return {
    events: (evRes.data ?? []) as MatchEvent[],
    players: (plRes.data ?? []) as Player[],
    squad: (sqRes.data ?? []) as SquadPlayer[],
    matches,
    matchesCount: matches.length,
  };
}
