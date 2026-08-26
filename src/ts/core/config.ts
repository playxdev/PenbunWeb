/**
 * config.ts — where the front end finds PenbunAPI.
 *
 * The base URL is resolved at runtime, never baked in at build time, so the
 * same `public/` artifact can be uploaded to Pages, opened from a preview
 * URL, or served by `tools/serve.mjs` without a rebuild.
 *
 * Resolution order — first hit wins:
 *
 *   1. localStorage["penbun.apiBase"]         per-browser override (QA)
 *   2. <meta name="penbun-api-base" content>  per-deployment override
 *   3. API_TARGET                             + /api/v2
 *
 * API_TARGET is the one line to edit, and "auto" is the answer almost
 * every day: a page served from localhost gets the local API, anything
 * else gets the deployed one. That is not a convenience, it is the guard
 * rail — under "prod" a page opened on localhost reads and writes the
 * production database, so saving a record while developing is a real
 * production write.
 *
 * Set it to "prod" or "dev" deliberately and briefly: "prod" to reproduce
 * something against real data, "dev" to point a deployed preview at an API
 * on your machine. For one tab rather than the whole build, prefer the
 * console override at the bottom of this file, which leaves no edit to
 * forget to revert.
 *
 * The front end is on Cloudflare Pages and the API is on DigitalOcean, so
 * they are different origins; whatever PROD_ORIGIN points at must list the
 * Pages domain in the API's CORS_ORIGINS or every request fails preflight.
 *
 * The prefix is `/api/v2` because that is what `main.go` actually mounts
 * (`app.Group("/api/v2", …)`). PenbunAPI's README calls it v4; the router is
 * the contract, the README is not.
 */

const OVERRIDE_KEY = "penbun.apiBase";
const API_PREFIX = "/api/v2";
const DEV_ORIGIN = "http://localhost:8089";
const PROD_ORIGIN = "https://starfish-app-zrucf.ondigitalocean.app";

/**
 * "auto" = localhost ยิง DEV_ORIGIN ที่เหลือยิง PROD_ORIGIN  ← ค่าปกติ
 * "prod" = ทุกที่ยิง PROD_ORIGIN (localhost ก็เขียน production ด้วย)
 * "dev"  = ทุกที่ยิง DEV_ORIGIN
 */
const API_TARGET: "auto" | "prod" | "dev" = "auto";

function isLocalHost(): boolean {
  const h = location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
}

function targetOrigin(): string {
  if (API_TARGET === "prod") return PROD_ORIGIN;
  if (API_TARGET === "dev") return DEV_ORIGIN;
  return isLocalHost() ? DEV_ORIGIN : PROD_ORIGIN;
}

function trimSlash(u: string): string {
  return u.replace(/\/+$/, "");
}

function fromStorage(): string | null {
  try {
    const v = localStorage.getItem(OVERRIDE_KEY);
    return v && v.trim() ? trimSlash(v.trim()) : null;
  } catch {
    return null;
  }
}

function fromMeta(): string | null {
  const el = document.querySelector<HTMLMetaElement>('meta[name="penbun-api-base"]');
  const v = el?.content?.trim();
  return v ? trimSlash(v) : null;
}

/** Absolute base URL, with no trailing slash. */
export function apiBase(): string {
  return fromStorage() ?? fromMeta() ?? targetOrigin() + API_PREFIX;
}

/**
 * The API's origin without the version prefix.
 *
 * `/healthz`, `/readyz` and `/version` are registered on the app root in
 * `main.go`, not inside `app.Group("/api/v2", …)`, and they answer plain JSON
 * rather than the envelope every other route uses. They are operational
 * endpoints, so this is derived from whatever `apiBase()` resolved to —
 * including a console override — rather than resolved a second time.
 */
export function apiRoot(): string {
  return apiBase().replace(/\/api\/v\d+$/, "");
}

/** Point this browser at another API. Pass null to go back to the default. */
export function setApiBase(url: string | null): void {
  try {
    if (url === null) localStorage.removeItem(OVERRIDE_KEY);
    else localStorage.setItem(OVERRIDE_KEY, trimSlash(url.trim()));
  } catch {
    /* private mode — the default stays in effect */
  }
}

/**
 * Reach the two functions above from the browser console.
 *
 * Without this the override is only callable from module code, which makes
 * the QA path — point this tab at the other API and reload — impossible to
 * use for anyone who is not editing source. Reads as:
 *
 *   penbun.apiBase()                              what am I talking to?
 *   penbun.setApiBase("http://localhost:8089/api/v2")
 *   penbun.setApiBase(null)                       back to the default
 */
declare global {
  interface Window {
    penbun?: { apiBase: typeof apiBase; setApiBase: typeof setApiBase };
  }
}

if (typeof window !== "undefined") window.penbun = { apiBase, setApiBase };
