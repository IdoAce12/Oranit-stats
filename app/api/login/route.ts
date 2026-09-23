import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabase } from "@/lib/supabaseClient";
import { SESSION_COOKIE, SESSION_DAYS, signSession } from "@/lib/session";
import type { AppSession, UserRole } from "@/lib/types";

export async function POST(request: Request) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase לא מחובר" }, { status: 500 });
  }

  let body: { username?: string; password?: string };
  try {
    body = (await request.json()) as { username?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }

  const username = body.username?.trim() ?? "";
  const password = body.password ?? "";
  if (!username || !password) {
    return NextResponse.json({ error: "חסרים שם או סיסמה" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("verify_login", {
    p_username: username,
    p_password: password,
  });

  if (error) {
    const msg = error.message ?? "";
    if (/verify_login|schema cache|does not exist/i.test(msg)) {
      return NextResponse.json(
        { error: "חסרה טבלת משתמשים — הרץ את db/migration_v9.sql ואז db/migration_v10.sql ב-Supabase" },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "שגיאה בהתחברות" }, { status: 500 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id || (row.role !== "coach" && row.role !== "player")) {
    return NextResponse.json({ error: "שם או סיסמה שגויים" }, { status: 401 });
  }

  const user: AppSession = {
    id: row.id,
    username: row.username,
    role: row.role as UserRole,
    squadPlayerId: row.squad_player_id ?? null,
  };

  const store = await cookies();
  store.set(SESSION_COOKIE, signSession(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });

  return NextResponse.json({ user });
}
