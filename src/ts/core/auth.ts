/**
 * auth.ts — session stub for the UI beta.
 *
 * There is no real authentication in beta 1.1.0. Any credentials are
 * accepted and a fake session is written to localStorage so the shell can
 * render a user and so /dashboard.html can be guarded the same way it will
 * be once PenbunAPI issues real JWTs.
 *
 * Replace `signIn` with POST /api/v4/auth/login and store the token; the
 * rest of the app only ever reads `session()`.
 */

export interface Session {
  userId: string;
  name: string;
  username: string;
  role: string;
  branch: string;
  initials: string;
  issuedAt: number;
}

const KEY = "penbun.session";

const DEMO: Omit<Session, "issuedAt"> = {
  userId: "USR-0001",
  name: "จักรพงษ์ ศรีวิไล",
  username: "jack",
  role: "ผู้ดูแลระบบ",
  branch: "ศูนย์กระจายสินค้า (DC)",
  initials: "จศ",
};

export function session(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function isSignedIn(): boolean {
  return session() !== null;
}

export function signIn(username?: string): Session {
  const s: Session = { ...DEMO, issuedAt: Date.now() };
  if (username && username.trim()) s.username = username.trim();
  localStorage.setItem(KEY, JSON.stringify(s));
  return s;
}

export function signOut(redirect = "/index.html"): void {
  localStorage.removeItem(KEY);
  location.href = redirect;
}

/** Guard for every page inside the shell. */
export function requireSession(): Session {
  const s = session();
  if (!s) {
    const next = encodeURIComponent(location.pathname + location.search);
    location.replace(`/index.html?next=${next}`);
    throw new Error("no session");
  }
  return s;
}
