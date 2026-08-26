/**
 * ui.ts — small behaviours, all delegated from document.
 * Nothing here knows about a specific page.
 */

import { icon } from "./icons.js";
import { esc } from "./format.js";

/* ------------------------------------------------------------- dropdown */
export function initDropdowns(): void {
  document.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const trigger = t.closest<HTMLElement>("[data-dropdown-trigger]");
    const item = t.closest<HTMLElement>(".pb-dropdown__item");

    document.querySelectorAll<HTMLElement>(".pb-dropdown.is-open").forEach((d) => {
      // Clicking the open dropdown's own trigger is handled by the toggle below.
      if (trigger && d === trigger.closest(".pb-dropdown")) return;
      // Clicks inside the menu stay open (e.g. the status input); choosing a
      // menu item closes it.
      if (d.contains(t) && !(item && d.contains(item))) return;
      d.classList.remove("is-open");
      d.querySelector("[data-dropdown-trigger]")?.setAttribute("aria-expanded", "false");
    });

    if (trigger) {
      const parent = trigger.closest(".pb-dropdown");
      if (parent) {
        const isOpen = parent.classList.toggle("is-open");
        trigger.setAttribute("aria-expanded", String(isOpen));
      }
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    document.querySelectorAll(".pb-dropdown.is-open").forEach((d) => {
      d.classList.remove("is-open");
      d.querySelector("[data-dropdown-trigger]")?.setAttribute("aria-expanded", "false");
    });
  });
}

/* ---------------------------------------------------------------- toast */
type ToastKind = "info" | "pos" | "neg";

export function toast(title: string, message = "", kind: ToastKind = "info", ttl = 4000): void {
  let host = document.querySelector<HTMLElement>(".pb-toasts");
  if (!host) {
    host = document.createElement("div");
    host.className = "pb-toasts";
    host.setAttribute("role", "status");
    host.setAttribute("aria-live", "polite");
    document.body.appendChild(host);
  }

  const el = document.createElement("div");
  el.className = `pb-toast pb-toast--${kind}`;
  el.innerHTML = `
    <span class="pb-toast__bar"></span>
    <div style="flex:1 1 auto;min-width:0">
      <div class="pb-toast__title">${esc(title)}</div>
      ${message ? `<div class="pb-toast__msg">${esc(message)}</div>` : ""}
    </div>
    <button class="pb-iconbtn pb-iconbtn--sm" aria-label="ปิดการแจ้งเตือน">${icon("x")}</button>`;

  const close = () => {
    el.classList.add("is-leaving");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  };
  el.querySelector("button")!.addEventListener("click", close);
  host.appendChild(el);
  window.setTimeout(close, ttl);
}

/* ---------------------------------------------------------------- modal */
/**
 * A yes/no dialog. Destructive and irreversible actions never happen on a
 * single click.
 *
 * `bodyHtml` is markup because every caller has something specific to say —
 * which row, which stock movement, what cannot be undone — and saying it
 * plainly is the whole point of stopping the user here.
 */
export interface ConfirmOptions {
  title: string;
  bodyHtml: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
}

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  const host = document.createElement("div");
  host.className = "pb-modal";
  host.innerHTML = `<div class="pb-modal__panel" role="alertdialog" aria-modal="true"
      aria-labelledby="pb-confirm-title">
    <div class="pb-modal__head">
      <h2 class="pb-modal__title" id="pb-confirm-title">${esc(opts.title)}</h2>
      <button class="pb-iconbtn pb-iconbtn--sm" type="button" data-close aria-label="ปิด">${icon("x")}</button>
    </div>
    <div class="pb-modal__body">${opts.bodyHtml}</div>
    <div class="pb-modal__foot">
      <button class="pb-btn pb-btn--secondary" type="button" data-close>${esc(
        opts.cancelLabel ?? "ยกเลิก"
      )}</button>
      <button class="pb-btn ${opts.danger ? "pb-btn--danger" : "pb-btn--primary"}" type="button"
              data-confirm>${esc(opts.confirmLabel)}</button>
    </div>
  </div>`;

  document.body.appendChild(host);
  requestAnimationFrame(() => {
    host.classList.add("is-open");
    host.querySelector<HTMLElement>("[data-confirm]")?.focus();
  });

  return new Promise<boolean>((resolve) => {
    const close = (ok: boolean): void => {
      document.removeEventListener("keydown", onKey);
      host.remove();
      resolve(ok);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") close(false);
    };
    document.addEventListener("keydown", onKey);
    host.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => close(false)));
    host.querySelector("[data-confirm]")!.addEventListener("click", () => close(true));
    host.addEventListener("click", (e) => {
      if (e.target === host) close(false);
    });
  });
}

