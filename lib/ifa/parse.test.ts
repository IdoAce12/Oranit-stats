import { describe, expect, it } from "vitest";
import {
  ifaMatchKey,
  isOurTeam,
  matchIfaKey,
  namesMatch,
  parseIfaDate,
  parseIfaGames,
  parseIfaStandings,
  parseIfaTime,
  splitFixture,
} from "./parse";

const GAMES_HTML = `
<section class="table_data_zone games_table container">
  <h2>רשימת המשחקים</h2>
  <a class="table_row link_url" href="/leagues/games/game/?game_id=1138365">
    <div><span class="sr-only">תאריך</span>19/09/2026</div>
    <div><span class="sr-only">משחק</span>בני טירה - הפועל אורנית ע. עידו אגוזי</div>
    <div><span class="sr-only">אצטדיון</span>טירה</div>
    <div><span class="sr-only">שעה</span>21:00</div>
    <div><span class="sr-only">תוצאה</span>1-2</div>
  </a>
  <a class="table_row link_url" href="/leagues/games/game/?game_id=-1">
    <div><span class="sr-only">תאריך</span>28/09/2026</div>
    <div><span class="sr-only">משחק</span>מכבי השרון נתניה ויקטור עטיה - הפועל אורנית ע. עידו אגוזי</div>
    <div><span class="sr-only">אצטדיון</span>נתניה שפירא</div>
    <div><span class="sr-only">שעה</span>20:30</div>
    <div><span class="sr-only">תוצאה</span></div>
  </a>
  <a class="table_row link_url" href="/leagues/games/game/?game_id=-1">
    <div><span class="sr-only">תאריך</span>01/10/2026</div>
    <div><span class="sr-only">משחק</span>הפועל אורנית ע. עידו אגוזי - בית&quot;ר טוברוק</div>
    <div><span class="sr-only">אצטדיון</span></div>
    <div><span class="sr-only">שעה</span>00:00</div>
    <div><span class="sr-only">תוצאה</span></div>
  </a>
</section>
`;

const TABLE_HTML = `
<a class="table_row link_url green-row" href="/team-details/?team_id=7307">
  <div class="table_col place"><span class="sr-only">מקום</span>1</div>
  <div class="table_col"><span class="sr-only">קבוצה</span>בני טירה</div>
  <div><span class="sr-only">מש'</span>1</div>
  <div><span class="sr-only">נצ'</span>1</div>
  <div><span class="sr-only">תיקו</span>0</div>
  <div><span class="sr-only">הפ'</span>0</div>
  <div><span class="sr-only">שע'</span>1-2</div>
  <div><span class="sr-only">נק'</span>3</div>
</a>
<a class="table_row link_url" href="/team-details/?team_id=2735">
  <div class="table_col place"><span class="sr-only">מקום</span>8</div>
  <div class="table_col"><span class="sr-only">קבוצה</span>הפועל אורנית ע. עידו אגוזי</div>
  <div><span class="sr-only">מש'</span>1</div>
  <div><span class="sr-only">נצ'</span>0</div>
  <div><span class="sr-only">תיקו</span>0</div>
  <div><span class="sr-only">הפ'</span>1</div>
  <div><span class="sr-only">שע'</span>2-1</div>
  <div><span class="sr-only">נק'</span>0</div>
</a>
`;

describe("parseIfaDate / time", () => {
  it("ממיר תאריך ושעה", () => {
    expect(parseIfaDate("28/09/2026")).toBe("2026-09-28");
    expect(parseIfaTime("20:30")).toBe("20:30");
    expect(parseIfaTime("00:00")).toBeNull();
  });
});

describe("splitFixture", () => {
  it("מזהה בית וחוץ", () => {
    expect(splitFixture("בני טירה - הפועל אורנית ע. עידו אגוזי")).toEqual({
      opponent: "בני טירה",
      home: false,
    });
    expect(splitFixture('הפועל אורנית ע. עידו אגוזי - בית"ר טוברוק')).toEqual({
      opponent: 'בית"ר טוברוק',
      home: true,
    });
  });
});

describe("parseIfaGames", () => {
  it("שולף משחקים מתוכננים ומשחקים ששוחקו", () => {
    const games = parseIfaGames(GAMES_HTML);
    expect(games).toHaveLength(3);
    expect(games[0].score).toBe("1-2");
    expect(games[0].opponent).toBe("בני טירה");
    expect(games[1].time).toBe("20:30");
    expect(games[1].score).toBeNull();
    expect(games[2].home).toBe(true);
    expect(games[2].time).toBeNull();
    expect(games[2].opponent).toContain("טוברוק");
  });
});

describe("parseIfaStandings", () => {
  it("שולף טבלה ומסמן את אורנית", () => {
    const rows = parseIfaStandings(TABLE_HTML);
    expect(rows).toHaveLength(2);
    expect(rows[0].place).toBe(1);
    expect(rows[0].points).toBe(3);
    expect(rows[1].isUs).toBe(true);
    expect(rows[1].place).toBe(8);
  });
});

describe("namesMatch", () => {
  it("מתעלם מגרשיים", () => {
    expect(namesMatch("בית״ר טוברוק", 'בית"ר טוברוק')).toBe(true);
    expect(isOurTeam("הפועל אורנית ע. עידו אגוזי")).toBe(true);
    expect(ifaMatchKey("2026-09-28", "בני טירה")).toBe("2026-09-28|בני טירה");
    expect(matchIfaKey({ match_date: "2026-09-28", opponent: "בני טירה" })).toBe(
      "2026-09-28|בני טירה"
    );
  });
});

