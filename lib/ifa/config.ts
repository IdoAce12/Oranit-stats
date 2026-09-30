export const IFA_TEAM_ID = "2735";
export const IFA_SEASON_ID = "28";
export const IFA_GAMES_URL = `https://www.football.org.il/team-details/team-games/?team_id=${IFA_TEAM_ID}&season_id=${IFA_SEASON_ID}`;
export const IFA_TEAM_URL = `https://www.football.org.il/team-details/?team_id=${IFA_TEAM_ID}&season_id=${IFA_SEASON_ID}`;
export const IFA_OUR_NAME = "הפועל אורנית";
/** אחרי עשר דקות מושכים שוב מההתאחדות. שש שעות השאירו את הטלפון עם טבלה ושעה ישנים. */
export const IFA_STALE_MS = 10 * 60 * 1000;
export const IFA_FETCH_TIMEOUT_MS = process.env.VERCEL === "1" ? 8_000 : 15_000;

export const IFA_FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
  Referer: IFA_TEAM_URL,
};

export const IFA_OUR_ALIASES = [
  "הפועל אורנית ע. עידו אגוזי",
  "הפועל אורנית עירוני עידו אגוזי",
  "הפועל אורנית עידו אגוזי",
  "הפועל אורנית",
];
