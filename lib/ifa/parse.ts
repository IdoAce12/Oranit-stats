import { IFA_OUR_ALIASES, IFA_TEAM_ID } from "./config";

export interface IfaFixture {
  date: string;
  opponent: string;
  home: boolean;
  venue: string;
  time: string | null;
  score: string | null;
  gameId: string | null;
}

export interface IfaStandingRow {
  place: number;
  team: string;
  teamId: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals: string;
  points: number;
  isUs: boolean;
}

function decode(raw: string): string {
  return raw
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function cell(block: string, label: string): string {
  const re = new RegExp(`<span class="sr-only">${label}</span>([^<]*)`, "i");
  return decode(re.exec(block)?.[1] ?? "");
}

function num(raw: string): number {
  const n = parseInt(raw.replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeTeamName(name: string): string {
  return decode(name)
    .replace(/[\"״"']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function isOurTeam(name: string): boolean {
  const n = normalizeTeamName(name);
  return IFA_OUR_ALIASES.some((alias) => n === normalizeTeamName(alias) || n.includes("הפועל אורנית"));
}

export function parseIfaDate(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const d = m[1].padStart(2, "0");
  const mo = m[2].padStart(2, "0");
  let y = m[3];
  if (y.length === 2) y = `20${y}`;
  return `${y}-${mo}-${d}`;
}

export function parseIfaTime(raw: string): string | null {
  const t = raw.trim();
  if (!t || t === "00:00") return null;
  if (!/^\d{1,2}:\d{2}$/.test(t)) return null;
  return t.length === 4 ? `0${t}` : t;
}

export function splitFixture(matchLabel: string): { opponent: string; home: boolean } | null {
  const parts = matchLabel.split(/\s+-\s+/);
  if (parts.length < 2) return null;
  const homeName = parts[0];
  const awayName = parts.slice(1).join(" - ");
  if (isOurTeam(homeName)) return { opponent: awayName, home: true };
  if (isOurTeam(awayName)) return { opponent: homeName, home: false };
  return { opponent: isOurTeam(homeName) ? awayName : homeName, home: isOurTeam(homeName) };
}

export function ifaMatchKey(date: string, opponent: string): string {
  return `${date}|${normalizeTeamName(opponent)}`;
}

export function parseIfaGames(html: string): IfaFixture[] {
  const start = html.indexOf("רשימת המשחקים");
  const chunk = start >= 0 ? html.slice(start) : html;
  const rows = [...chunk.matchAll(/<a class="table_row link_url"[^>]*href="([^"]*game_id=(-?\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)];
  const out: IfaFixture[] = [];
  for (const row of rows) {
    const block = row[3] ?? "";
    const date = parseIfaDate(cell(block, "תאריך"));
    const matchLabel = cell(block, "משחק");
    if (!date || !matchLabel) continue;
    const split = splitFixture(matchLabel);
    if (!split) continue;
    const gameId = row[2] && row[2] !== "-1" ? row[2] : null;
    const score = cell(block, "תוצאה");
    out.push({
      date,
      opponent: split.opponent,
      home: split.home,
      venue: cell(block, "אצטדיון"),
      time: parseIfaTime(cell(block, "שעה")),
      score: score || null,
      gameId,
    });
  }
  return out;
}

export function parseIfaStandings(html: string): IfaStandingRow[] {
  const marker = html.indexOf('sr-only">מקום</span>');
  const chunk = marker >= 0 ? html.slice(Math.max(0, marker - 200)) : html;
  const rows = [...chunk.matchAll(/<a class="table_row link_url[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)];
  const out: IfaStandingRow[] = [];
  for (const row of rows) {
    const href = row[1] ?? "";
    const block = row[2] ?? "";
    const place = num(cell(block, "מקום"));
    const team = cell(block, "קבוצה");
    if (!place || !team) continue;
    if (!cell(block, "נק'")) continue;
    const teamId = /team_id=(\d+)/.exec(href)?.[1] ?? null;
    out.push({
      place,
      team,
      teamId,
      played: num(cell(block, "מש'")),
      won: num(cell(block, "נצ'")),
      drawn: num(cell(block, "תיקו")),
      lost: num(cell(block, "הפ'")),
      goals: cell(block, "שע'"),
      points: num(cell(block, "נק'")),
      isUs: teamId === IFA_TEAM_ID || isOurTeam(team),
    });
  }
  return out.sort((a, b) => a.place - b.place);
}

export function namesMatch(a: string, b: string): boolean {
  const na = normalizeTeamName(a);
  const nb = normalizeTeamName(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}
