import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { errorMessage } from "@/lib/ifa/plan";
import { runIfaSync } from "@/lib/ifa/sync";

export const dynamic = "force-dynamic";

async function currentUser() {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  try {
    const fresh = request.nextUrl.searchParams.get("fresh") === "1";
    const result = await runIfaSync({ force: fresh });
    return NextResponse.json(result);
  } catch (e) {
    const msg = errorMessage(e);
    console.error("ifa sync GET", e);
    return NextResponse.json({ error: msg, standings: [], fixtures: [] }, { status: 500 });
  }
}

export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (user.role !== "coach") {
    return NextResponse.json({ error: "רק מאמן יכול לרענן ידנית" }, { status: 403 });
  }
  try {
    const result = await runIfaSync({ force: true });
    return NextResponse.json(result);
  } catch (e) {
    const msg = errorMessage(e);
    console.error("ifa sync POST", e);
    return NextResponse.json({ error: msg, standings: [], fixtures: [] }, { status: 500 });
  }
}
