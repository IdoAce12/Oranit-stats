import { getSupabase } from "./supabaseClient";
import { Match, MatchEvent, Player } from "./types";

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super("Supabase לא מוגדר. הגדר NEXT_PUBLIC_SUPABASE_URL ו-NEXT_PUBLIC_SUPABASE_ANON_KEY בקובץ .env.local");
    this.name = "SupabaseNotConfiguredError";
  }
}

function requireClient() {
  const client = getSupabase();
  if (!client) throw new SupabaseNotConfiguredError();
  return client;
}

export async function listMatches(): Promise<Match[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .order("match_date", { ascending: false });
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
    })
    .select()
    .single();
  if (error) throw error;
  return data as Match;
}

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
  players: { shirt_number: number; name: string; position?: string | null }[]
): Promise<Player[]> {
  const supabase = requireClient();
  const rows = players.map((p) => ({
    match_id: matchId,
    shirt_number: p.shirt_number,
    name: p.name,
    position: p.position ?? null,
  }));
  const { data, error } = await supabase.from("players").insert(rows).select();
  if (error) throw error;
  return (data ?? []) as Player[];
}

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
