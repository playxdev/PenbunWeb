/**
 * docs/page.ts — the controller behind a document screen.
 *
 * One URL serves two views. `?id=RCV0000123` opens that document, `?new=1`
 * opens an empty one, and anything else is the list. The state lives in the
 * query string so a filtered list and an open document are both linkable and
 * both survive a reload — the same contract `master/page.ts` keeps.
 *
 * The order of operations when saving a draft is the part worth stating,
 * because the API splits what feels like one action into two calls:
 *
 *   header   PUT /{doc}/{id}          only the fields that changed. An empty
 *                                     body is answered "ไม่มีข้อมูลที่ต้องแก้ไข",
 *                                     and a noUpdate field is rejected rather
 *                                     than ignored, so those never get sent.
 *   items    PUT /{doc}/{id}/items    the whole list, always. There is no
 *                                     endpoint for one line: the totals have
 *                                     to be recalculated anyway, and sending
 *                                     the whole set makes a retry harmless.
 *
 * Every write answers with the document as the database now sees it, so the
 * editor is re-rendered from the response rather than from what was typed.
 * That is how `total_qty` and `total_amount` reach the screen — this file
 * never adds anything up for real, only previews a line while it is being
 * typed.
 */

import { ApiError, CODE } from "../core/api.js";
import { clearErrors, collectValues, showFieldError, type Row } from "../core/fields.js";
import { esc, money } from "../core/format.js";
import { errorState, footSummary, pagination, skeletonBody, demoState } from "../core/table.js";
import { confirmDialog, toast } from "../core/ui.js";
import { loadEnums } from "../core/enums.js";
import type { Session } from "../core/auth.js";
import { fillRefSelects, wireRefSearch } from "../master/form.js";
import { getRow, options } from "../master/repo.js";
import { MASTER_BY_NAME } from "../master/resources.js";
import {
  cancelDoc,
  confirmDoc,
  createDoc,
  deleteDoc,
  getDoc,
  listDocs,
  PAGE_SIZE,
  postDoc,
  replaceDocItems,
  updateDocHeader,
  type DocDetail,
  type DocQuery,
} from "./repo.js";
import { actions, type DocSpec } from "./schema.js";
import { docId, docStatus, editorShell, listBody, listEmpty, listHead, listShell } from "./view.js";

/* ----------------------------------------------------------------- state */

interface ListState {
  page: number;
  docNo: string;
  status: string;
  from: string;
  to: string;
  filters: Record<string, string>;
}

function readListState(s: DocSpec): ListState {
  const p = new URLSearchParams(location.search);
  const filters: Record<string, string> = {};
  for (const f of s.filters ?? []) {
    const v = p.get(f.param) ?? "";
    if (v) filters[f.param] = v;
  }
  const page = Number(p.get("page") ?? "1");
  return {
    page: Number.isFinite(page) && page > 0 ? Math.trunc(page) : 1,
    docNo: p.get("doc_no") ?? "",
    status: p.get("status") ?? "",
    from: p.get("from") ?? "",
    to: p.get("to") ?? "",
    filters,
  };
}

function writeListState(st: ListState): void {
  const p = new URLSearchParams();
  if (st.page > 1) p.set("page", String(st.page));
  if (st.docNo) p.set("doc_no", st.docNo);
  if (st.status) p.set("status", st.status);
  if (st.from) p.set("from", st.from);
  if (st.to) p.set("to", st.to);
  for (const [k, v] of Object.entries(st.filters)) if (v) p.set(k, v);
  const qs = p.toString();
  history.replaceState(null, "", qs ? `${location.pathname}?${qs}` : location.pathname);
}

const isFiltered = (st: ListState): boolean =>
  st.docNo !== "" ||
  st.status !== "" ||
  st.from !== "" ||
  st.to !== "" ||
  Object.values(st.filters).some((v) => v !== "");

const today = (): string => new Date().toISOString().slice(0, 10);

/* ---------------------------------------------------------------- errors */

