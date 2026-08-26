/**
 * main.ts — entry point for every page that lives inside the app shell.
 *
 * Order matters: theme before paint work, session before the shell (an
 * expired session must never render a menu), page module last.
 *
 * The session check is deliberately two-stage. `requireSession()` reads
 * localStorage and is instant, so the shell paints without waiting on the
 * network; `validateSession()` then asks PenbunAPI whether that token is
 * still honoured and ends the session if it is not.
 */

import { initTheme } from "./core/theme.js";
import { requireSession, validateSession } from "./core/auth.js";
import { mountAppLayout } from "./layouts/app-layout.js";
import { initUI, toast } from "./core/ui.js";
import { WEB_VERSION } from "./core/version.js";

async function boot(): Promise<void> {
  initTheme();

  let user;
  try {
    user = requireSession();
  } catch {
    return; // requireSession already redirected to the sign-in page
  }

  // A user who has never changed their first password may not browse the app
  // — PenbunAPI answers MUST_CHANGE_PASSWORD on every route but /auth/*, so
  // the shell would render a menu where nothing works.
  if (user.mustChangePassword) {
    location.replace("/index.html?force=1");
    return;
  }

  mountAppLayout(user);
  initUI();

  const page = document.getElementById("pb-page")?.dataset.page;

  if (page === "dashboard") {
    const { initDashboard } = await import("./pages/dashboard.js");
    initDashboard();
  } else if (page === "settings") {
    const { initSettings } = await import("./pages/settings.js");
    void initSettings(user);
  } else if (page === "master") {
    const { initMasterHub } = await import("./master/hub.js");
    initMasterHub();
  } else {
    // Document screens are declared the same way, from docs/resources.ts —
    // one descriptor per spec in PenbunAPI's document engine.
    const { docForPage } = await import("./docs/resources.js");
    const doc = docForPage(page);
    if (doc) {
      const { initDocPage } = await import("./docs/page.js");
      await initDocPage(doc, user);
    } else {
      // Master screens are declared, not written: one descriptor in
      // master/resources.ts mirrors one PenbunAPI resource and produces the
      // whole list + form. Pages that are neither fall through and keep
      // whatever static markup they ship with.
      const { masterForPage } = await import("./master/resources.js");
      const resource = masterForPage(page);
      if (resource) {
        const { initMasterPage } = await import("./master/page.js");
        await initMasterPage(resource, user);
      }
    }
  }

  // Confirm the token is still good, after the screen is usable.
  void validateSession();

  // Beta banner, once per session.
  if (!sessionStorage.getItem("penbun.betaNotice")) {
    sessionStorage.setItem("penbun.betaNotice", "1");
    window.setTimeout(
      () =>
        toast(
          `PenbunWeb ${WEB_VERSION}`,
          user.demo
            ? "โหมดสาธิต ไม่ได้เชื่อมต่อ PenbunAPI"
            : "ข้อมูลพื้นฐานและใบรับสินค้าอ่านและบันทึกผ่าน PenbunAPI แล้ว เอกสารอีกสามชนิดและสต็อกยังเป็นตัวอย่าง",
          "info",
          6000
        ),
      900
    );
  }
}

document.addEventListener("DOMContentLoaded", () => void boot());
