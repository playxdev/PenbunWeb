/**
 * master/page.ts — the controller. One instance drives one master screen.
 *
 * The list state lives here and nowhere else: page, search text, sort key,
 * status, and the resource's own filters. Every one of them is a query
 * parameter on the API, not a filter over the rows already on screen — a
 * client-side search across 25 of 4,000 rows finds nothing and looks broken.
 *
 * State is mirrored into the URL, so a filtered list can be linked to,
 * bookmarked, and reloaded without losing its place.
 *
 * Requests are single-flight per screen: typing in the search box fires a new
 * list request every 300 ms and aborts the one before it, so the rows that
 * land are always the ones that match what is in the box.
 */

import { ApiError, CODE } from "../core/api.js";
import { esc } from "../core/format.js";
import { icon } from "../core/icons.js";
import { toast } from "../core/ui.js";
import type { Session } from "../core/auth.js";
import { deleteRow, forgetOptions, getRow, listRows, options, PAGE_SIZE, type ListQuery, type Row } from "./repo.js";
import { MASTER_BY_NAME } from "./resources.js";
import type { MasterResource } from "./schema.js";
import { writable } from "./schema.js";
import {
  demoState,
  emptyState,
  errorState,
  footSummary,
  pageShell,
  pagination,
  rowId,
  skeletonRows,
  tableBody,
  tableHead,
} from "./view.js";

interface State {
  page: number;
  q: string;
  sort: string | undefined;
  asc: boolean;
  isActive: boolean | undefined;
  filters: Record<string, string>;
}

const SEARCH_DEBOUNCE = 300;

/* ------------------------------------------------------------- URL state */

function readState(r: MasterResource): State {
  const p = new URLSearchParams(location.search);
  const filters: Record<string, string> = {};
  for (const f of r.filters ?? []) {
    const v = p.get(f.param);
    if (v) filters[f.param] = v;
  }
  const sortParam = p.get("sort") ?? "";
  const known = r.columns.some((c) => c.sort && c.sort === sortParam.replace(/^-/, ""));
  const active = p.get("active");

  return {
    page: Math.max(1, Number(p.get("page")) || 1),
    q: p.get("q") ?? "",
    sort: known ? sortParam.replace(/^-/, "") : r.defaultSort,
    asc: known ? !sortParam.startsWith("-") : (r.defaultAsc ?? false),
    isActive: active === "true" ? true : active === "false" ? false : undefined,
    filters,
  };
}

function writeState(r: MasterResource, s: State): void {
  const p = new URLSearchParams();
  if (s.page > 1) p.set("page", String(s.page));
  if (s.q) p.set("q", s.q);
  if (s.sort && (s.sort !== r.defaultSort || s.asc !== (r.defaultAsc ?? false))) {
    p.set("sort", s.asc ? s.sort : `-${s.sort}`);
  }
  if (s.isActive !== undefined) p.set("active", String(s.isActive));
  for (const [k, v] of Object.entries(s.filters)) if (v) p.set(k, v);
  const qs = p.toString();
  history.replaceState(null, "", qs ? `${location.pathname}?${qs}` : location.pathname);
}

const isFiltered = (s: State): boolean =>
  s.q !== "" || s.isActive !== undefined || Object.values(s.filters).some((v) => v !== "");

/* ------------------------------------------------------------- confirm */

