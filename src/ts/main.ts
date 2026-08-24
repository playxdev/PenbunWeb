/**
 * main.ts — entry point for every page that lives inside the app shell.
 *
 * Order matters: theme before paint work, session before the shell (an
 * expired session must never render a menu), page module last.
 */

import { initTheme } from "./core/theme.js";
import { requireSession } from "./core/auth.js";
import { mountAppLayout } from "./layouts/app-layout.js";
import { initUI, toast } from "./core/ui.js";

async function boot(): Promise<void> {
  initTheme();

  let user;
  try {
    user = requireSession();
  } catch {
    return; // requireSession already redirected to the sign-in page
  }

  mountAppLayout(user);
  initUI();

  const page = document.getElementById("pb-page")?.dataset.page;

  if (page === "dashboard") {
    const { initDashboard } = await import("./pages/dashboard.js");
    initDashboard();
  }

  // Beta banner, once per session.
  if (!sessionStorage.getItem("penbun.betaNotice")) {
    sessionStorage.setItem("penbun.betaNotice", "1");
    window.setTimeout(
      () => toast("PenbunWeb beta 1.3.0", "หน้าจอทั้งหมดเป็นตัวอย่าง UI ข้อมูลยังไม่เชื่อมต่อ PenbunAPI", "info", 6000),
      900
    );
  }
}

document.addEventListener("DOMContentLoaded", () => void boot());
