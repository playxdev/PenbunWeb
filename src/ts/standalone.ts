/**
 * standalone.ts — pages rendered outside the shell: sign-in and errors.
 *
 * The layout chrome (sidebar/topbar/footer) does not exist here; the page
 * shares only the theme controls with the app, imported from components/.
 */

import { initTheme } from "./core/theme.js";
import { changePassword, session, signIn, signInDemo, signOut } from "./core/auth.js";
import { ApiError, CODE } from "./core/api.js";
import { wireThemeControls } from "./components/theme-toggle.js";
import { toast } from "./core/ui.js";

/* --------------------------------------------------------------- alerts */

type AlertKind = "neg" | "brand" | "pos";

function showAlert(host: HTMLElement | null, kind: AlertKind, title: string, detail = ""): void {
  if (!host) return;
  host.className = `pb-alert pb-alert--${kind}`;
  host.hidden = false;
  host.textContent = "";

  const body = document.createElement("div");
  const t = document.createElement("div");
  t.className = "pb-alert__title";
  t.textContent = title;
  body.appendChild(t);
  if (detail) {
    const d = document.createElement("div");
    d.className = "pb-muted";
    d.style.fontSize = "var(--pb-fs-xs)";
    d.textContent = detail;
    body.appendChild(d);
  }
  host.appendChild(body);
}

function hideAlert(host: HTMLElement | null): void {
  if (host) host.hidden = true;
}

/**
 * Turn a failure into something a warehouse clerk can act on.
 *
 * Branching is on `code`; the API's `message` is already written for the end
 * user in Thai, so it is shown as the detail line rather than reinvented.
 */
