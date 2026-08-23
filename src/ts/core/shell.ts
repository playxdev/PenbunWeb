/**
 * shell.ts — builds the sidebar and topbar around the page content.
 *
 * Every in-app page ships only its own markup inside
 * `<div id="pb-page" data-page="…">`. mountShell() wraps that node in the
 * shell at runtime, so the menu exists in exactly one place (nav.ts).
 */

import { NAV, NAV_INDEX, groupOf } from "./nav.js";
import { icon } from "./icons.js";
import { esc, timeAgo } from "./format.js";
import { signOut, type Session } from "./auth.js";
import { cycle, getChoice, resolve, setChoice, type ThemeChoice } from "./theme.js";

const SIDEBAR_KEY = "penbun.sidebar";

interface Notice {
  title: string;
  meta: string;
  kind: "brand" | "pos" | "neg";
  at: Date;
}

const NOTICES: Notice[] = [
  { title: "สต็อกต่ำกว่าจุดสั่งซื้อ 12 รายการ", meta: "คลัง DC-01", kind: "neg", at: new Date(Date.now() - 12 * 6e4) },
  { title: "ใบรับสินค้า RCV-2569-0182 ผ่านการตรวจรับ", meta: "สนพ. อมรินทร์", kind: "pos", at: new Date(Date.now() - 95 * 6e4) },
  { title: "สาย 3 ปิดยอดฝากขายรอบเดือน", meta: "ร้านค้า 18 แห่ง", kind: "brand", at: new Date(Date.now() - 5 * 36e5) },
];

function navMarkup(active: string): string {
  return NAV.map(
    (group) => `
    <div class="pb-nav__group">
      <div class="pb-nav__label">${esc(group.label)}</div>
      ${group.items
        .map((item) => {
          const current = item.id === active;
          const badge = item.count
            ? `<span class="pb-nav__count${item.alert ? " pb-nav__count--alert" : ""}">${item.count}</span>`
            : "";
          return `<a class="pb-nav__link" href="${item.href}"${current ? ' aria-current="page"' : ""} title="${esc(
            item.label
          )}">
            ${icon(item.icon, "pb-nav__icon")}
            <span class="pb-nav__text">${esc(item.label)}</span>${badge}
          </a>`;
        })
        .join("")}
    </div>`
  ).join("");
}

function themeIcon(): string {
  const c = getChoice();
  return c === "auto" ? icon("monitor") : resolve(c) === "dark" ? icon("moon") : icon("sun");
}

function sidebarMarkup(active: string, user: Session): string {
  return `
  <aside class="pb-sidebar" id="pb-sidebar">
    <a class="pb-brand" href="/dashboard.html">
      <span class="pb-brand__mark">P</span>
      <span class="pb-brand__text">
        <span class="pb-brand__name">Penbun</span>
        <span class="pb-brand__meta">WEB BETA 1.0.0</span>
      </span>
    </a>
    <nav class="pb-nav" aria-label="เมนูหลัก">${navMarkup(active)}</nav>
    <div class="pb-sidebar__foot">
      <div class="pb-dropdown">
        <button class="pb-userchip" data-dropdown-trigger aria-expanded="false" aria-haspopup="menu">
          <span class="pb-avatar pb-avatar--brand">${esc(user.initials)}</span>
          <span class="pb-userchip__text">
            <span class="pb-userchip__name">${esc(user.name)}</span>
            <span class="pb-userchip__role">${esc(user.role)}</span>
          </span>
        </button>
        <div class="pb-dropdown__menu pb-dropdown__menu--up pb-dropdown__menu--start" role="menu">
          <div class="pb-dropdown__head">
            <span class="pb-avatar pb-avatar--sm pb-avatar--brand">${esc(user.initials)}</span>
            <span>
              <span class="pb-dropdown__title">${esc(user.username)}</span>
              <div class="pb-userchip__role">${esc(user.branch)}</div>
            </span>
          </div>
          <div class="pb-dropdown__sep"></div>
          <a class="pb-dropdown__item" href="/profile.html" role="menuitem">${icon("user")}โปรไฟล์ของฉัน</a>
          <a class="pb-dropdown__item" href="/settings.html" role="menuitem">${icon("settings")}ตั้งค่าระบบ</a>
          <a class="pb-dropdown__item" href="/403.html" role="menuitem">${icon("shield")}สิทธิ์การใช้งาน</a>
          <div class="pb-dropdown__sep"></div>
          <button class="pb-dropdown__item pb-dropdown__item--danger" data-signout role="menuitem">${icon(
            "logout"
          )}ออกจากระบบ</button>
        </div>
      </div>
    </div>
  </aside>`;
}

