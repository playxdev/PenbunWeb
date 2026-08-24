/**
 * app-layout.ts — the master layout wrapper for every page inside the shell.
 *
 * A page ships only its own content:
 *
 *     <div id="pb-page" data-page="…"> … </div>
 *
 * mountAppLayout() composes the chrome around it at runtime:
 *
 *     main.ts ─► mountAppLayout(user)
 *                 ├─ components/sidebar.ts   (left rail + collapse/drawer)
 *                 ├─ components/topbar.ts    (menu · search · bell · account)
 *                 ├─ <main id="pb-main">  ◄── #pb-page slot
 *                 └─ components/footer.ts
 *
 * Changing any component file updates every page automatically — no page
 * carries layout markup of its own.
 */

import { NAV_INDEX } from "../core/nav.js";
import type { Session } from "../core/auth.js";
import { wireThemeControls } from "../components/theme-toggle.js";
import { initialSidebarCollapsed, sidebarMarkup, wireSidebar } from "../components/sidebar.js";
import { topbarMarkup, wireTopbar } from "../components/topbar.js";
import { footerMarkup } from "../components/footer.js";

export function mountAppLayout(user: Session): HTMLElement {
  const page = document.getElementById("pb-page");
  if (!page) throw new Error("app-layout: #pb-page not found");
  const active = page.dataset.page ?? "";

  const shell = document.createElement("div");
  shell.className = "pb-shell";
  shell.id = "pb-shell";
  shell.dataset.sidebar = initialSidebarCollapsed() ? "collapsed" : "expanded";
  shell.innerHTML = `${sidebarMarkup(active)}<div class="pb-main">${topbarMarkup(
    user
  )}<main class="pb-content" id="pb-main"></main>${footerMarkup()}</div>`;

  const scrim = document.createElement("div");
  scrim.className = "pb-scrim";
  scrim.setAttribute("data-sidebar-close", "");

  document.body.prepend(scrim);
  document.body.prepend(shell);
  shell.querySelector("#pb-main")!.appendChild(page);

  const avatar = shell.querySelector("#pb-topbar-avatar");
  if (avatar) avatar.textContent = user.initials;

  wireSidebar(shell, scrim);
  wireTopbar(shell);
  wireThemeControls(document);

  document.title = `${NAV_INDEX[active]?.label ?? "Penbun"} · PenbunWeb`;
  return shell;
}
