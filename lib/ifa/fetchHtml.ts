import { spawn } from "node:child_process";
import { IFA_FETCH_HEADERS, IFA_FETCH_TIMEOUT_MS } from "./config";

export function isBlockedIfaPage(html: string, status = 200): boolean {
  if (status === 403 || status === 503) return true;
  return html.includes("Attention Required") && /cloudflare/i.test(html);
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
      if (isBlockedIfaPage(html, code === 0 ? 200 : 403) || html.length < 800) {
        reject(new Error(err.trim() || "ההתאחדות חסמה את הבקשה"));
        return;
      }
      resolve(html);
    });
  });
}

export async function fetchIfaHtml(url: string): Promise<string> {
  if (typeof window === "undefined" && process.env.VERCEL !== "1") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED ??= "0";
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), IFA_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      redirect: "follow",
      headers: IFA_FETCH_HEADERS,
    });
    const html = await res.text();
    if (res.ok && !isBlockedIfaPage(html, res.status)) return html;
  } catch {
    /* Node/undici לעתים נחסם ב-Cloudflare; curl במחשב המקומי עובר */
  } finally {
    clearTimeout(timer);
  }
  return fetchIfaHtmlViaCurl(url, IFA_FETCH_TIMEOUT_MS);
}
