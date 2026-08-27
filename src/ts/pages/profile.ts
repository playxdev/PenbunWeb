/**
 * pages/profile.ts — fills the profile screen from the signed-in session.
 *
 * Every field on the screen maps to one column of tb_users. Anything the
 * table has no column for (phone, UI language, uploaded avatar) is not shown:
 * a form that collects what nothing can store is a form that lies.
 *
 * Saving is still a stub — PenbunAPI v4 exposes no profile-update route, only
 * /auth/me and /auth/change-password.
 */

import type { Session } from "../core/auth.js";
import { dateTime } from "../core/format.js";

function text(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function field(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el instanceof HTMLInputElement) el.value = value;
}

export function initProfile(user: Session): void {
  // full_name is nullable; Session already falls back to user_name.
  text("pf-avatar", user.initials);
  text("pf-name", user.name);
  text("pf-mail", user.email || "—");
  text("pf-level", user.role);
  text(
    "pf-last",
    user.lastLoginDate
      ? `เข้าใช้ล่าสุด ${dateTime(user.lastLoginDate)}`
      : "ยังไม่มีบันทึกการเข้าใช้"
  );

  field("p-name", user.name);
  field("p-user", user.username);
  field("p-mail", user.email);
  field("p-uid", user.userId);
}