/**
 * Turn an ApiError into something the operator can act on.
 *
 * The two posting conflicts are the ones that matter. Neither is a bug and
 * both have a different next step, so neither may be flattened into
 * "บันทึกไม่สำเร็จ" — and INSUFFICIENT_STOCK carries a promise worth
 * repeating: the posting procedure runs inside one transaction, so a refusal
 * means nothing moved.
 */
function actionMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  switch (err.code) {
    case CODE.INSUFFICIENT_STOCK:
      return `${err.message} — ระบบไม่ได้ตัดสต็อกใด ๆ เอกสารยังอยู่สถานะเดิม แก้จำนวนหรือเลือกคลังอื่นแล้วลองใหม่`;
    case CODE.ALREADY_POSTED:
      return `${err.message} — กรุณากดรีเฟรชเพื่อดูสถานะล่าสุด`;
    case CODE.REF_IN_USE:
      return err.message;
    default:
      return err.message || fallback;
  }
}

/* ---------------------------------------------------------------- screen */

class DocScreen {
  private list: ListState;
  private inflight: AbortController | null = null;
  /**
   * Listeners for whichever view is on screen.
   *
   * The list and the editor both delegate from `#pb-page`, which survives a
   * re-render — so without a scope every save would add another click
   * handler, and the third save would fire three requests. Aborting the
   * signal detaches the previous view's listeners in one call.
   */
  private viewScope: AbortController | null = null;
  private searchTimer = 0;
  /** The document as the server last described it. */
  private detail: DocDetail | null = null;
  private creating = false;
  /** Set once the user edits trade_type by hand, so the vendor stops filling it. */
  private tradeTypeTouched = false;

  constructor(
    private readonly s: DocSpec,
    private readonly root: HTMLElement,
    private readonly demo: boolean
  ) {
    this.list = readListState(s);
  }

  /** Drop the previous view's listeners and open a scope for the new one. */
  private newViewScope(): AbortSignal {
    this.viewScope?.abort();
    this.viewScope = new AbortController();
    return this.viewScope.signal;
  }

  start(): void {
    if (this.demo) {
      this.root.innerHTML = demoState(this.s.label, this.s.icon);
      return;
    }
    const p = new URLSearchParams(location.search);
    const id = p.get("id");
    if (p.get("new") === "1") void this.openEditor(null);
    else if (id) void this.openEditor(id);
    else this.showList();
  }

  /* -------------------------------------------------------------- list */

  private showList(): void {
    this.detail = null;
    this.root.innerHTML = listShell(this.s);
    const signal = this.newViewScope();
    this.applyListControls();
    this.wireList(signal);
    void this.fillFilterOptions(signal);
    void this.loadList();
  }

  private table(): HTMLElement {
    return this.root.querySelector<HTMLElement>("#pb-doc-table")!;
  }