function topbarMarkup(active: string): string {
  const item = NAV_INDEX[active];
  const group = groupOf(active);
  return `
  <header class="pb-topbar">
    <button class="pb-iconbtn" data-sidebar-toggle aria-label="ย่อ/ขยายเมนู" aria-controls="pb-sidebar" aria-expanded="false">${icon(
      "panel"
    )}</button>

    <div class="pb-breadcrumb" aria-label="ตำแหน่งปัจจุบัน">
      <a href="/dashboard.html">Penbun</a>
      ${group ? `<span class="pb-breadcrumb__sep">/</span><span>${esc(group)}</span>` : ""}
      ${item ? `<span class="pb-breadcrumb__sep">/</span><span>${esc(item.label)}</span>` : ""}
    </div>

    <div class="pb-topbar__spacer"></div>

    <div class="pb-search">
      <span class="pb-search__icon">${icon("search")}</span>
      <input class="pb-search__input" id="pb-search" type="search" placeholder="ค้นหาสินค้า เอกสาร ลูกค้า…"
        aria-label="ค้นหา" data-stub="การค้นหารวมจะเชื่อมกับ PenbunAPI ในรุ่นถัดไป">
      <span class="pb-search__kbd"><kbd class="pb-kbd">Ctrl</kbd><kbd class="pb-kbd">K</kbd></span>
    </div>

    <button class="pb-iconbtn" data-theme-toggle aria-label="สลับโหมดสีสว่าง/มืด" title="สลับโหมดสี">${themeIcon()}</button>

    <div class="pb-dropdown">
      <button class="pb-iconbtn pb-iconbtn--badge" data-dropdown-trigger aria-expanded="false" aria-label="การแจ้งเตือน">
        ${icon("bell")}<span class="pb-iconbtn__dot"></span>
      </button>
      <div class="pb-dropdown__menu pb-dropdown__menu--wide" role="menu">
        <div class="pb-dropdown__head">
          <span class="pb-dropdown__title">การแจ้งเตือน</span>
          <span class="pb-badge pb-badge--neg" style="margin-inline-start:auto">${NOTICES.length} ใหม่</span>
        </div>
        <div class="pb-dropdown__sep"></div>
        ${NOTICES.map(
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
      <div class="pb-dropdown__menu" role="menu">
        <a class="pb-dropdown__item" href="/profile.html" role="menuitem">${icon("user")}โปรไฟล์</a>
        <a class="pb-dropdown__item" href="/settings.html" role="menuitem">${icon("settings")}ตั้งค่า</a>
        <div class="pb-dropdown__sep"></div>
        <div style="padding:var(--pb-2) var(--pb-3)">
          <div class="pb-label" style="margin-bottom:6px">ธีม</div>
          <div class="pb-segment" role="group" aria-label="เลือกธีม">
            <button type="button" data-theme-value="light" aria-pressed="false">สว่าง</button>
            <button type="button" data-theme-value="dark" aria-pressed="false">มืด</button>
            <button type="button" data-theme-value="auto" aria-pressed="false">อัตโนมัติ</button>
          </div>
        </div>
        <div class="pb-dropdown__sep"></div>
        <button class="pb-dropdown__item pb-dropdown__item--danger" data-signout role="menuitem">${icon(
          "logout"
        )}ออกจากระบบ</button>
      </div>
    </div>
  </header>`;
}

function footerMarkup(): string {
  return `
  <footer class="pb-footer">
    <div class="pb-footer__inner">
      <span>© 2569 Penbun System</span>
      <span class="pb-footer__version">PenbunWeb beta 1.0.0</span>
    </div>
  </footer>`;
}

export function mountShell(user: Session): void {
  const page = document.getElementById("pb-page");
  if (!page) throw new Error("shell: #pb-page not found");
  const active = page.dataset.page ?? "";

  const shell = document.createElement("div");
  shell.className = "pb-shell";
  shell.id = "pb-shell";
  shell.dataset.sidebar = localStorage.getItem(SIDEBAR_KEY) === "collapsed" ? "collapsed" : "expanded";
  shell.innerHTML = `${sidebarMarkup(active, user)}<div class="pb-main">${topbarMarkup(
    active
  )}<main class="pb-content" id="pb-main"></main>${footerMarkup()}</div>`;

  const scrim = document.createElement("div");
  scrim.className = "pb-scrim";
  scrim.setAttribute("data-sidebar-close", "");

  document.body.prepend(scrim);
  document.body.prepend(shell);
  shell.querySelector("#pb-main")!.appendChild(page);

  const avatar = shell.querySelector("#pb-topbar-avatar");
  if (avatar) avatar.textContent = user.initials;

  wire(shell, scrim);
  document.title = `${NAV_INDEX[active]?.label ?? "Penbun"} · PenbunWeb`;
}

function wire(shell: HTMLElement, scrim: HTMLElement): void {
  const mq = window.matchMedia("(max-width: 992px)");
  const toggle = shell.querySelector<HTMLElement>("[data-sidebar-toggle]");

  const closeDrawer = (): void => {
    if (shell.dataset.sidebar !== "open") return;
    shell.dataset.sidebar = "expanded";
    scrim.classList.remove("is-open");
    document.body.style.overflow = "";
    toggle?.setAttribute("aria-expanded", "false");
  };

  const openDrawer = (): void => {
    shell.dataset.sidebar = "open";
    scrim.classList.add("is-open");
    document.body.style.overflow = "hidden";
    toggle?.setAttribute("aria-expanded", "true");
  };

  toggle?.addEventListener("click", () => {
    if (mq.matches) {
      if (shell.dataset.sidebar === "open") closeDrawer();
      else openDrawer();
      return;
    }
    const collapsed = shell.dataset.sidebar === "collapsed";
    shell.dataset.sidebar = collapsed ? "expanded" : "collapsed";
    localStorage.setItem(SIDEBAR_KEY, shell.dataset.sidebar);
  });

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

  document.querySelectorAll("[data-signout]").forEach((b) =>
    b.addEventListener("click", () => signOut())
  );

  document.querySelector("[data-theme-toggle]")?.addEventListener("click", (e) => {
    cycle();
    const btn = e.currentTarget as HTMLElement;
    btn.innerHTML = themeIcon();
  });

  document.querySelectorAll<HTMLElement>("[data-theme-value]").forEach((b) =>
    b.addEventListener("click", () => {
      setChoice(b.dataset.themeValue as ThemeChoice);
      const toggle = document.querySelector("[data-theme-toggle]");
      if (toggle) toggle.innerHTML = themeIcon();
    })
  );

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      document.getElementById("pb-search")?.focus();
    }
  });
}
