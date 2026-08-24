/**
 * standalone.ts — pages rendered outside the shell: sign-in and errors.
 *
 * The layout chrome (sidebar/topbar/footer) does not exist here; the page
 * shares only the theme controls with the app, imported from components/.
 */

import { initTheme } from "./core/theme.js";
import { isSignedIn, signIn, signOut } from "./core/auth.js";
import { wireThemeControls } from "./components/theme-toggle.js";
import { toast } from "./core/ui.js";

function wireSignIn(): void {
  const form = document.querySelector<HTMLFormElement>("#pb-signin");
  if (!form) return;

  // Already signed in? Go straight through.
  if (isSignedIn() && !location.search.includes("force=1")) {
    location.replace(nextUrl());
    return;
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
    const btn = form.querySelector<HTMLButtonElement>("[type=submit]")!;
    const user = form.querySelector<HTMLInputElement>("#pb-username")?.value;

    btn.disabled = true;
    btn.textContent = "กำลังเข้าสู่ระบบ…";
    // Beta: any credentials are accepted.
    signIn(user);
    window.setTimeout(() => location.assign(nextUrl()), 420);
  });

  document.querySelector("[data-demo-login]")?.addEventListener("click", () => {
    signIn("jack");
    location.assign("/dashboard.html");
  });
}

function nextUrl(): string {
  const next = new URLSearchParams(location.search).get("next");
  // Only allow same-origin relative paths.
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard.html";
}

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
  document.querySelector("[data-signout]")?.addEventListener("click", () => signOut());
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