/** A yes/no dialog. Destructive actions never happen on a single click. */
function confirmDelete(r: MasterResource, row: Row): Promise<boolean> {
  const id = rowId(r, row);
  const name = String(row[r.titleKey] ?? id);
  const host = document.createElement("div");
  host.className = "pb-modal";
  host.innerHTML = `<div class="pb-modal__panel" role="alertdialog" aria-modal="true"
      aria-labelledby="pb-del-title">
    <div class="pb-modal__head">
      <h2 class="pb-modal__title" id="pb-del-title">ลบ${esc(r.label)}</h2>
      <button class="pb-iconbtn pb-iconbtn--sm" type="button" data-close aria-label="ปิด">${icon("x")}</button>
    </div>
    <div class="pb-modal__body">
      <p>ลบ <strong>${esc(name)}</strong> <span class="pb-mono">${esc(id)}</span> ออกจากรายการ</p>
      <p class="pb-hint">ระบบเก็บแถวไว้และทำเครื่องหมายว่าลบแล้ว เอกสารเดิมที่อ้างถึงจึงยังอ่านได้
        แต่จะเลือกใช้ในเอกสารใหม่ไม่ได้อีก ถ้ายังมีข้อมูลอื่นอ้างอยู่ ระบบจะปฏิเสธการลบ</p>
    </div>
    <div class="pb-modal__foot">
      <button class="pb-btn pb-btn--secondary" type="button" data-close>ยกเลิก</button>
      <button class="pb-btn pb-btn--danger" type="button" data-confirm>ลบ${esc(r.label)}</button>
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

/* --------------------------------------------------------------- screen */

class MasterScreen {
  private readonly root: HTMLElement;
  private readonly state: State;
  private rows: Row[] = [];
  private inflight: AbortController | null = null;
  private searchTimer = 0;

  constructor(
    private readonly r: MasterResource,
    root: HTMLElement,
    private readonly demo: boolean
  ) {
    this.root = root;
    this.state = readState(r);
  }

  start(): void {
    this.root.innerHTML = pageShell(this.r);
    this.applyStateToControls();
    this.wire();
    void this.fillFilterOptions();

    if (this.demo) {
      this.table().innerHTML = demoState(this.r);
      this.foot();
      return;
    }
    void this.load();
  }

  /* ------------------------------------------------------------- helpers */

  private table(): HTMLElement {
    return this.root.querySelector<HTMLElement>("#pb-master-table")!;
  }

  private foot(shown = 0, total = 0, totalPages = 0): void {
    this.root.querySelector<HTMLElement>("#pb-master-count")!.textContent = footSummary(
      shown,
      total,
      this.r.label
    );
    this.root.querySelector<HTMLElement>("#pb-master-pager")!.innerHTML = pagination(
      this.state.page,
      totalPages
    );
  }

  private applyStateToControls(): void {
    const q = this.root.querySelector<HTMLInputElement>("#pb-master-q");
    if (q) q.value = this.state.q;
    const active = this.root.querySelector<HTMLSelectElement>("#pb-master-active");
    if (active) active.value = this.state.isActive === undefined ? "" : String(this.state.isActive);
    this.root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-filter]").forEach((el) => {
      el.value = this.state.filters[el.dataset.filter!] ?? "";
    });
  }

  /** Options for the filter bar come from the same cache the forms use. */
  private async fillFilterOptions(): Promise<void> {
    const selects = [...this.root.querySelectorAll<HTMLSelectElement>("select[data-filter][data-resource]")];
    await Promise.all(
      selects.map(async (sel) => {
        const name = sel.dataset.resource;
        if (!name) return;
        const current = this.state.filters[sel.dataset.filter!] ?? "";
        try {
          const list = await options(name);
          const target = MASTER_BY_NAME[name];
          sel.insertAdjacentHTML(
            "beforeend",
            list
              .map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`)
              .join("")
          );
          if (target && current && !list.some((o) => o.value === current)) {
            sel.insertAdjacentHTML("beforeend", `<option value="${esc(current)}">${esc(current)}</option>`);
          }
          sel.value = current;
        } catch {
          // A filter that cannot load its options stays a plain "ทุก…" —
          // the list itself is unaffected, so this is not worth an error.
        }
      })
    );

    this.root.querySelectorAll<HTMLInputElement>("input[data-filter][list]").forEach((input) => {
      const def = (this.r.filters ?? []).find((f) => f.param === input.dataset.filter);
      if (!def?.resource) return;
      const listEl = document.getElementById(input.getAttribute("list")!);
      if (!listEl) return;
      let timer = 0;
      const load = (term: string): void => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          void options(def.resource!, term)
            .then((found) => {
              listEl.innerHTML = found
                .map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`)
                .join("");
            })
            .catch(() => undefined);
        }, 250);
      };
      input.addEventListener("input", () => load(input.value.trim()));
      load("");
    });
  }

  /* ---------------------------------------------------------------- load */

  private async load(): Promise<void> {
    this.inflight?.abort();
    const ctrl = new AbortController();
    this.inflight = ctrl;

    writeState(this.r, this.state);
    this.table().innerHTML = `<table class="pb-table">${tableHead(
      this.r,
      this.state.sort,
      this.state.asc
    )}${skeletonRows(this.r)}</table>`;

    const query: ListQuery = {
      page: this.state.page,
      limit: PAGE_SIZE,
      q: this.state.q || undefined,
      sort: this.state.sort,
      asc: this.state.asc,
      isActive: this.state.isActive,
      filters: this.state.filters,
    };

    try {
      const res = await listRows(this.r, query, { signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      this.rows = res.items;

      if (res.items.length === 0) {
        this.table().innerHTML = emptyState(this.r, isFiltered(this.state));
        this.foot(0, res.total, 0);
        return;
      }
      this.table().innerHTML = `<table class="pb-table">${tableHead(
        this.r,
        this.state.sort,
        this.state.asc
      )}${tableBody(this.r, res.items)}</table>`;
      this.foot(res.items.length, res.total, res.total_pages);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      this.rows = [];
      const e = err instanceof ApiError ? err : null;
      // An expired session is api.ts's business; it has already refreshed or
      // cleared the tokens by the time the error reaches here.
      if (e?.code === CODE.FORBIDDEN) {
        this.table().innerHTML = errorState(`บัญชีนี้ไม่มีสิทธิ์ดู${this.r.label}`, e.traceId);
      } else {
        this.table().innerHTML = errorState(
          e?.message ?? "ติดต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง",
          e?.traceId ?? ""
        );
      }
      this.foot();
    } finally {
      if (this.inflight === ctrl) this.inflight = null;
    }
  }

  private reload(resetPage = true): void {
    if (resetPage) this.state.page = 1;
    if (this.demo) return;
    void this.load();
  }

  /* ---------------------------------------------------------------- wire */

  private wire(): void {
    const q = this.root.querySelector<HTMLInputElement>("#pb-master-q");
    q?.addEventListener("input", () => {
      window.clearTimeout(this.searchTimer);
      this.searchTimer = window.setTimeout(() => {
        this.state.q = q.value.trim();
        this.reload();
      }, SEARCH_DEBOUNCE);
    });

    this.root.querySelector<HTMLSelectElement>("#pb-master-active")?.addEventListener("change", (e) => {
      const v = (e.target as HTMLSelectElement).value;
      this.state.isActive = v === "" ? undefined : v === "true";
      this.reload();
    });

    this.root.querySelectorAll<HTMLElement>("[data-filter]").forEach((el) => {
      const commit = (): void => {
        this.state.filters[el.dataset.filter!] = (el as HTMLInputElement).value.trim();
        this.reload();
      };
      el.addEventListener("change", commit);
      if (el.tagName === "INPUT") {
        el.addEventListener("keydown", (e) => {
          if ((e as KeyboardEvent).key === "Enter") {
            e.preventDefault();
            commit();
          }
        });
      }
    });

    this.root.addEventListener("click", (e) => void this.onClick(e));
  }

  private async onClick(e: Event): Promise<void> {
    const target = e.target as HTMLElement;

    const th = target.closest<HTMLElement>("th[data-sortkey]");
    if (th) {
      const key = th.dataset.sortkey!;
      this.state.asc = this.state.sort === key ? !this.state.asc : true;
      this.state.sort = key;
      this.reload();
      return;
    }

    const pageBtn = target.closest<HTMLElement>(".pb-pagination button[data-page]");
    if (pageBtn) {
      const next = Number(pageBtn.dataset.page);
      if (Number.isFinite(next) && next >= 1) {
        this.state.page = next;
        void this.load();
        this.root.scrollIntoView({ block: "start", behavior: "smooth" });
      }
      return;
    }

    const act = target.closest<HTMLElement>("[data-act]");
    if (!act) return;

    switch (act.dataset.act) {
      case "retry":
        this.reload(false);
        return;
      case "clear":
        this.state.q = "";
        this.state.isActive = undefined;
        this.state.filters = {};
        this.applyStateToControls();
        this.reload();
        return;
      case "create":
        await this.create();
        return;
      case "edit":
        await this.edit(act.dataset.id ?? "");
        return;
      case "delete":
        await this.remove(act.dataset.id ?? "");
        return;
    }
  }

  /* --------------------------------------------------------------- write */

  private async create(): Promise<void> {
    if (!this.guardWrites()) return;
    const { openMasterForm } = await import("./form.js");
    const saved = await openMasterForm(this.r, "create");
    if (saved) this.reload();
  }

  private async edit(id: string): Promise<void> {
    if (!id || !this.guardWrites()) return;
    // The list row is one page of a wide table; the form needs every column,
    // so it is re-read by ID rather than reused from the list.
    let row = this.rows.find((r) => rowId(this.r, r) === id);
    try {
      row = await getRow(this.r, id);
    } catch (err) {
      if (!row) {
        toast(`เปิด${this.r.label}ไม่ได้`, err instanceof ApiError ? err.message : "", "neg");
        return;
      }
    }
    const { openMasterForm } = await import("./form.js");
    const saved = await openMasterForm(this.r, "edit", row);
    if (saved) this.reload(false);
  }

  private async remove(id: string): Promise<void> {
    if (!id || !this.guardWrites()) return;
    const row = this.rows.find((r) => rowId(this.r, r) === id);
    if (!row) return;
    if (!(await confirmDelete(this.r, row))) return;

    try {
      await deleteRow(this.r, id);
      forgetOptions(this.r.name);
      toast(`ลบ${this.r.label}เรียบร้อย`, String(row[this.r.titleKey] ?? id), "pos");
      // Deleting the last row of the last page would otherwise show an empty
      // page N with no way back.
      if (this.rows.length === 1 && this.state.page > 1) this.state.page -= 1;
      void this.load();
    } catch (err) {
      const e = err instanceof ApiError ? err : null;
      // REF_IN_USE is the database refusing to orphan rows that point here.
      toast(`ลบ${this.r.label}ไม่ได้`, e?.message ?? "กรุณาลองใหม่อีกครั้ง", "neg");
    }
  }

  private guardWrites(): boolean {
    if (this.demo) {
      toast("โหมดสาธิตแก้ไขข้อมูลไม่ได้", "เข้าสู่ระบบด้วยบัญชีจริงเพื่อบันทึกข้อมูล", "info");
      return false;
    }
    if (!writable(this.r)) return false;
    return true;
  }
}

/** Entry point called by main.ts once the shell is mounted. */
export function initMasterPage(r: MasterResource, user: Session): void {
  const root = document.getElementById("pb-page");
  if (!root) return;
  new MasterScreen(r, root, user.demo).start();
}
