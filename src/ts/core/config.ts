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
 *   3. localhost / 127.0.0.1                  http://localhost:8089/api/v2
 *   4. anything else                          same origin + /api/v2
 *
 * The prefix is `/api/v2` because that is what `main.go` actually mounts
 * (`app.Group("/api/v2", …)`). PenbunAPI's README calls it v4; the router is
 * the contract, the README is not.
 */

const OVERRIDE_KEY = "penbun.apiBase";
const API_PREFIX = "/api/v2";
const DEV_ORIGIN = "http://localhost:8089";

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

function isLocal(): boolean {
  const h = location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
}

/** Absolute or origin-relative base URL, with no trailing slash. */
export function apiBase(): string {
  return fromStorage() ?? fromMeta() ?? (isLocal() ? DEV_ORIGIN + API_PREFIX : API_PREFIX);
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
