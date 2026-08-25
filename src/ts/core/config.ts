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
 *   3. USE_PROD ? PROD_ORIGIN : DEV_ORIGIN    + /api/v2
 *
 * USE_PROD is the one line to flip when switching the whole front end
 * between the deployed API and a local one, and it applies everywhere —
 * the hostname is not consulted, so a page opened on localhost talks to
 * whichever API USE_PROD names.
 *
 * That cuts both ways: with USE_PROD on, developing against localhost
 * reads and writes the production database. Saving a record from a local
 * page is a real production write. Flip USE_PROD to false, or use the
 * per-browser override below, before touching anything that mutates.
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

/** true = ทุกที่ยิง PROD_ORIGIN · false = ทุกที่ยิง DEV_ORIGIN */
const USE_PROD = true;

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
  return fromStorage() ?? fromMeta() ?? (USE_PROD ? PROD_ORIGIN : DEV_ORIGIN) + API_PREFIX;
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
