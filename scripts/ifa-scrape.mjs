import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const UA =
  process.env.UA ||
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const GAMES_URL = process.env.GAMES_URL;
const TEAM_URL = process.env.TEAM_URL;

if (!GAMES_URL || !TEAM_URL) {
  console.error("Missing GAMES_URL or TEAM_URL");
  process.exit(1);
}

function ok(html, marker) {
  return html.includes(marker) && !html.includes("Attention Required");
}

async function grab(browser, url) {
  const context = await browser.newContext({
    userAgent: UA,
    locale: "he-IL",
    extraHTTPHeaders: {
      "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  try {
    await page.waitForFunction(
      () => {
        const text = document.body?.innerText ?? "";
        return text.includes("רשימת המשחקים") || text.includes("מקום");
      },
      { timeout: 25_000 }
    );
  } catch {
    /* save whatever Cloudflare left on the page */
  }
  const html = await page.content();
  await context.close();
  return html;
}

const browser = await chromium.launch({
  headless: true,
  args: ["--disable-blink-features=AutomationControlled"],
});

try {
  const gamesHtml = await grab(browser, GAMES_URL);
  const teamHtml = await grab(browser, TEAM_URL);
  const outDir = process.env.GITHUB_WORKSPACE || process.cwd();
  writeFileSync(join(outDir, "games.html"), gamesHtml, "utf8");
  writeFileSync(join(outDir, "team.html"), teamHtml, "utf8");
  if (!ok(gamesHtml, "רשימת המשחקים") || !ok(teamHtml, "מקום")) {
    console.error("Playwright got a blocked or empty IFA page");
    process.exit(1);
  }
} finally {
  await browser.close();
}
