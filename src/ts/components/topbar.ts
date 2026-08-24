/**
 * topbar.ts — the horizontal top bar: hamburger, top menu, global search,
 * theme toggle, notification bell and the user profile dropdown.
 *
 * Markup only knows the components below it (theme-toggle); behaviour that
 * belongs to the bar itself (sign-out, Ctrl/⌘+K) is wired by wireTopbar().
 */

import { esc, timeAgo } from "../core/format.js";
import { icon } from "../core/icons.js";
import { signOut, type Session } from "../core/auth.js";
import { notices } from "../data/mock.js";
import { themeToggleMarkup } from "./theme-toggle.js";

export function topbarMarkup(user: Session): string {
  return `
  <header class="pb-topbar">
    <button class="pb-iconbtn" data-sidebar-toggle aria-label="เปิดเมนู" aria-controls="pb-sidebar" aria-expanded="false">${icon(
      "menu"
    )}</button>

    <nav class="pb-topnav" aria-label="เมนูแนวนอน">
      <a class="pb-topnav__item" href="/dashboard.html">${icon("home")}<span>หน้าแรก</span></a>
      <a class="pb-topnav__item" href="#" data-stub="แอปพลิเคชัน">${icon("apps")}<span>แอป</span></a>
      <a class="pb-topnav__item" href="#" data-stub="หน้า">${icon("file")}<span>หน้า</span></a>
      <a class="pb-topnav__item" href="#" data-stub="โมดูล">${icon("boxes")}<span>โมดูล</span></a>
      <a class="pb-topnav__item" href="#" data-stub="คู่มือการใช้งาน">${icon("book")}<span>คู่มือ</span></a>
    </nav>

    <div class="pb-topbar__spacer"></div>

    <div class="pb-search">
      <span class="pb-search__icon">${icon("search")}</span>
      <input class="pb-search__input" id="pb-search" type="search" placeholder="ค้นหาสินค้า เอกสาร ลูกค้า…"
        aria-label="ค้นหา" data-stub="การค้นหารวมจะเชื่อมกับ PenbunAPI ในรุ่นถัดไป">
      <span class="pb-search__kbd"><kbd class="pb-kbd">Ctrl</kbd><kbd class="pb-kbd">K</kbd></span>
    </div>

    ${themeToggleMarkup()}

    <div class="pb-dropdown">
      <button class="pb-iconbtn pb-iconbtn--badge" data-dropdown-trigger aria-expanded="false" aria-label="การแจ้งเตือน">
        ${icon("bell")}<span class="pb-iconbtn__dot"></span>
      </button>
      <div class="pb-dropdown__menu pb-dropdown__menu--wide" role="menu">
        <div class="pb-dropdown__head">
          <span class="pb-dropdown__title">การแจ้งเตือน</span>
          <span class="pb-badge pb-badge--neg" style="margin-inline-start:auto">${notices.length} ใหม่</span>
        </div>
        <div class="pb-dropdown__sep"></div>
        ${notices.map(
          (n) => `
          <a class="pb-dropdown__item" href="#" data-stub="ศูนย์การแจ้งเตือน" role="menuitem">
            <span class="pb-timeline__dot pb-timeline__dot--${n.kind}">${icon(
            n.kind === "neg" ? "alert" : n.kind === "pos" ? "check" : "truck"
          )}</span>
            <span style="min-width:0">
              <span style="display:block;color:var(--pb-text);font-weight:600">${esc(n.title)}</span>
              <span class="pb-userchip__role">${esc(n.meta)} · ${timeAgo(n.at)}</span>
            </span>
          </a>`
        ).join("")}
        <div class="pb-dropdown__sep"></div>
        <a class="pb-dropdown__item" href="#" data-stub="ศูนย์การแจ้งเตือน" role="menuitem">${icon(
          "inbox"
        )}ดูทั้งหมด</a>
      </div>
    </div>

    <div class="pb-dropdown">
      <button class="pb-iconbtn" data-dropdown-trigger aria-expanded="false" aria-label="บัญชีผู้ใช้"
        style="width:auto;padding:0 4px">
        <span class="pb-avatar pb-avatar--sm pb-avatar--brand" id="pb-topbar-avatar"></span>
      </button>
      <div class="pb-dropdown__menu pb-dropdown__menu--user" role="menu">
        <div class="pb-dropdown__head">
          <span class="pb-avatar pb-avatar--brand">${esc(user.initials)}</span>
          <span style="min-width:0">
            <span class="pb-dropdown__title">${esc(user.name)}</span>
            <div class="pb-userchip__role">${esc(user.role)}</div>
          </span>
        </div>
        <div class="pb-dropdown__status">
          <label class="pb-label" for="pb-status-input">อัปเดตสถานะของคุณ</label>
          <input class="pb-input" id="pb-status-input" type="text" placeholder="คุณกำลังทำอะไรอยู่?">
        </div>
        <div class="pb-dropdown__sep"></div>
        <a class="pb-dropdown__item" href="/profile.html" role="menuitem">${icon("user")}โปรไฟล์ของฉัน</a>
        <a class="pb-dropdown__item" href="/dashboard.html" role="menuitem">${icon("dashboard")}แดชบอร์ด</a>
        <a class="pb-dropdown__item" href="#" data-stub="โพสต์และกิจกรรม" role="menuitem">${icon("history")}โพสต์และกิจกรรม</a>
        <a class="pb-dropdown__item" href="/settings.html" role="menuitem">${icon("settings")}ตั้งค่าและความเป็นส่วนตัว</a>
        <a class="pb-dropdown__item" href="#" data-stub="ศูนย์ช่วยเหลือ" role="menuitem">${icon("help")}ศูนย์ช่วยเหลือ</a>
        <div class="pb-dropdown__sep"></div>
        <button class="pb-dropdown__item pb-dropdown__item--danger" data-signout role="menuitem">${icon(
          "logout"
        )}ออกจากระบบ</button>
      </div>
    </div>
  </header>`;
}

/** Behaviour owned by the bar itself. Called once after the layout mounts. */
export function wireTopbar(scope: ParentNode = document): void {
  scope.querySelectorAll("[data-signout]").forEach((b) => b.addEventListener("click", () => signOut()));

  // Global search shortcut.
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      document.getElementById("pb-search")?.focus();
    }
  });
}
