/**
 * permissions.ts — what this user may write, according to the server.
 *
 * `GET /meta/permissions` answers a map keyed by resource name, derived from
 * the same descriptors PenbunAPI mounts its routes from:
 *
 *     { "level": "USER",
 *       "resources": { "customer": { "read": true, "write": false }, … } }
 *
 * The screens used to answer that question themselves — `level === "ADMIN"`
 * written out here, next to `RequireLevelWrite` written out there. Two copies
 * of one rule is how a screen comes to show a button that answers 403, or hide
 * one that would have worked, and neither shows up until someone clicks.
 *
 * So the server is the source and `level === "ADMIN"` is the fallback, not a
 * duplicate: it is what v4 does today, and it is what a demo session or an
 * unreachable API has to fall back on. Nothing here throws — a permission map
 * that will not load leaves the screen on the fallback.
 *
 * This is not authorization. PenbunAPI enforces `user_level` on the routes
 * themselves; this only keeps the buttons honest about what those routes will
 * accept.
 */

import { get } from "./api.js";

/** Matches the enum cache — one load per browser session. */
const TTL_MS = 10 * 60 * 1000;
const CACHE_KEY = "penbun.permissions";

export interface Access {
  read: boolean;
  write: boolean;
}

export interface PermissionMap {
  level: string;
  resources: Record<string, Access>;
}

interface Cached {
  at: number;
  map: PermissionMap;
}

let live: PermissionMap | null = null;
let inflight: Promise<void> | null = null;

function readCache(): Cached | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cached;
    if (typeof c?.at !== "number" || typeof c.map?.resources !== "object" || c.map.resources === null) {
      return null;
    }
    return c;
  } catch {
    return null;
  }
}

function writeCache(map: PermissionMap): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), map } satisfies Cached));
  } catch {
    /* private mode — the map still lives in memory for this page */
  }
}

/**
 * Fill the map for this page. Safe to call on every screen: concurrent callers
 * share one request and a fresh session cache skips the network.
 *
 * The cache is keyed by nothing but the session, so signing in as someone else
 * must drop it — `reset()` is called from tokens.ts when the session changes.
 */
export function loadPermissions(): Promise<void> {
  if (inflight) return inflight;

  const cached = readCache();
  if (cached && Date.now() - cached.at < TTL_MS) {
    live = cached.map;
    return Promise.resolve();
  }

  const run = async (): Promise<void> => {
    try {
      // A master screen waits for this before its first paint, so a hung
      // request must not become a blank page. Same four seconds as the enums.
      const map = await get<PermissionMap>("/meta/permissions", { signal: AbortSignal.timeout(4000) });
      if (map && typeof map.resources === "object" && map.resources !== null) {
        live = map;
        writeCache(map);
      }
    } catch {
      // Offline, expired session, an API that predates the endpoint — every
      // one of them means "use the fallback", not "fail the screen".
    }
  };

  const p = run();
  inflight = p;
  void p.then(() => {
    if (inflight === p) inflight = null;
  });
  return p;
}

/**
 * May this user write `name`? `name` is the API's resource name — the path
 * segment under /api/v2, which is what `MasterResource.name` holds.
 *
 * `level` is the fallback answer, used when the server has not been asked yet
 * or could not be reached. It is required rather than optional so that a caller
 * who has no level in hand has to say so, instead of silently getting `false`
 * on a screen an admin should be able to edit.
 */
export function canWrite(name: string, level: string): boolean {
  const access = live?.resources[name];
  if (access) return access.write;
  return level === "ADMIN";
}

/** May this user read `name`? Same fallback rule as canWrite. */
export function canRead(name: string, level: string): boolean {
  const access = live?.resources[name];
  if (access) return access.read;
  return level === "ADMIN" || name !== "users";
}

/** For tests and the console — what the server last said, or null. */
export function snapshot(): PermissionMap | null {
  return live;
}

/** Test seam, and the hook tokens.ts uses when the session changes. */
export function reset(): void {
  live = null;
  inflight = null;
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* nothing to clear */
  }
}
