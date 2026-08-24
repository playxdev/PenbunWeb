/**
 * tokens.ts — the only place the JWT pair is read from or written to.
 *
 * Kept separate from auth.ts so that api.ts can attach and rotate tokens
 * without importing auth.ts, which imports api.ts. One module owning the
 * storage key also means "sign out" is a single call that cannot miss a
 * leftover field.
 *
 * Storage: localStorage, shared across tabs.
 *
 * > Known trade-off: a refresh token in localStorage is readable by any
 * > script that manages to run on this origin. The alternative — an
 * > HttpOnly cookie — needs a same-site backend to set it, which a static
 * > Pages deployment talking to a bearer-token API does not have. The CSP
 * > in public/_headers is therefore load-bearing, not decoration.
 */

const KEY = "penbun.auth";
/** beta 1.3.0 wrote a fake session here. Removed on every clear(). */
const LEGACY_KEY = "penbun.session";

/** `UserInfo` as returned by PenbunAPI — field names are the wire format. */
export interface ApiUser {
  user_id: string;
  user_name: string;
  full_name: string | null;
  email: string | null;
  user_level: string;
  must_change_password: boolean;
  last_login_date: string | null;
}

/** `TokenPair` as returned by /auth/login, /auth/refresh, /auth/change-password. */
export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: ApiUser;
}

export interface StoredAuth {
  access: string;
  refresh: string;
  /** Epoch ms at which the access token stops being accepted. */
  expiresAt: number;
  user: ApiUser;
  /** True for the offline UI demo, which must never call the API. */
  demo: boolean;
}

function isStored(v: unknown): v is StoredAuth {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Partial<StoredAuth>;
  return typeof s.access === "string" && typeof s.expiresAt === "number" && typeof s.user === "object" && s.user !== null;
}

export function read(): StoredAuth | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null; // private mode: storage is unreadable, not corrupt
  }
  if (!raw) return null;

  // Anything that is not a session we recognise is dropped rather than left
  // to fail identically on every future read.
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isStored(parsed)) return parsed;
  } catch {
    /* falls through to the cleanup below */
  }
  clear();
  return null;
}

function write(s: StoredAuth): StoredAuth {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* quota or private mode: the session lives only in this page */
  }
  return s;
}

/** Persist a fresh token pair. Used by login, refresh and change-password. */
export function store(pair: TokenPair): StoredAuth {
  return write({
    access: pair.access_token,
    refresh: pair.refresh_token,
    // expires_in is seconds and comes from the server; trust it over any
    // client-side decoding of the token body.
    expiresAt: Date.now() + Math.max(0, pair.expires_in) * 1000,
    user: pair.user,
    demo: false,
  });
}

/** Offline session for reviewing the UI with no API running. */
export function storeDemo(user: ApiUser): StoredAuth {
  return write({ access: "", refresh: "", expiresAt: Date.now() + 12 * 3600 * 1000, user, demo: true });
}

export function clear(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* nothing else to do */
  }
}

export function accessToken(): string {
  return read()?.access ?? "";
}

export function refreshToken(): string {
  return read()?.refresh ?? "";
}

export function currentUser(): ApiUser | null {
  return read()?.user ?? null;
}

export function isDemo(): boolean {
  return read()?.demo === true;
}

/** Replace the cached profile without touching the tokens (used by /auth/me). */
export function updateUser(user: ApiUser): void {
  const s = read();
  if (s) write({ ...s, user });
}

/**
 * True when the access token is spent or about to be.
 *
 * The 30s skew means a request that would have died in flight refreshes
 * first instead of spending a round trip to learn it was too late.
 */
export function accessExpired(skewMs = 30_000): boolean {
  const s = read();
  return !s || s.expiresAt - skewMs <= Date.now();
}