function describe(e: unknown): { title: string; detail: string } {
  if (!(e instanceof ApiError)) {
    return { title: "เข้าสู่ระบบไม่สำเร็จ", detail: "เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่" };
  }
  switch (e.code) {
    case CODE.NETWORK:
      return { title: "ติดต่อเซิร์ฟเวอร์ไม่ได้", detail: "ตรวจสอบว่า PenbunAPI ทำงานอยู่ แล้วลองใหม่อีกครั้ง" };
    case CODE.ACCOUNT_LOCKED:
      return { title: "บัญชีถูกระงับ", detail: e.message };
    case CODE.UNAUTHORIZED:
      return { title: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", detail: "ตรวจสอบตัวพิมพ์เล็ก-ใหญ่แล้วลองใหม่" };
    case CODE.VALIDATION_FAILED:
      return { title: "ข้อมูลไม่ครบถ้วน", detail: e.message };
    case CODE.DB_UNAVAILABLE:
      return { title: "ระบบฐานข้อมูลไม่พร้อมใช้งาน", detail: "กรุณาลองใหม่ในอีกสักครู่" };
    default:
      return { title: "เข้าสู่ระบบไม่สำเร็จ", detail: e.traceId ? `${e.message} · ${e.traceId}` : e.message };
  }
}

/* -------------------------------------------------------------- sign in */

function nextUrl(): string {
  const next = new URLSearchParams(location.search).get("next");
  // Only allow same-origin relative paths.
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard.html";
}

function busy(btn: HTMLButtonElement, on: boolean, label: string): void {
  btn.disabled = on;
  if (on) {
    btn.dataset.idleLabel ??= btn.textContent ?? "";
    btn.textContent = label;
  } else {
    btn.textContent = btn.dataset.idleLabel ?? btn.textContent ?? "";
  }
}

function wireSignIn(): void {
  const form = document.querySelector<HTMLFormElement>("#pb-signin");
  if (!form) return;

  const alertHost = document.querySelector<HTMLElement>("#pb-signin-alert");
  const pwForm = document.querySelector<HTMLFormElement>("#pb-changepw");
  // Each step owns its own alert: the sign-in form is hidden while the
  // password step is up, and a message inside a hidden form is no message.
  const pwAlertHost = document.querySelector<HTMLElement>("#pb-changepw-alert");
  const force = new URLSearchParams(location.search).get("force") === "1";
  const current = session();

  // Already signed in and nothing blocking? Go straight through.
  if (current && !current.mustChangePassword && !force) {
    location.replace(nextUrl());
    return;
  }
  // A stored session that still owes a password change cannot jump straight
  // to the change form: /auth/change-password needs the current password in
  // plaintext, and it only exists in memory right after a successful sign in.
  if (current?.mustChangePassword) {
    showAlert(alertHost, "brand", "ต้องเปลี่ยนรหัสผ่านก่อนใช้งาน", "เข้าสู่ระบบอีกครั้งเพื่อตั้งรหัสผ่านใหม่");
  } else if (new URLSearchParams(location.search).get("reason") === "expired") {
    showAlert(alertHost, "brand", "เซสชันหมดอายุ", "กรุณาเข้าสู่ระบบอีกครั้ง");
  }

  const reveal = form.querySelector<HTMLButtonElement>("[data-reveal]");
  const pass = form.querySelector<HTMLInputElement>("#pb-password");
  reveal?.addEventListener("click", () => {
    if (!pass) return;
    const show = pass.type === "password";
    pass.type = show ? "text" : "password";
    reveal.setAttribute("aria-label", show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน");
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    void submitSignIn(form, alertHost);
  });

  document.querySelector("[data-demo-login]")?.addEventListener("click", () => {
    signInDemo();
    location.assign(nextUrl());
  });

  /** Swap the sign-in form for the forced first password change. */
  const openPasswordStep = (currentPassword: string): void => {
    if (!pwForm) return;
    form.hidden = true;
    pwForm.hidden = false;
    pwForm.dataset.currentPassword = currentPassword;
    pwForm.querySelector<HTMLInputElement>("#pb-newpw")?.focus();
  };

  async function submitSignIn(f: HTMLFormElement, host: HTMLElement | null): Promise<void> {
    const btn = f.querySelector<HTMLButtonElement>("[type=submit]")!;
    const username = f.querySelector<HTMLInputElement>("#pb-username")?.value.trim() ?? "";
    const password = f.querySelector<HTMLInputElement>("#pb-password")?.value ?? "";

    hideAlert(host);
    if (!username || !password) {
      showAlert(host, "neg", "ข้อมูลไม่ครบถ้วน", "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
      return;
    }

    busy(btn, true, "กำลังเข้าสู่ระบบ…");
    try {
      const s = await signIn(username, password);
      if (s.mustChangePassword) {
        busy(btn, false, "");
        hideAlert(host);
        showAlert(pwAlertHost, "brand", "ต้องเปลี่ยนรหัสผ่านก่อนใช้งาน", "กรุณาตั้งรหัสผ่านใหม่สำหรับการเข้าใช้งานครั้งแรก");
        openPasswordStep(password);
        return;
      }
      location.assign(nextUrl());
    } catch (err) {
      busy(btn, false, "");
      const { title, detail } = describe(err);
      showAlert(host, "neg", title, detail);
      f.querySelector<HTMLInputElement>("#pb-password")?.focus();
    }
  }

  wirePasswordStep(pwForm, pwAlertHost);
}

function wirePasswordStep(pwForm: HTMLFormElement | null, alertHost: HTMLElement | null): void {
  if (!pwForm) return;

  pwForm.addEventListener("submit", (e) => {
    e.preventDefault();
    void (async () => {
      const btn = pwForm.querySelector<HTMLButtonElement>("[type=submit]")!;
      const next = pwForm.querySelector<HTMLInputElement>("#pb-newpw")?.value ?? "";
      const confirm = pwForm.querySelector<HTMLInputElement>("#pb-newpw2")?.value ?? "";
      const cur = pwForm.dataset.currentPassword ?? "";

      hideAlert(alertHost);
      if (next !== confirm) {
        showAlert(alertHost, "neg", "รหัสผ่านใหม่ไม่ตรงกัน", "กรอกรหัสผ่านใหม่ให้ตรงกันทั้งสองช่อง");
        return;
      }
      // Mirrors validatePasswordPolicy() in PenbunAPI so the user is told
      // before a round trip. The server still decides.
      if (Array.from(next).length < 8 || !/[A-Za-z]/.test(next) || !/[0-9]/.test(next)) {
        showAlert(alertHost, "neg", "รหัสผ่านไม่ผ่านเกณฑ์", "ต้องยาวอย่างน้อย 8 ตัวอักษร และมีทั้งตัวอักษรและตัวเลข");
        return;
      }
      if (!cur) {
        showAlert(alertHost, "neg", "เซสชันไม่สมบูรณ์", "กรุณาเข้าสู่ระบบใหม่อีกครั้ง");
        return;
      }

      busy(btn, true, "กำลังบันทึก…");
      try {
        await changePassword(cur, next);
        location.assign(nextUrl());
      } catch (err) {
        busy(btn, false, "");
        const { title, detail } = describe(err);
        showAlert(alertHost, "neg", title, detail);
      }
    })();
  });
}

/* ---------------------------------------------------------- error pages */

function wireErrorPage(): void {
  document.querySelector("[data-go-back]")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (history.length > 1) history.back();
    else location.assign("/dashboard.html");
  });
  document.querySelector("[data-retry]")?.addEventListener("click", (e) => {
    e.preventDefault();
    location.reload();
  });
  document.querySelector("[data-signout]")?.addEventListener("click", () => void signOut());
  document.querySelector("[data-copy-ref]")?.addEventListener("click", async (e) => {
    const ref = (e.currentTarget as HTMLElement).dataset.copyRef ?? "";
    try {
      await navigator.clipboard.writeText(ref);
      toast("คัดลอกรหัสอ้างอิงแล้ว", ref, "pos");
    } catch {
      toast("คัดลอกไม่สำเร็จ", "กรุณาคัดลอกด้วยตนเอง", "neg");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  wireThemeControls();
  wireSignIn();
  wireErrorPage();
});
