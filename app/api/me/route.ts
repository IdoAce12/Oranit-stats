import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { squadPlayerName } from "@/lib/playerName";

export async function GET() {
  const store = await cookies();
  const user = verifySession(store.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  const playerName = (await squadPlayerName(user.squadPlayerId)) ?? user.playerName;
  return NextResponse.json({ user: { ...user, playerName } });
}
