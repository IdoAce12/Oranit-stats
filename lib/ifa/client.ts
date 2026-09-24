import type { IfaSyncResult } from "./plan";

export async function requestIfaSync(force = false): Promise<IfaSyncResult | null> {
  try {
    const url = force ? "/api/ifa/sync?fresh=1" : "/api/ifa/sync";
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    const data = (await res.json()) as IfaSyncResult & { error?: string };
    if (!res.ok && !data) return null;
    return data;
  } catch {
    return null;
  }
}

export function formatIfaFetchedAt(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("he-IL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