export function initModals(): void {
  document.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const openBtn = t.closest<HTMLElement>("[data-modal-open]");
    if (openBtn) {
      document.getElementById(openBtn.dataset.modalOpen!)?.classList.add("is-open");
      return;
    }
    if (t.closest("[data-modal-close]") || t.classList.contains("pb-modal")) {
      t.closest(".pb-modal")?.classList.remove("is-open");
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.querySelectorAll(".pb-modal.is-open").forEach((m) => m.classList.remove("is-open"));
  });
}

/* ----------------------------------------------------------------- tabs */
export function initTabs(): void {
  document.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>(".pb-tabs button");
    if (!btn) return;
    const group = btn.closest(".pb-tabs")!;
    group.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", "false"));
    btn.setAttribute("aria-selected", "true");

    const panelId = btn.getAttribute("aria-controls");
    if (!panelId) return;
    const scope = group.parentElement ?? document;
    scope.querySelectorAll<HTMLElement>("[role='tabpanel']").forEach((p) => p.classList.add("pb-hide"));
    document.getElementById(panelId)?.classList.remove("pb-hide");
  });
}

/* ------------------------------------------------- segmented + pressed  */
export function initSegments(): void {
  document.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>(".pb-segment button");
    if (!btn) return;
    btn.closest(".pb-segment")!.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false"));
    btn.setAttribute("aria-pressed", "true");
    btn.dispatchEvent(new CustomEvent("penbun:segment", { bubbles: true, detail: btn.dataset.value }));
  });
}

/* ----------------------------------------------------- sortable tables  */
/**
 * Cell text → number for data-num columns.
 * Normalises the typographic minus (U+2212) used by format.ts/money output
 * and strips separators/currency; returns null when the cell has no number.
 */
export function numericCellValue(text: string): number | null {
  const cleaned = text.replace(/\u2212/g, "-").replace(/[^\d.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function initTableSort(): void {
  document.addEventListener("click", (e) => {
    const th = (e.target as HTMLElement).closest<HTMLTableCellElement>("th[data-sort]");
    if (!th) return;

    const table = th.closest("table")!;
    const tbody = table.tBodies[0];
    const index = Array.from(th.parentElement!.children).indexOf(th);
    const dir = th.getAttribute("aria-sort") === "ascending" ? "descending" : "ascending";
    const numeric = th.hasAttribute("data-num");

    th.parentElement!.querySelectorAll("th").forEach((h) => h.setAttribute("aria-sort", "none"));
    th.setAttribute("aria-sort", dir);

    const rows = Array.from(tbody.rows);
    const value = (r: HTMLTableRowElement): string => r.cells[index]?.textContent?.trim() ?? "";
    const sign = dir === "ascending" ? 1 : -1;
    rows.sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (!numeric) return sign * av.localeCompare(bv, "th");
      const an = numericCellValue(av);
      const bn = numericCellValue(bv);
      // Cells without numbers go last in both directions and keep their order.
      if (an === null || bn === null) {
        if (an === bn) return 0;
        return an === null ? 1 : -1;
      }
      return sign * (an - bn);
    });
    rows.forEach((r) => tbody.appendChild(r));
  });
}

/* --------------------------------------------- client-side table filter */
export function initTableFilter(): void {
  document.addEventListener("input", (e) => {
    const input = e.target as HTMLInputElement;
    if (!input.matches("[data-table-filter]")) return;
    const table = document.querySelector<HTMLTableElement>(input.dataset.tableFilter!);
    if (!table) return;
    const q = input.value.trim().toLowerCase();
    Array.from(table.tBodies[0].rows).forEach((row) => {
      row.classList.toggle("pb-hide", q !== "" && !row.textContent!.toLowerCase().includes(q));
    });
  });
}

/** Anything not wired yet says so, instead of failing silently. */
export function initStubActions(): void {
  document.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-stub]");
    if (!el) return;
    e.preventDefault();
    toast("ยังไม่เปิดใช้ในรุ่นเบต้า", el.dataset.stub || "ส่วนนี้เป็นตัวอย่างหน้าตาเท่านั้น", "info");
  });
}

export function initUI(): void {
  initDropdowns();
  initModals();
  initTabs();
  initSegments();
  initTableSort();
  initTableFilter();
  initStubActions();
}
