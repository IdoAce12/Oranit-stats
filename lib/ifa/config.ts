export const IFA_TEAM_ID = "2735";
export const IFA_SEASON_ID = "28";
export const IFA_GAMES_URL = `https://www.football.org.il/team-details/team-games/?team_id=${IFA_TEAM_ID}&season_id=${IFA_SEASON_ID}`;
export const IFA_TEAM_URL = `https://www.football.org.il/team-details/?team_id=${IFA_TEAM_ID}&season_id=${IFA_SEASON_ID}`;
export const IFA_OUR_NAME = "הפועל אורנית";
/** מטמון לטעינת מסכים. משיכה חיה רק ביומן GitHub ובכפתור רענון. */
export const IFA_STALE_MS = 24 * 60 * 60 * 1000;
export const IFA_FETCH_TIMEOUT_MS = process.env.VERCEL === "1" ? 8_000 : 15_000;
export const IFA_ZENROWS_TIMEOUT_MS = 45_000;

export function zenrowsApiKey(): string {
  return (process.env.ZENROWS_API_KEY ?? "").trim();
}

/** משיכה חיה: ZenRows בפרודקשן, או curl מקומי. לא רצים על כל כניסה לאפליקציה. */
export function ifaLiveScrapeEnabled(): boolean {
  if (zenrowsApiKey()) return true;
  return process.env.VERCEL !== "1";
}

export const IFA_FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
  Referer: IFA_TEAM_URL,
  "Upgrade-Insecure-Requests": "1",
  "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "sec-fetch-user": "?1",
};

export const IFA_OUR_ALIASES = [
  "הפועל אורנית ע. עידו אגוזי",
  "הפועל אורנית עירוני עידו אגוזי",
  "הפועל אורנית עידו אגוזי",
  "הפועל אורנית",
];
