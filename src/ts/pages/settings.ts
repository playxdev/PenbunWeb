/**
 * pages/settings.ts — the only part of the settings screen that is not markup.
 *
 * "เกี่ยวกับระบบ" used to print three version numbers straight into the HTML.
 * Two of them were already wrong: nothing updated them when the API shipped,
 * and the card claimed the front end was not connected to PenbunAPI at all
 * while every master screen was reading through it.
 *
 * So the card now shows only what something can vouch for — this build's own
 * version, and whatever `GET /version` answers. PenbunSQL's version is not
 * there any more because no endpoint reports it; a number nobody checks is
 * how the old card came to be wrong.
 */

import { apiBase } from "../core/config.js";
import { esc } from "../core/format.js";
import { fetchApiVersion, WEB_VERSION } from "../core/version.js";
import type { Session } from "../core/auth.js";

const badge = (tone: string, text: string): string =>
  `<span class="pb-badge pb-badge--${tone}">${esc(text)}</span>`;

function set(id: string, html: string): void {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

export async function initSettings(user: Session): Promise<void> {
  set("pb-ver-web", esc(WEB_VERSION));
  set("pb-ver-base", esc(apiBase()));

  if (user.demo) {
    set("pb-ver-api", "—");
    set("pb-ver-status", badge("warn", "โหมดสาธิต ไม่ได้เชื่อมต่อ PenbunAPI"));
    return;
  }

  try {
    const v = await fetchApiVersion();
    set("pb-ver-api", esc(`${v.version} · ${v.api}`));
    set("pb-ver-status", badge("pos", "เชื่อมต่อแล้ว"));
  } catch {
    // /version needs no token, so a failure here is the network or the host,
    // never an expired session. Say that rather than guessing a cause.
    set("pb-ver-api", "—");
    set("pb-ver-status", badge("neg", "ติดต่อ PenbunAPI ไม่ได้"));
  }
}
