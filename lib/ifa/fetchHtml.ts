import { spawn } from "node:child_process";
import { IFA_FETCH_HEADERS, IFA_FETCH_TIMEOUT_MS, IFA_ZENROWS_TIMEOUT_MS, zenrowsApiKey } from "./config";

export function isBlockedIfaPage(html: string, status = 200): boolean {
  if (status === 403 || status === 503) return true;
  return html.includes("Attention Required") && /cloudflare/i.test(html);
}

export function looksLikeIfaHtml(html: string): boolean {
  if (!html || html.length < 800) return false;
  if (html.includes("Attention Required") && /cloudflare/i.test(html)) return false;
  return (
    html.includes("רשימת המשחקים") ||
    html.includes("מקום") ||
    html.includes("הפועל אורנית")
  );
}

function curlBin(): string {
  return process.platform === "win32" ? "curl.exe" : "curl";
}

function fetchIfaHtmlViaCurl(url: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      "-sL",
      "--max-time",
      String(Math.max(1, Math.ceil(timeoutMs / 1000))),
      "-A",
      IFA_FETCH_HEADERS["User-Agent"],
      "-H",
      `Accept: ${IFA_FETCH_HEADERS.Accept}`,
      "-H",
      `Accept-Language: ${IFA_FETCH_HEADERS["Accept-Language"]}`,
      "-H",
      `Referer: ${IFA_FETCH_HEADERS.Referer}`,
      url,
    ];
    const child = spawn(curlBin(), args, { windowsHide: true });
    const chunks: Buffer[] = [];
    let err = "";
    child.stdout.on("data", (d: Buffer) => chunks.push(d));
    child.stderr.on("data", (d: Buffer) => {
      err += d.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const html = Buffer.concat(chunks).toString("utf8");
      if (isBlockedIfaPage(html, code === 0 ? 200 : 403) || !looksLikeIfaHtml(html)) {
        reject(new Error(err.trim() || "ההתאחדות חסמה את הבקשה"));
        return;
      }
      resolve(html);
    });
  });
}

async function fetchWithTimeout(url: string, headers: Record<string, string>, timeoutMs: number): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      redirect: "follow",
      headers,
    });
    const html = await res.text();
    if (res.ok && looksLikeIfaHtml(html) && !isBlockedIfaPage(html, res.status)) return html;
  } catch {
    /* try the next fetch path */
  } finally {
    clearTimeout(timer);
  }
  return null;
}

async function fetchIfaHtmlViaProxies(url: string, timeoutMs: number): Promise<string> {
  const proxied = [
    {
      href: `https://r.jina.ai/${url}`,
      headers: { ...IFA_FETCH_HEADERS, "X-Return-Format": "html", "X-Timeout": "15" },
    },
    {
      href: `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      headers: IFA_FETCH_HEADERS,
    },
  ];
  for (const proxy of proxied) {
    const html = await fetchWithTimeout(proxy.href, proxy.headers, timeoutMs);
    if (html) return html;
  }
  throw new Error("ההתאחדות חסמה את הבקשה");
}

async function fetchIfaHtmlViaZenRows(url: string, timeoutMs: number): Promise<string | null> {
  const key = zenrowsApiKey();
  if (!key) return null;
  const href = new URL("https://api.zenrows.com/v1/");
  href.searchParams.set("apikey", key);
  href.searchParams.set("url", url);
  href.searchParams.set("js_render", "true");
  href.searchParams.set("premium_proxy", "true");
  href.searchParams.set("proxy_country", "il");
  href.searchParams.set("wait", "5000");
  return fetchWithTimeout(href.toString(), {}, timeoutMs);
}

export async function fetchIfaHtml(url: string): Promise<string> {
  if (typeof window === "undefined" && process.env.VERCEL !== "1") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED ??= "0";
  }
  const fromZen = await fetchIfaHtmlViaZenRows(url, IFA_ZENROWS_TIMEOUT_MS);
  if (fromZen) return fromZen;
  if (process.env.VERCEL === "1") {
    throw new Error("ההתאחדות חסמה את הבקשה");
  }
  const fromFetch = await fetchWithTimeout(url, IFA_FETCH_HEADERS, IFA_FETCH_TIMEOUT_MS);
  if (fromFetch) return fromFetch;
  try {
    return await fetchIfaHtmlViaCurl(url, IFA_FETCH_TIMEOUT_MS);
  } catch {
    /* Node/undici לעתים נחסם ב-Cloudflare; curl במחשב המקומי עובר */
  }
  return fetchIfaHtmlViaProxies(url, IFA_FETCH_TIMEOUT_MS);
}
