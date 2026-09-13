/**
 * pages/profile.ts — fills the profile screen, and saves what it can.
 *
 * Every field on the screen maps to one column of tb_users. Anything the
 * table has no column for (phone, UI language, uploaded avatar) is not shown:
 * a form that collects what nothing can store is a form that lies.
 *
 * Two things are editable and both go through the caller's own account, never
 * through an id in the URL: PUT /auth/me for the name and the address, and
 * POST /auth/change-password for the password. Editing somebody else is
 * PUT /users/{id}, which is an admin route and does not exist yet.
 *
 * user_name and user_level are readonly on purpose. The first is written into
 * update_by on every row in the system, so changing it would orphan the audit
 * trail. The second decides what this account may do — anyone who can edit
 * their own level can grant themselves anything.
 */

import { post, put } from "../core/api.js";
import type { Session } from "../core/auth.js";
import { dateTime } from "../core/format.js";
import { store, updateUser, type ApiUser, type TokenPair } from "../core/tokens.js";
import { formDialog, toast } from "../core/ui.js";

function text(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function input(id: string): HTMLInputElement | null {
  const el = document.getElementById(id);
  return el instanceof HTMLInputElement ? el : null;
}

function field(id: string, value: string): void {
  const el = input(id);
  if (el) el.value = value;
}

/** Paints the summary card. Called again after a save so both sides agree. */
function paint(user: { initials: string; name: string; email: string; role: string; lastLoginDate?: string | null }): void {
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
}

/**
 * Saves the two editable columns.
 *
 * The screen is repainted from what the API returns rather than from what was
 * typed: the column is nullable and a blank box is stored as NULL, so the
 * value that comes back is the one that exists.
 */
async function save(btn: HTMLButtonElement): Promise<void> {
  const name = input("p-name")?.value.trim() ?? "";
  const mail = input("p-mail")?.value.trim() ?? "";

  btn.disabled = true;
  try {
    const saved = await put<ApiUser>("/auth/me", { full_name: name, email: mail });
    updateUser(saved);

    field("p-name", saved.full_name ?? "");
    field("p-mail", saved.email ?? "");
    paint({
      initials: (saved.full_name || saved.user_name).slice(0, 2),
      name: saved.full_name || saved.user_name,
      email: saved.email ?? "",
      role: document.getElementById("pf-level")?.textContent ?? "",
      lastLoginDate: saved.last_login_date,
    });
    toast("บันทึกแล้ว", "ข้อมูลผู้ใช้ถูกปรับปรุงเรียบร้อย", "pos");
  } catch (e) {
    toast("บันทึกไม่สำเร็จ", e instanceof Error ? e.message : "", "neg");
  } finally {
    btn.disabled = false;
  }
}

/**
 * Asks for the current and the new password, then swaps the session.
 *
 * The API answers a fresh token pair, and storing it matters: changing the
 * password revokes nothing on this device, but the reply also carries
 * must_change_password cleared, and a stale copy would keep the whole app
 * bouncing off RequirePasswordChanged.
 *
 * The two new-password boxes are compared here rather than on the server
 * because the server never receives the second one — it exists to catch a
 * typo, which is a question about this form, not about the account.
 */
async function changePassword(): Promise<void> {
  const values = await formDialog({
    title: "เปลี่ยนรหัสผ่าน",
    confirmLabel: "เปลี่ยนรหัสผ่าน",
    bodyHtml: `
      <div class="pb-field">
        <label class="pb-label" for="cp-cur">รหัสผ่านปัจจุบัน</label>
        <input class="pb-input" id="cp-cur" data-field="current" type="password" autocomplete="current-password">
      </div>
      <div class="pb-field">
        <label class="pb-label" for="cp-new">รหัสผ่านใหม่</label>
        <input class="pb-input" id="cp-new" data-field="next" type="password" autocomplete="new-password">
        <span class="pb-hint">อย่างน้อย 8 ตัวอักษร และต้องมีทั้งตัวอักษรและตัวเลข</span>
      </div>
      <div class="pb-field">
        <label class="pb-label" for="cp-rep">ยืนยันรหัสผ่านใหม่</label>
        <input class="pb-input" id="cp-rep" data-field="repeat" type="password" autocomplete="new-password">
      </div>`,
  });
  if (!values) return;

  const cur = values.current ?? "";
  const next = values.next ?? "";
  const rep = values.repeat ?? "";

  if (!cur || !next) {
    toast("กรอกไม่ครบ", "ต้องระบุทั้งรหัสผ่านปัจจุบันและรหัสผ่านใหม่", "neg");
    return;
  }
  if (next !== rep) {
    toast("รหัสผ่านใหม่ไม่ตรงกัน", "กรอกรหัสผ่านใหม่ให้เหมือนกันทั้งสองช่อง", "neg");
    return;
  }

  try {
    const pair = await post<TokenPair>("/auth/change-password", {
      current_password: cur,
      new_password: next,
    });
    store(pair);
    toast("เปลี่ยนรหัสผ่านแล้ว", "ครั้งต่อไปให้เข้าสู่ระบบด้วยรหัสผ่านใหม่", "pos");
  } catch (e) {
    toast("เปลี่ยนรหัสผ่านไม่สำเร็จ", e instanceof Error ? e.message : "", "neg");
  }
}

export function initProfile(user: Session): void {
  // full_name is nullable; Session already falls back to user_name.
  paint(user);

  field("p-name", user.name);
  field("p-user", user.username);
  field("p-mail", user.email);
  field("p-uid", user.userId);

  document.getElementById("pf-change-pw")?.addEventListener("click", () => {
    void changePassword();
  });
  document.getElementById("pf-save")?.addEventListener("click", (e) => {
    void save(e.currentTarget as HTMLButtonElement);
  });
}