  private applyListControls(): void {
    const set = (sel: string, value: string): void => {
      const el = this.root.querySelector<HTMLInputElement | HTMLSelectElement>(sel);
      if (el) el.value = value;
    };
    set("#pb-doc-q", this.list.docNo);
    set("#pb-doc-status", this.list.status);
    set("#pb-doc-from", this.list.from);
    set("#pb-doc-to", this.list.to);
    this.root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-filter]").forEach((el) => {
      el.value = this.list.filters[el.dataset.filter!] ?? "";
    });
  }

  /** Filter controls that draw on a master resource share its option cache. */
  private async fillFilterOptions(signal: AbortSignal): Promise<void> {
    const inputs = [...this.root.querySelectorAll<HTMLInputElement>("input[data-filter][data-resource]")];
    for (const input of inputs) {
      const name = input.dataset.resource;
      if (!name) continue;
      const list = this.root.querySelector<HTMLDataListElement>(
        `#pb-docfilter-list-${input.dataset.filter}`
      );
      if (!list) continue;
      let timer = 0;
      const load = (term: string): void => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          void options(name, term)
            .then((found) => {
              list.innerHTML = found
                .map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`)
                .join("");
            })
            .catch(() => undefined);
        }, 250);
      };
      input.addEventListener("input", () => load(input.value.trim()), { signal });
      load("");
    }
  }

  private wireList(signal: AbortSignal): void {
    const root = this.root;

    root.querySelector<HTMLInputElement>("#pb-doc-q")?.addEventListener(
      "input",
      (e) => {
        const value = (e.target as HTMLInputElement).value.trim();
        window.clearTimeout(this.searchTimer);
        this.searchTimer = window.setTimeout(() => {
          this.list.docNo = value;
          this.list.page = 1;
          void this.loadList();
        }, 300);
      },
      { signal }
    );

    const onChange = (sel: string, apply: (v: string) => void): void => {
      root.querySelector<HTMLInputElement | HTMLSelectElement>(sel)?.addEventListener(
        "change",
        (e) => {
          apply((e.target as HTMLInputElement).value);
          this.list.page = 1;
          void this.loadList();
        },
        { signal }
      );
    };
    onChange("#pb-doc-status", (v) => (this.list.status = v));
    onChange("#pb-doc-from", (v) => (this.list.from = v));
    onChange("#pb-doc-to", (v) => (this.list.to = v));

    root.querySelectorAll<HTMLElement>("[data-filter]").forEach((el) => {
      const event = el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(
        event,
        () => {
          window.clearTimeout(this.searchTimer);
          this.searchTimer = window.setTimeout(
            () => {
              this.list.filters[el.dataset.filter!] = (el as HTMLInputElement).value.trim();
              this.list.page = 1;
              void this.loadList();
            },
            event === "input" ? 300 : 0
          );
        },
        { signal }
      );
    });

    root.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;

      // Scoped to the pagination bar on purpose. The app shell puts
      // data-page on #pb-page itself to name the screen, so a bare
      // [data-page] matches every click anywhere on the page — which
      // swallowed the create button and every row, and re-ran the list with
      // page=NaN instead.
      const pager = t.closest<HTMLElement>(".pb-pagination button[data-page]");
      if (pager && !pager.hasAttribute("disabled")) {
        const to = Number(pager.dataset.page);
        if (Number.isFinite(to) && to > 0) {
          this.list.page = to;
          void this.loadList();
        }
        return;
      }

      const act = t.closest<HTMLElement>("[data-act]")?.dataset.act;
      if (act === "create") {
        void this.openEditor(null);
        return;
      }
      if (act === "retry") {
        void this.loadList();
        return;
      }
      if (act === "clear") {
        this.list = { page: 1, docNo: "", status: "", from: "", to: "", filters: {} };
        this.applyListControls();
        void this.loadList();
        return;
      }

      const row = t.closest<HTMLElement>("tr[data-id]");
      if (row) void this.openEditor(row.dataset.id!);
    }, { signal });

    root.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const row = (e.target as HTMLElement).closest<HTMLElement>("tr[data-id]");
      if (!row) return;
      e.preventDefault();
      void this.openEditor(row.dataset.id!);
    }, { signal });
  }

  private async loadList(): Promise<void> {
    writeListState(this.list);
    this.inflight?.abort();
    const ctrl = new AbortController();
    this.inflight = ctrl;

    this.table().innerHTML = `<table class="pb-table">${listHead(this.s)}${skeletonBody(
      this.s.columns.length + 1
    )}</table>`;

    const q: DocQuery = {
      page: this.list.page,
      limit: PAGE_SIZE,
      status: this.list.status,
      docNo: this.list.docNo,
      dateFrom: this.list.from,
      dateTo: this.list.to,
      filters: this.list.filters,
    };

    try {
      const res = await listDocs(this.s, q, { signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      this.table().innerHTML =
        res.items.length === 0
          ? listEmpty(this.s, isFiltered(this.list))
          : `<table class="pb-table">${listHead(this.s)}${listBody(this.s, res.items)}</table>`;
      this.foot(res.items.length, res.total, res.total_pages);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const e = err instanceof ApiError ? err : null;
      this.table().innerHTML = errorState(
        e?.message ?? "ติดต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง",
        e?.traceId ?? ""
      );
      this.foot();
    }
  }

  private foot(shown = 0, total = 0, totalPages = 0): void {
    const count = this.root.querySelector<HTMLElement>("#pb-doc-count");
    const pager = this.root.querySelector<HTMLElement>("#pb-doc-pager");
    if (count) count.textContent = footSummary(shown, total, this.s.label);
    if (pager) pager.innerHTML = pagination(this.list.page, totalPages);
  }

  /* ------------------------------------------------------------ editor */

  private async openEditor(id: string | null): Promise<void> {
    this.creating = id === null;
    this.tradeTypeTouched = false;

    history.replaceState(null, "", id ? `${location.pathname}?id=${encodeURIComponent(id)}` : `${location.pathname}?new=1`);

    if (this.creating) {
      this.detail = { header: { doc_date: today() }, items: [] };
      this.renderEditor();
      return;
    }

    this.root.innerHTML = `<div class="pb-card"><div class="pb-card__body">${skeletonBody(1, 4)}</div></div>`;
    try {
      this.detail = await getDoc(this.s, id!);
      this.renderEditor();
    } catch (err) {
      const e = err instanceof ApiError ? err : null;
      this.root.innerHTML = errorState(e?.message ?? `เปิด${this.s.label}ไม่สำเร็จ`, e?.traceId ?? "");
      const signal = this.newViewScope();
      this.root
        .querySelector("[data-act='retry']")
        ?.addEventListener("click", () => void this.openEditor(id), { signal });
    }
  }

  private renderEditor(): void {
    const d = this.detail!;
    this.root.innerHTML = editorShell(this.s, {
      header: d.header,
      items: d.items,
      creating: this.creating,
    });

    const signal = this.newViewScope();
    void fillRefSelects(this.root);
    wireRefSearch(this.root);
    this.wireEditor(signal);
    this.refreshLineAmounts();
  }

  private headerEl(): HTMLElement {
    return this.root.querySelector<HTMLElement>("#pb-doc-header")!;
  }

  private formError(message: string): void {
    const el = this.root.querySelector<HTMLElement>("[data-form-error]");
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("pb-hide", message === "");
  }

  private wireEditor(signal: AbortSignal): void {
    const root = this.root;

    root.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
      if (!btn) return;
      switch (btn.dataset.act) {
        case "back":
          this.backToList();
          break;
        case "line-add":
          this.addLine();
          break;
        case "line-remove":
          this.removeLine(btn.closest("tr[data-line]"));
          break;
        case "save":
          void this.save();
          break;
        case "confirm":
          void this.transition("confirm");
          break;
        case "post":
          void this.postWithConfirmation();
          break;
        case "cancel":
          void this.cancelWithConfirmation();
          break;
        case "delete":
          void this.deleteWithConfirmation();
          break;
      }
    }, { signal });

    root.addEventListener("input", (e) => {
      const el = e.target as HTMLElement;
      if (el.matches("[data-item], [data-line] [data-ref]")) this.refreshLineAmounts();
      if (el.matches('[data-field="trade_type"]')) this.tradeTypeTouched = true;
    }, { signal });

    // specs.go asks the screen to fill trade_type from the vendor, because a
    // wrong value here misprices the whole period's settlement to the owner.
    root.querySelector<HTMLElement>('[data-ref="vendor_id"]')?.addEventListener(
      "change",
      (e) => void this.fillTradeTypeFromVendor((e.target as HTMLInputElement).value.trim()),
      { signal }
    );
  }

  private backToList(): void {
    history.replaceState(null, "", location.pathname);
    this.list = readListState(this.s);
    this.showList();
  }

  private async fillTradeTypeFromVendor(vendorId: string): Promise<void> {
    if (!vendorId || this.tradeTypeTouched) return;
    const select = this.root.querySelector<HTMLSelectElement>('[data-field="trade_type"]');
    if (!select || select.value) return;
    const vendor = MASTER_BY_NAME["vendor"];
    if (!vendor) return;
    try {
      const row = await getRow(vendor, vendorId);
      const value = row["trade_type"] == null ? "" : String(row["trade_type"]);
      // Only offer a value the <select> already accepts — the enum list came
      // from the live CHECK constraint and is the authority here.
      if (value && [...select.options].some((o) => o.value === value)) select.value = value;
    } catch {
      // A vendor that cannot be read is not a reason to block the form; the
      // field stays empty and the column DEFAULT applies.
    }
  }

  /* -------------------------------------------------------------- lines */

  private lineRows(): HTMLTableRowElement[] {
    return [...this.root.querySelectorAll<HTMLTableRowElement>("#pb-doc-lines tr[data-line]")];
  }

  private addLine(): void {
    const body = this.root.querySelector<HTMLElement>("#pb-doc-lines");
    const first = this.lineRows()[0];
    if (!body || !first) return;
    const clone = first.cloneNode(true) as HTMLTableRowElement;
    clone.querySelectorAll<HTMLInputElement>("input").forEach((i) => (i.value = ""));
    clone.querySelector("[data-line-amount]")!.innerHTML = '<span class="pb-muted">—</span>';
    body.appendChild(clone);
    // The clone carries the markup but none of the listeners, so its SKU box
    // would offer no suggestions until the next full render.
    wireRefSearch(clone);
    clone.querySelector<HTMLInputElement>("input")?.focus();
  }

  private removeLine(row: Element | null): void {
    if (!row) return;
    if (this.lineRows().length <= 1) {
      // The API refuses a document with no lines, so the last row is cleared
      // rather than removed — otherwise "เพิ่มบรรทัด" would have nothing to
      // clone from either.
      row.querySelectorAll<HTMLInputElement>("input").forEach((i) => (i.value = ""));
      this.refreshLineAmounts();
      return;
    }
    row.remove();
    this.refreshLineAmounts();
  }

  /**
   * Preview one line's value while it is being typed.
   *
   * This is the only arithmetic on this screen and it is display-only: the
   * database recalculates `amount` and both header totals on every write, and
   * the editor is re-rendered from that answer.
   */
  private refreshLineAmounts(): void {
    for (const row of this.lineRows()) {
      const qtyEl = row.querySelector<HTMLInputElement>('[data-item="qty"]');
      const costEl = row.querySelector<HTMLInputElement>('[data-item="unit_cost"]');
      const cell = row.querySelector<HTMLElement>("[data-line-amount]");
      if (!cell) continue;
      const q = Number(qtyEl?.value ?? "");
      const c = Number(costEl?.value ?? "");
      cell.innerHTML =
        qtyEl?.value && costEl?.value && Number.isFinite(q) && Number.isFinite(c)
          ? esc(money(q * c))
          : '<span class="pb-muted">—</span>';
    }
  }

  /** Read the item rows. Blank rows are dropped, not reported. */
  private collectItems(): { items: Row[]; problems: string[] } {
    const items: Row[] = [];
    const problems: string[] = [];

    this.lineRows().forEach((row, index) => {
      const line = index + 1;
      const item: Row = {};
      let filled = false;

      for (const ref of this.s.itemRefs) {
        const el = row.querySelector<HTMLInputElement>(`[data-ref="${CSS.escape(ref.field)}"]`);
        const value = el?.value.trim() ?? "";
        if (value) {
          item[ref.field] = value;
          filled = true;
        }
      }
      for (const f of this.s.itemFields) {
        const el = row.querySelector<HTMLInputElement>(`[data-item="${CSS.escape(f.name)}"]`);
        const text = el?.value.trim() ?? "";
        if (text === "") continue;
        filled = true;
        if (f.kind === "decimal" || f.kind === "int") {
          const n = Number(text);
          if (!Number.isFinite(n)) {
            problems.push(`บรรทัดที่ ${line}: ${f.label} ต้องเป็นตัวเลข`);
            continue;
          }
          item[f.name] = f.kind === "int" ? Math.trunc(n) : n;
        } else {
          item[f.name] = text;
        }
      }

      // A row nobody touched is not an error — the editor always shows one
      // spare line, and a user who leaves it alone means "no more lines".
      if (!filled) return;

      for (const ref of this.s.itemRefs) {
        if (ref.required && !item[ref.field]) problems.push(`บรรทัดที่ ${line}: ต้องระบุ${ref.label}`);
      }
      for (const f of this.s.itemFields) {
        if (f.required && item[f.name] === undefined) problems.push(`บรรทัดที่ ${line}: ต้องระบุ${f.label}`);
      }
      items.push(item);
    });

    if (items.length === 0) problems.push(`${this.s.label}ต้องมีรายการอย่างน้อย 1 บรรทัด`);
    return { items, problems };
  }

  /** Compare against what the server last sent, so an untouched list is not rewritten. */
  private itemsChanged(items: Row[]): boolean {
    const before = this.detail?.items ?? [];
    if (before.length !== items.length) return true;
    return items.some((item, i) => {
      const was = before[i];
      for (const ref of this.s.itemRefs) {
        if (String(item[ref.field] ?? "") !== String(was[ref.field] ?? "")) return true;
      }
      for (const f of this.s.itemFields) {
        const a = item[f.name];
        const b = was[f.name];
        if (f.kind === "decimal" || f.kind === "int") {
          if (Number(a ?? 0) !== Number(b ?? 0)) return true;
        } else if (String(a ?? "") !== String(b ?? "")) return true;
      }
      return false;
    });
  }

  /* --------------------------------------------------------------- save */

  private async save(): Promise<void> {
    clearErrors(this.root);
    this.formError("");

    const header = collectValues(
      { fields: this.s.headerFields, refs: this.s.headerRefs },
      this.headerEl(),
      this.creating ? "create" : "edit",
      this.creating ? undefined : this.detail?.header
    );
    const lines = this.collectItems();

    if (header.problems.length > 0 || lines.problems.length > 0) {
      header.problems.forEach((p) => showFieldError(this.root, p.field, p.message));
      const first = [...header.problems.map((p) => p.message), ...lines.problems][0];
      this.formError(lines.problems.length > 0 ? lines.problems.join(" · ") : first);
      return;
    }

    const busy = this.busy(true);
    try {
      if (this.creating) {
        this.detail = await createDoc(this.s, { ...header.body, items: lines.items });
        this.creating = false;
        const id = docId(this.s, this.detail.header);
        history.replaceState(null, "", `${location.pathname}?id=${encodeURIComponent(id)}`);
        toast(`สร้าง${this.s.label}เรียบร้อย`, `เลขที่ ${id}`, "pos");
        this.renderEditor();
        return;
      }

      const id = docId(this.s, this.detail!.header);
      const itemsDirty = this.itemsChanged(lines.items);
      const headerDirty = Object.keys(header.body).length > 0;

      if (!headerDirty && !itemsDirty) {
        this.formError("ไม่มีข้อมูลที่ต้องแก้ไข");
        return;
      }
      if (headerDirty) this.detail = await updateDocHeader(this.s, id, header.body);
      if (itemsDirty) this.detail = await replaceDocItems(this.s, id, lines.items);

      toast(`บันทึก${this.s.label}เรียบร้อย`, "", "pos");
      this.renderEditor();
    } catch (err) {
      this.showWriteError(err, `บันทึก${this.s.label}ไม่สำเร็จ`);
    } finally {
      busy(false);
    }
  }

  private showWriteError(err: unknown, fallback: string): void {
    if (err instanceof ApiError) {
      const orphans = err.fieldErrors.filter((fe) => !showFieldError(this.root, fe.field, err.message));
      if (err.fieldErrors.length > 0 && orphans.length === 0) {
        this.formError("ตรวจสอบข้อมูลที่ทำเครื่องหมายไว้แล้วบันทึกอีกครั้ง");
        return;
      }
    }
    this.formError(actionMessage(err, fallback));
  }

  /** Disable every action button while a write is in flight. */
  private busy(on: boolean): (v: boolean) => void {
    const set = (v: boolean): void => {
      this.root
        .querySelectorAll<HTMLButtonElement>("#pb-doc-actions button")
        .forEach((b) => (b.disabled = v));
    };
    set(on);
    return set;
  }

  /* -------------------------------------------------- state transitions */

  private async transition(kind: "confirm" | "post" | "cancel"): Promise<void> {
    const id = docId(this.s, this.detail!.header);
    const run = kind === "confirm" ? confirmDoc : kind === "post" ? postDoc : cancelDoc;
    const done =
      kind === "confirm"
        ? `ยืนยัน${this.s.label}เรียบร้อย`
        : kind === "post"
          ? `${this.s.postLabel}เรียบร้อย`
          : `ยกเลิก${this.s.label}เรียบร้อย`;

    this.formError("");
    const busy = this.busy(true);
    try {
      this.detail = await run(this.s, id);
      toast(done, `สถานะ ${docStatus(this.detail.header)}`, "pos");
      this.renderEditor();
    } catch (err) {
      this.formError(actionMessage(err, `${done.replace("เรียบร้อย", "")}ไม่สำเร็จ`));
      busy(false);
    }
  }

  private async postWithConfirmation(): Promise<void> {
    const ok = await confirmDialog({
      title: `${this.s.postLabel}${this.s.label}`,
      bodyHtml: `<p>${esc(this.s.postWarning)}</p>
        <p class="pb-hint">ตรวจรายการและคลังปลายทางให้ครบก่อนดำเนินการ</p>`,
      confirmLabel: this.s.postLabel,
    });
    if (ok) await this.transition("post");
  }

  private async cancelWithConfirmation(): Promise<void> {
    const ok = await confirmDialog({
      title: `ยกเลิก${this.s.label}`,
      bodyHtml: `<p>เอกสารจะเปลี่ยนเป็นสถานะ CANCELLED และแก้ไขต่อไม่ได้</p>
        <p class="pb-hint">ยังไม่มีการเคลื่อนไหวสต็อกจากเอกสารนี้ การยกเลิกจึงไม่กระทบยอดคงเหลือ</p>`,
      confirmLabel: `ยกเลิก${this.s.label}`,
      cancelLabel: "ย้อนกลับ",
      danger: true,
    });
    if (ok) await this.transition("cancel");
  }

  private async deleteWithConfirmation(): Promise<void> {
    const id = docId(this.s, this.detail!.header);
    const ok = await confirmDialog({
      title: `ลบ${this.s.label}`,
      bodyHtml: `<p>ลบร่าง <span class="pb-mono">${esc(id)}</span> ออกจากรายการ</p>
        <p class="pb-hint">ระบบเก็บแถวไว้และทำเครื่องหมายว่าลบแล้ว จึงยังตรวจย้อนหลังได้</p>`,
      confirmLabel: "ลบ",
      danger: true,
    });
    if (!ok) return;

    const busy = this.busy(true);
    try {
      await deleteDoc(this.s, id);
      toast(`ลบ${this.s.label}เรียบร้อย`, "", "pos");
      this.backToList();
    } catch (err) {
      this.formError(actionMessage(err, `ลบ${this.s.label}ไม่สำเร็จ`));
      busy(false);
    }
  }
}

/* ------------------------------------------------------------------ init */

export async function initDocPage(s: DocSpec, user: Session): Promise<void> {
  const root = document.getElementById("pb-page");
  if (!root) return;

  // Same reason as the master screens: the header form renders its enum
  // <select> synchronously, so the live list has to be in hand first.
  if (!user.demo) await loadEnums();

  new DocScreen(s, root, user.demo).start();
}

/** Exported for tests: which buttons a status offers. */
export { actions };
