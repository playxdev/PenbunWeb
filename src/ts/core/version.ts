/**
 * version.ts — what this build is, and what it is talking to.
 *
 * WEB_VERSION is the one place the front end's own version is written down.
 * `npm test` fails if it drifts from `package.json`, because the two are
 * read by different people — the tag comes from package.json, the screen
 * shows this constant — and a version string that lies is worse than none.
 *
 * The API's version comes from `GET /version`, which is registered on the
 * app root rather than under `/api/v2` and answers plain JSON rather than the
 * usual envelope. That is why this does not go through core/api.ts: sending
 * it there would only make the envelope parser reject a healthy response.
 * It needs no token either, so it doubles as a reachability probe.
 */

import { apiRoot } from "./config.js";

/** Must equal `version` in package.json. */
export const WEB_VERSION = "1.4.0-beta.1";

export interface ApiVersion {
  /** PenbunAPI's own version, e.g. "4.0.0". */
  version: string;
  /** The prefix it mounts its routes under, e.g. "v2". */
  api: string;
}

/**
 * Ask the API what it is. Rejects on anything but a well-formed answer —
 * the caller shows "ติดต่อไม่ได้", which is the honest reading of a version
 * endpoint that will not answer.
 */
export async function fetchApiVersion(signal?: AbortSignal): Promise<ApiVersion> {
  const res = await fetch(apiRoot() + "/version", {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "omit",
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const body = (await res.json()) as Partial<ApiVersion>;
  if (typeof body?.version !== "string" || typeof body.api !== "string") {
    throw new Error("unexpected body");
  }
  return { version: body.version, api: body.api };
}
