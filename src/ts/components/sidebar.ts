/**
 * sidebar.ts — the left navigation rail.
 *
 * Owns two things:
 *  1. markup: brand + menu + collapse button (composed from brand/nav-menu)
 *  2. behaviour: desktop collapse (persisted) and mobile drawer, including
 *     scrim taps, Esc, and leaving the mobile breakpoint.
 */

import { icon } from "../core/icons.js";
import { brandMarkup } from "./brand.js";
import { navMenuMarkup } from "./nav-menu.js";

export const SIDEBAR_KEY = "penbun.sidebar";

export function sidebarMarkup(active: string): string {
  return `
  <aside class="pb-sidebar" id="pb-sidebar">
    ${brandMarkup()}
    <nav class="pb-nav" aria-label="เมนูหลัก">${navMenuMarkup(active)}</nav>
    <div class="pb-sidebar__foot">
      <button class="pb-collapsebtn" data-sidebar-collapse aria-expanded="false" aria-controls="pb-sidebar">
        ${icon("panel")}
        <span class="pb-collapsebtn__text">ย่อเมนู</span>
      </button>
    </div>
  </aside>`;
}

export function initialSidebarCollapsed(): boolean {
  return localStorage.getItem(SIDEBAR_KEY) === "collapsed";
}

/**
 * Attach drawer/collapse behaviour. The hamburger toggle lives in the topbar
 * and the scrim in the layout, so both are passed in via `shell`/`scrim`.
 */
export function wireSidebar(shell: HTMLElement, scrim: HTMLElement): void {
  const mq = window.matchMedia("(max-width: 992px)");
  const toggle = shell.querySelector<HTMLElement>("[data-sidebar-toggle]");
  const collapse = shell.querySelector<HTMLElement>("[data-sidebar-collapse]");

  const setCollapsed = (collapsed: boolean): void => {
    shell.dataset.sidebar = collapsed ? "collapsed" : "expanded";
    localStorage.setItem(SIDEBAR_KEY, shell.dataset.sidebar);
    collapse?.setAttribute("aria-expanded", String(collapsed));
  };
  setCollapsed(shell.dataset.sidebar === "collapsed");

  const closeDrawer = (): void => {
    if (shell.dataset.drawer !== "open") return;
    delete shell.dataset.drawer;
    scrim.classList.remove("is-open");
    document.body.style.overflow = "";
    toggle?.setAttribute("aria-expanded", "false");
  };

  const openDrawer = (): void => {
    shell.dataset.drawer = "open";
    scrim.classList.add("is-open");
    document.body.style.overflow = "hidden";
    toggle?.setAttribute("aria-expanded", "true");
  };

  toggle?.addEventListener("click", () => {
    if (mq.matches) {
      if (shell.dataset.drawer === "open") closeDrawer();
      else openDrawer();
      return;
    }
    setCollapsed(shell.dataset.sidebar !== "collapsed");
  });

  collapse?.addEventListener("click", () => setCollapsed(shell.dataset.sidebar !== "collapsed"));

  scrim.addEventListener("click", closeDrawer);

  // Tapping a menu item on a phone should navigate, not leave the drawer open.
  shell.querySelectorAll(".pb-nav__link").forEach((a) => a.addEventListener("click", closeDrawer));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });

  // Back on a wide screen the drawer state is meaningless — drop it.
  mq.addEventListener("change", (e) => {
    if (!e.matches) closeDrawer();
  });
}
