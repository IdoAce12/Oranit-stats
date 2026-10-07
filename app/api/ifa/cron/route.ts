import { NextRequest, NextResponse } from "next/server";
import { getIfaCache } from "@/lib/db";
import { cronAuthorized, cronSecret } from "@/lib/ifa/cronAuth";
import { errorMessage, ifaAlreadySyncedToday } from "@/lib/ifa/plan";
import { runIfaSync } from "@/lib/ifa/sync";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

const NO_STORE = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

function unauthorized() {
  if (!cronSecret()) return json({ error: "חסר IFA_CRON_SECRET" }, 503);
  return json({ error: "לא מורשה" }, 401);
}

export async function GET(request: NextRequest) {
  if (!cronAuthorized(request.headers.get("authorization"))) return unauthorized();
  try {
    if (request.nextUrl.searchParams.get("peek") === "1") {
      const cache = await getIfaCache();
      const fetchedAt = cache?.fetched_at ?? null;
      return json({ fetchedAt, alreadySyncedToday: ifaAlreadySyncedToday(fetchedAt) });
    }
    const result = await runIfaSync({ force: true });
    return json(result);
  } catch (e) {
    const msg = errorMessage(e);
    console.error("ifa cron GET", e);
    return json({ error: msg, standings: [], fixtures: [] }, 500);
  }
}

export async function POST(request: NextRequest) {
  if (!cronAuthorized(request.headers.get("authorization"))) return unauthorized();
  try {
    let gamesHtml: string | undefined;
    let teamHtml: string | undefined;
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { gamesHtml?: unknown; teamHtml?: unknown };
      if (typeof body.gamesHtml === "string" && body.gamesHtml.trim()) gamesHtml = body.gamesHtml;
      if (typeof body.teamHtml === "string" && body.teamHtml.trim()) teamHtml = body.teamHtml;
    }
    const result = await runIfaSync({ force: true, gamesHtml, teamHtml });
    const ok = result.refreshed && !result.error;
    return json(result, ok ? 200 : 502);
  } catch (e) {
    const msg = errorMessage(e);
    console.error("ifa cron POST", e);
    return json({ error: msg, standings: [], fixtures: [] }, 500);
  }
}
