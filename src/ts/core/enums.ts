/**
 * enums.ts — the values the database actually accepts.
 *
 * `GET /meta/enums` reads every `CK_*` CHECK constraint at run time and
 * answers a flat map keyed by table and column, with the `tb_` prefix
 * stripped:
 *
 *     { "warehouse_warehouse_type": ["BRANCH", "DAMAGED", "DC", …],
 *       "route_route_type":         ["DAILY", "LEGACY_LINE", "REGION"], … }
 *
 * The descriptors used to write those lists out by hand, which made three
 * copies of one list — `internal/resources` on the server, `master/resources.ts`
 * here, and the constraint itself. The first value v8 adds makes two of them
 * wrong: a screen either offers an option the database rejects, or hides one
 * it would have accepted, and neither shows up until someone saves.
 *
 * So the constraint is the source and the local array is a fallback, not a
 * duplicate. `values()` keeps the fallback's order — the API sorts
 * alphabetically, which puts คลังของชำรุด above ศูนย์กระจายสินค้า — and appends
 * anything the server knows that this build does not. A value the server no
 * longer accepts disappears even if the fallback still lists it.
 *
 * Nothing here throws. An enum that cannot be loaded leaves the screen on its
 * fallback, which is what the build shipped with and was right on the day it
 * shipped; a form that refuses to render because a lookup failed is worse.
 */

import { get } from "./api.js";

/** Matches the 10-minute cache in PenbunAPI's meta handler. */
const TTL_MS = 10 * 60 * 1000;
const CACHE_KEY = "penbun.enums";

type EnumMap = Record<string, readonly string[]>;

interface Cached {
  at: number;
  map: EnumMap;
}

let live: EnumMap = {};
let inflight: Promise<void> | null = null;

function readCache(): Cached | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cached;
    if (typeof c?.at !== "number" || typeof c.map !== "object" || c.map === null) return null;
    return c;
  } catch {
    return null;
  }
}

function writeCache(map: EnumMap): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), map } satisfies Cached));
  } catch {
    /* private mode — the map still lives in memory for this page */
  }
}

/**
 * Fill the map for this page. Safe to call on every screen: concurrent
 * callers share one request, and a fresh session cache skips the network.
 */
export function loadEnums(): Promise<void> {
  if (inflight) return inflight;

  const cached = readCache();
  if (cached && Date.now() - cached.at < TTL_MS) {
    live = cached.map;
    return Promise.resolve();
  }

  const run = async (): Promise<void> => {
    try {
      // A master screen waits for this before its first paint, so a hung
      // request must not become a blank page. Four seconds, then the
      // fallback — the endpoint is cached server-side and answers in ms.
      const map = await get<EnumMap>("/meta/enums", { signal: AbortSignal.timeout(4000) });
      if (map && typeof map === "object") {
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

/** True once the server's list for this key is known. */
export function loaded(key: string): boolean {
  return Array.isArray(live[key]) && live[key].length > 0;
}

/**
 * The accepted values for one key, in the fallback's order.
 *
 * Values the fallback does not know are appended in the order the server
 * sent them, so a v8 addition is usable the day it lands with no deploy here
 * — it simply shows its raw code until someone adds a Thai label.
 */
export function values(key: string, fallback: readonly string[]): readonly string[] {
  const server = live[key];
  if (!Array.isArray(server) || server.length === 0) return fallback;

  const accepted = new Set(server);
  const known = fallback.filter((v) => accepted.has(v));
  const added = server.filter((v) => !fallback.includes(v));
  return [...known, ...added];
}

/** For tests and the console — what the server last said. */
export function snapshot(): EnumMap {
  return live;
}

/** Test seam: drop everything loaded so far. */
export function reset(): void {
  live = {};
  inflight = null;
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* nothing to clear */
  }
}
