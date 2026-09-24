import { getSupabase } from "./supabaseClient";
import type { AppSession } from "./types";

export function greetingName(user: Pick<AppSession, "username" | "playerName">): string {
  const name = user.playerName?.trim();
  return name || user.username;
}

export async function squadPlayerName(squadPlayerId: string | null): Promise<string | null> {
  if (!squadPlayerId) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase
    .from("squad_players")
    .select("name")
    .eq("id", squadPlayerId)
    .maybeSingle();
  const name = typeof data?.name === "string" ? data.name.trim() : "";
  return name || null;
}
