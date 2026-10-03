import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { errorMessage } from "@/lib/ifa/plan";
import { runIfaSync } from "@/lib/ifa/sync";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 90;

const NO_STORE = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

async function currentUser() {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user) return json({ error: "לא מחובר" }, 401);
  try {
    const fresh = request.nextUrl.searchParams.get("fresh") === "1";
    const result = await runIfaSync({ force: fresh });
    return json(result);
  } catch (e) {
    const msg = errorMessage(e);
    console.error("ifa sync GET", e);
    return json({ error: msg, standings: [], fixtures: [] }, 500);
  }
}

export async function POST() {
  const user = await currentUser();
  if (!user) return json({ error: "לא מחובר" }, 401);
  if (user.role !== "coach") {
    return json({ error: "רק מאמן יכול לרענן ידנית" }, 403);
  }
  try {
    const result = await runIfaSync({ force: true });
    return json(result);
  } catch (e) {
    const msg = errorMessage(e);
    console.error("ifa sync POST", e);
    return json({ error: msg, standings: [], fixtures: [] }, 500);
  }
}
