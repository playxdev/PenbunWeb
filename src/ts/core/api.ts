/**
 * api.ts — the single door to PenbunAPI.
 *
 * Everything the API returns uses one envelope, so unwrapping it belongs
 * here rather than in every caller:
 *
 *     { status, message, code, data, errors?, trace_id }
 *
 * Callers get `data` on success and an `ApiError` on failure. Branch on
 * `err.code`, never on `err.message` — PenbunAPI reserves the right to
 * reword messages without it counting as a contract change.
 *
 * Token rotation lives here too: a request that comes back TOKEN_EXPIRED is
 * retried once behind a single-flight refresh, so ten parallel requests on a
 * stale token produce one call to /auth/refresh, not ten.
 */

import { apiBase } from "./config.js";
import {
  accessExpired,
  accessToken,
  clear,
  refreshToken,
  store,
  type TokenPair,
} from "./tokens.js";

export interface FieldError {
  field: string;
  code: string;
  value?: string;
}

interface Envelope<T> {
  status: string;
  message: string;
  code: string;
  data: T;
  errors?: FieldError[];
  trace_id: string;
}

/** Codes this front end reacts to. The full list is in PenbunAPI README §7. */
export const CODE = {
  OK: "OK",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  UNAUTHORIZED: "UNAUTHORIZED",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  FORBIDDEN: "FORBIDDEN",
  MUST_CHANGE_PASSWORD: "MUST_CHANGE_PASSWORD",
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  NOT_FOUND: "NOT_FOUND",
  BUSINESS_RULE: "BUSINESS_RULE",
  /** Posting: someone posted this document first. */
  ALREADY_POSTED: "ALREADY_POSTED",
  /** Posting: the document cannot be honoured — and no stock moved. */
  INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK",
  /** A delete refused because another row still points at this one. */
  REF_IN_USE: "REF_IN_USE",
  INTERNAL: "INTERNAL",
  DB_UNAVAILABLE: "DB_UNAVAILABLE",
  /** Client-side only: the request never reached the API. */
  NETWORK: "NETWORK",
} as const;

export class ApiError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly fieldErrors: FieldError[];
  readonly traceId: string;

  constructor(code: string, message: string, httpStatus = 0, fieldErrors: FieldError[] = [], traceId = "") {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.fieldErrors = fieldErrors;
    this.traceId = traceId;
  }

  /** True when the only cure is signing in again. */
  get isAuthFailure(): boolean {
    return this.code === CODE.UNAUTHORIZED || this.code === CODE.TOKEN_EXPIRED;
  }
}

export interface RequestOptions {
  /** JSON request body. Omitted entirely when undefined. */
  body?: unknown;
  /** Attach the bearer token. Default true. */
  auth?: boolean;
  /** Refresh and retry once on TOKEN_EXPIRED. Default true. */
  retry?: boolean;
  signal?: AbortSignal;
}

async function send<T>(method: string, path: string, opts: RequestOptions): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.auth !== false) {
    const token = accessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const init: RequestInit = { method, headers, credentials: "omit" };
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
  if (opts.signal) init.signal = opts.signal;

  let res: Response;
  try {
    res = await fetch(apiBase() + path, init);
  } catch (e) {
    // fetch only rejects for transport problems: DNS, TLS, CORS, offline,
    // or an abort. An HTTP 500 resolves normally and is handled below.
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(CODE.NETWORK, "ติดต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่");
  }

  // 204 carries no envelope by design (see httpx.NoContent).
  if (res.status === 204) return null as T;

  let env: Envelope<T> | null = null;
  try {
    env = (await res.json()) as Envelope<T>;
  } catch {
    env = null;
  }

  if (!env || typeof env.code !== "string") {
    // A proxy, a Pages 404 page, or an HTML error document — anything but us.
    throw new ApiError(
      res.ok ? CODE.INTERNAL : String(res.status),
      `เซิร์ฟเวอร์ตอบกลับในรูปแบบที่ไม่รู้จัก (HTTP ${res.status})`,
      res.status
    );
  }

  if (!res.ok || env.status !== "success") {
    throw new ApiError(env.code, env.message, res.status, env.errors ?? [], env.trace_id);
  }
  return env.data;
}

/* ------------------------------------------------------- token rotation */

let inflight: Promise<TokenPair> | null = null;

/**
 * Trade the refresh token for a new pair. Concurrent callers share one call.
 *
 * PenbunAPI revokes the old refresh token the moment it is used, so two
 * simultaneous refreshes would race and one of them would be handed a token
 * that is already dead.
 */
export function refreshSession(): Promise<TokenPair> {
  if (inflight) return inflight;

  const run = async (): Promise<TokenPair> => {
    const rt = refreshToken();
    if (!rt) throw new ApiError(CODE.UNAUTHORIZED, "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่", 401);
    try {
      const pair = await send<TokenPair>("POST", "/auth/refresh", {
        body: { refresh_token: rt },
        auth: false,
        retry: false,
      });
      store(pair);
      return pair;
    } catch (e) {
      // A refresh that fails for any reason other than a flaky network means
      // this browser can no longer prove who it is. Keeping the dead tokens
      // around would only produce a redirect loop on the next page.
      if (!(e instanceof ApiError) || e.code !== CODE.NETWORK) clear();
      throw e;
    }
  };

  const p = run();
  inflight = p;
  void p.catch(() => undefined).then(() => {
    if (inflight === p) inflight = null;
  });
  return p;
}

/* ------------------------------------------------------------- requests */

export async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const wantsAuth = opts.auth !== false;
  const canRetry = opts.retry !== false;

  // Refresh before sending when the clock already says the token is spent.
  if (wantsAuth && canRetry && refreshToken() && accessExpired()) {
    await refreshSession();
  }

  try {
    return await send<T>(method, path, opts);
  } catch (e) {
    const expired = e instanceof ApiError && e.code === CODE.TOKEN_EXPIRED;
    if (!expired || !wantsAuth || !canRetry || !refreshToken()) throw e;
    await refreshSession();
    return send<T>(method, path, { ...opts, retry: false });
  }
}

export const get = <T>(path: string, opts?: RequestOptions): Promise<T> => request<T>("GET", path, opts);
export const post = <T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> =>
  request<T>("POST", path, { ...opts, body });
export const put = <T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> =>
  request<T>("PUT", path, { ...opts, body });
export const del = <T>(path: string, opts?: RequestOptions): Promise<T> => request<T>("DELETE", path, opts);
