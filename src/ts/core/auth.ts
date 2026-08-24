/**
 * auth.ts — sign in, sign out, and the session every shell page reads.
 *
 * Talks to PenbunAPI:
 *
 *   POST /auth/login             username + password  → token pair
 *   POST /auth/logout            revokes the current access token (204)
 *   POST /auth/change-password   → a fresh token pair, cleared flag
 *   GET  /auth/me                current profile, used to validate a session
 *
 * Token storage and rotation are not here — they belong to tokens.ts and
 * api.ts. This module owns one thing: turning the API's `UserInfo` into the
 * `Session` shape the layout renders.
 */

import { ApiError, CODE, get, post } from "./api.js";
import {
  clear,
  currentUser,
  isDemo,
  read,
  store,
  storeDemo,
  updateUser,
  type ApiUser,
  type TokenPair,
} from "./tokens.js";

/** What the shell renders. Derived from ApiUser; never persisted on its own. */
export interface Session {
  userId: string;
  name: string;
  username: string;
  /** Thai label for user_level, for display only. Authorization is the API's job. */
  role: string;
  level: string;
  branch: string;
  initials: string;
  email: string;
  mustChangePassword: boolean;
  demo: boolean;
}

/**
 * PenbunSQL v7 has no branch on tb_users and PenbunAPI v4 has only
 * ADMIN / USER (see mw.RequireLevel). Both are display-only placeholders and
 * must be replaced — not extended — once tb_role lands.
 */
const DEFAULT_BRANCH = "ศูนย์กระจายสินค้า (DC)";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "ผู้ดูแลระบบ",
  USER: "ผู้ใช้งาน",
};

const DEMO_USER: ApiUser = {
  user_id: "USR-DEMO",
  user_name: "demo",
  full_name: "ผู้ใช้สาธิต",
  email: null,
  user_level: "USER",
  must_change_password: false,
  last_login_date: null,
};

/**
 * Two letters for the avatar.
 *
 * Thai names have no capitals to lean on, so take the first character of the
 * first two words. Array.from, not [0], so a name starting with a surrogate
 * pair is not cut in half.
 */
export function initialsOf(name: string, fallback: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((w) => Array.from(w)[0] ?? "");
  const joined = letters.join("");
  if (joined) return joined;
  return Array.from(fallback.toUpperCase()).slice(0, 2).join("") || "?";
}

function toSession(u: ApiUser, demo: boolean): Session {
  const name = u.full_name?.trim() || u.user_name;
  return {
    userId: u.user_id,
    name,
    username: u.user_name,
    role: ROLE_LABEL[u.user_level] ?? u.user_level,
    level: u.user_level,
    branch: DEFAULT_BRANCH,
    initials: initialsOf(name, u.user_name),
    email: u.email ?? "",
    mustChangePassword: u.must_change_password,
    demo,
  };
}

/** The session held by this browser, or null. Never hits the network. */
export function session(): Session | null {
  const s = read();
  return s ? toSession(s.user, s.demo) : null;
}

export function isSignedIn(): boolean {
  return read() !== null;
}

/**
 * Sign in with real credentials.
 *
 * Throws ApiError. The codes worth branching on:
 *   UNAUTHORIZED      wrong username or password
 *   ACCOUNT_LOCKED    too many failures; an admin must unlock
 *   VALIDATION_FAILED a field was left empty
 *   NETWORK           the API was not reachable
 */
export async function signIn(username: string, password: string): Promise<Session> {
  const pair = await post<TokenPair>("/auth/login", { username, password }, { auth: false, retry: false });
  const stored = store(pair);
  return toSession(stored.user, stored.demo);
}

/** Offline session for reviewing screens with no API running. */
export function signInDemo(): Session {
  const stored = storeDemo(DEMO_USER);
  return toSession(stored.user, stored.demo);
}

/**
 * Sign out, then leave for the sign-in page.
 *
 * The API call revokes the token server-side, but the local session is
 * cleared whether or not that call succeeds — a user who clicks "sign out"
 * on a dead network must still end up signed out on this device.
 */
export async function signOut(redirect = "/index.html"): Promise<void> {
  try {
    if (!isDemo() && read()?.access) await post<null>("/auth/logout", undefined, { retry: false });
  } catch {
    /* revoking is best effort; clearing below is not */
  }
  clear();
  location.href = redirect;
}

/**
 * First password change, forced by tb_users.status_change_pw.
 *
 * Returns a new token pair with the flag cleared, so the caller can continue
 * straight into the app instead of sending the user back to sign in.
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<Session> {
  const pair = await post<TokenPair>(
    "/auth/change-password",
    { current_password: currentPassword, new_password: newPassword },
    { retry: false }
  );
  const stored = store(pair);
  return toSession(stored.user, stored.demo);
}

/**
 * Ask the API who this token belongs to, and refresh the cached profile.
 *
 * This is how a session revoked elsewhere (logout in another tab, an admin
 * lock, a server restart that emptied the revocation list) is discovered.
 */
export async function fetchMe(): Promise<Session> {
  const u = await get<ApiUser>("/auth/me");
  updateUser(u);
  return toSession(u, isDemo());
}

/**
 * Guard for every page inside the shell. Synchronous on purpose: the layout
 * must not render a menu while a network call decides whether it may.
 */
export function requireSession(): Session {
  const s = session();
  if (!s) {
    const next = encodeURIComponent(location.pathname + location.search);
    location.replace(`/index.html?next=${next}`);
    throw new Error("no session");
  }
  return s;
}

/**
 * Background check that the stored token is still honoured.
 *
 * Called after the shell has painted. A hard auth failure ends the session;
 * anything else (offline, API down) is left alone — the pages in this
 * release render from mock data and stay useful without the API.
 */
export async function validateSession(): Promise<Session | null> {
  if (isDemo() || !isSignedIn()) return null;
  try {
    return await fetchMe();
  } catch (e) {
    if (e instanceof ApiError && (e.isAuthFailure || e.code === CODE.ACCOUNT_LOCKED)) {
      clear();
      const next = encodeURIComponent(location.pathname + location.search);
      location.replace(`/index.html?next=${next}&reason=expired`);
    }
    return null;
  }
}

export function cachedUser(): ApiUser | null {
  return currentUser();
}
