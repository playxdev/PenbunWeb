/**
 * pages/users.ts — the "ผู้ใช้และสิทธิ์" screen.
 *
 * Reads `GET /users`, which PenbunAPI mounts through the CRUD engine with
 * `ReadOnly` and `RequireLevel: ADMIN` (internal/resources/user.go). The two
 * writes it offers are the two the API has, and both live outside that engine:
 * `POST /users` (internal/domain/user) and `PUT /users/{user_id}/unlock`.
 *
 * It is not a master screen. `master/page.ts` gives a descriptor both a create
 * and an edit form, and editing here would offer to write `user_level` — the
 * column that decides who may write anything at all. Creating is a separate
 * endpoint with bcrypt behind it; editing does not exist yet on either side.
 *
 * Every column comes from `vw_users` (PenbunSQL v11). The view leaves out
 * `user_password` and `counting_password_fail`, so nothing on this page can
 * print them by accident.
 */

import { get, post, put, ApiError, CODE } from "../core/api.js";
import type { Session } from "../core/auth.js";
import { clearErrors, collectValues, fieldBlock, refBlock, showFieldError } from "../core/fields.js";
import type { Field, Ref } from "../core/schema.js";
import { dateTime, esc } from "../core/format.js";
import { icon } from "../core/icons.js";
import { options } from "../master/repo.js";
import {
  badge,
  BLANK,
  demoState,
  errorState,
  footSummary,
  isBlank,
  pagination,
  skeletonBody,
} from "../core/table.js";
import { confirmDialog, toast } from "../core/ui.js";

interface UserRow {
  user_id: string;
  user_name: string;
  full_name: string | null;
  email: string | null;
  user_level: string;
  status_user_locked: boolean;
  status_change_pw: boolean;
  last_login_date: string | null;
  warehouse_code: string | null;
  warehouse_name: string | null;
  is_active: boolean;
}

interface PageResult {
  items: UserRow[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE = 300;
const COLS = 5;

/** tb_users.user_level. PenbunAPI v4 knows these two and nothing else. */
const LEVEL_LABEL: Record<string, string> = {
  ADMIN: "ผู้ดูแลระบบ",
  USER: "ผู้ใช้งาน",
};

/* ----------------------------------------------------------- create form */

/**
 * What `POST /users` accepts. Deliberately shorter than tb_users:
 * `status_change_pw` is left to the table's DEFAULT of 1, so whoever is
 * created must replace the administrator's password at first sign-in, and
 * `status_user_locked` / `counting_password_fail` belong to the sign-in flow.
 */
const CREATE_FIELDS: readonly Field[] = [
  {
    name: "user_name",
    kind: "string",
    label: "ชื่อผู้ใช้",
    required: true,
    maxLen: 50,
    hint: "a-z A-Z 0-9 . _ - ยาว 3-50 ตัวอักษร เปลี่ยนภายหลังไม่ได้",
  },
  {
    name: "password",
    kind: "string",
    label: "รหัสผ่านเริ่มต้น",
    required: true,
    secret: true,
    maxLen: 72,
    hint: "อย่างน้อย 8 ตัวอักษร มีทั้งตัวอักษรและตัวเลข ผู้ใช้ต้องเปลี่ยนเองตอนเข้าระบบครั้งแรก",
  },
  { name: "full_name", kind: "string", label: "ชื่อ–สกุล", maxLen: 150 },
  { name: "email", kind: "string", label: "อีเมล", maxLen: 100 },
  {
    name: "user_level",
    kind: "string",
    label: "สิทธิ์การใช้งาน",
    required: true,
    enumValues: ["USER", "ADMIN"],
    enumLabels: LEVEL_LABEL,
    hint: "ผู้ดูแลระบบเห็นและแก้ได้ทุกอย่าง รวมถึงหน้านี้",
  },
  { name: "remark", kind: "string", label: "หมายเหตุ", maxLen: 255, multiline: true, wide: true },
];

const CREATE_REFS: readonly Ref[] = [
  { field: "warehouse_id", resource: "warehouse", label: "คลังประจำตัว" },
];

/** Fill the warehouse picker. A list that fails to load says so and stays usable. */
async function fillWarehouses(root: HTMLElement): Promise<void> {
  const sel = root.querySelector<HTMLSelectElement>('select[data-ref="warehouse_id"]');
  if (!sel) return;
  try {
    const list = await options("warehouse");
    sel.innerHTML =
      '<option value="">— ไม่ผูกกับคลังใด —</option>' +
      list
        .map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`)
        .join("");
  } catch {
    sel.innerHTML = '<option value="">โหลดรายชื่อคลังไม่สำเร็จ</option>';
  }
}

/** Resolves true when a user was created, false when the dialog was dismissed. */
function openCreateForm(): Promise<boolean> {
  const host = document.createElement("div");
  host.className = "pb-modal";
  host.innerHTML = `<div class="pb-modal__panel pb-modal__panel--lg" role="dialog" aria-modal="true"
      aria-labelledby="pb-user-form-title">
    <form novalidate>
      <div class="pb-modal__head">
        <h2 class="pb-modal__title" id="pb-user-form-title">เพิ่มผู้ใช้</h2>
        <button class="pb-iconbtn pb-iconbtn--sm" type="button" data-close aria-label="ปิด">${icon("x")}</button>
      </div>
      <div class="pb-modal__body"><div class="pb-formgrid">
        ${CREATE_FIELDS.map((f) => fieldBlock(f, undefined, "create")).join("")}
        ${CREATE_REFS.map((r) => refBlock(r, undefined, "create")).join("")}
      </div></div>
      <div class="pb-modal__foot">
        <span class="pb-error pb-hide" data-form-error></span>
        <button class="pb-btn pb-btn--secondary" type="button" data-close>ยกเลิก</button>
        <button class="pb-btn pb-btn--primary" type="submit">สร้างผู้ใช้</button>
      </div>
    </form>
  </div>`;

  document.body.appendChild(host);
  void fillWarehouses(host);
  requestAnimationFrame(() => {
    host.classList.add("is-open");
    host.querySelector<HTMLElement>("input:not([disabled])")?.focus();
  });

  return new Promise<boolean>((resolve) => {
    const form = host.querySelector("form")!;
    const submit = host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const formError = host.querySelector<HTMLElement>("[data-form-error]")!;

    const close = (created: boolean): void => {
      document.removeEventListener("keydown", onKey);
      host.remove();
      resolve(created);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") close(false);
    };
    document.addEventListener("keydown", onKey);
    host.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => close(false)));
    host.addEventListener("click", (e) => {
      if (e.target === host) close(false);
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      clearErrors(host);
      formError.classList.add("pb-hide");

      const { body, problems } = collectValues(
        { fields: CREATE_FIELDS, refs: CREATE_REFS },
        host,
        "create",
        undefined
      );
      if (problems.length > 0) {
        problems.forEach((p) => showFieldError(host, p.field, p.message));
        formError.textContent = "กรอกข้อมูลที่จำเป็นให้ครบก่อนบันทึก";
        formError.classList.remove("pb-hide");
        return;
      }

      submit.disabled = true;
      submit.textContent = "กำลังสร้าง…";

      post("/users", body)
        .then(() => {
          toast("เพิ่มผู้ใช้เรียบร้อย", String(body.user_name ?? ""), "pos");
          close(true);
        })
        .catch((err: unknown) => {
          submit.disabled = false;
          submit.textContent = "สร้างผู้ใช้";
          if (!(err instanceof ApiError)) {
            formError.textContent = "สร้างผู้ใช้ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
            formError.classList.remove("pb-hide");
            return;
          }
          // errors[] names the field it is about; a duplicate user_name comes
          // back from the unique index without one, so it lands in the foot.
          const orphans = err.fieldErrors.filter((fe) => !showFieldError(host, fe.field, err.message));
          formError.textContent =
            err.fieldErrors.length === 0 || orphans.length > 0
              ? err.message
              : "ตรวจสอบข้อมูลที่ทำเครื่องหมายไว้แล้วบันทึกอีกครั้ง";
          formError.classList.remove("pb-hide");
        });
    });
  });
}

/* ------------------------------------------------------------------ state */

interface State {
  page: number;
  q: string;
  level: string;
  /** "" = every row, "true" = active only, "false" = suspended only. */
  active: string;
  /** "" = every row, "true" = locked only. */
  locked: string;
}

const isFiltered = (s: State): boolean =>
  s.q !== "" || s.level !== "" || s.active !== "" || s.locked !== "";

/* ---------------------------------------------------------------- markup */

function toolbar(): string {
  const opt = (value: string, label: string): string =>
    `<option value="${esc(value)}">${esc(label)}</option>`;
  return `<div class="pb-toolbar">
    <div class="pb-toolbar__grow">
      <div class="pb-inputgroup">
        <span class="pb-inputgroup__icon">${icon("search")}</span>
        <input class="pb-input" type="search" id="pb-users-q"
               placeholder="ค้นหาชื่อผู้ใช้ ชื่อ–สกุล หรืออีเมล…" aria-label="ค้นหาผู้ใช้">
      </div>
    </div>
    <select class="pb-select" id="pb-users-level" aria-label="กรองตามสิทธิ์" style="width:auto">
      ${opt("", "ทุกสิทธิ์")}${opt("ADMIN", LEVEL_LABEL.ADMIN!)}${opt("USER", LEVEL_LABEL.USER!)}
    </select>
    <select class="pb-select" id="pb-users-active" aria-label="กรองตามสถานะ" style="width:auto">
      ${opt("", "ทุกสถานะ")}${opt("true", "ใช้งาน")}${opt("false", "พักการใช้งาน")}
    </select>
    <select class="pb-select" id="pb-users-locked" aria-label="กรองตามการล็อก" style="width:auto">
      ${opt("", "ล็อกหรือไม่ก็ได้")}${opt("true", "ถูกล็อกอยู่")}${opt("false", "ไม่ถูกล็อก")}
    </select>
  </div>`;
}

const head = (): string =>
  `<thead><tr>
    <th>ผู้ใช้</th><th>สิทธิ์</th><th>คลังประจำตัว</th><th>เข้าใช้ล่าสุด</th><th>สถานะ</th>
  </tr></thead>`;

function warehouseCell(row: UserRow): string {
  if (isBlank(row.warehouse_code)) return BLANK;
  const name = isBlank(row.warehouse_name) ? "" : ` ${String(row.warehouse_name)}`;
  return esc(`${String(row.warehouse_code)}${name}`);
}

/**
 * Three independent flags share one column, so they are three badges rather
 * than one — a suspended account can also be locked, and collapsing them
 * would hide whichever the code checked second.
 */
function statusCell(row: UserRow): string {
  const parts = [
    row.is_active ? badge("ใช้งาน", "pos") : badge("พักการใช้งาน", "muted"),
  ];
  if (row.status_user_locked) parts.push(badge("ถูกล็อก", "neg"));
  if (row.status_change_pw) parts.push(badge("ต้องเปลี่ยนรหัสผ่าน", "warn"));

  const unlock = row.status_user_locked
    ? `<button class="pb-btn pb-btn--ghost pb-btn--sm" type="button"
               data-act="unlock" data-id="${esc(row.user_id)}">ปลดล็อก</button>`
    : "";
  return `<td>${parts.join(" ")}${unlock}</td>`;
}

function body(rows: UserRow[]): string {
  const tr = (row: UserRow): string => {
    const title = isBlank(row.full_name) ? row.user_name : String(row.full_name);
    const meta = [row.user_name, isBlank(row.email) ? "" : String(row.email)]
      .filter(Boolean)
      .join(" · ");
    const level = LEVEL_LABEL[row.user_level] ?? row.user_level;
    return `<tr>
      <td><div class="pb-cell-main"><span class="pb-thumb">${icon("user")}</span>
        <span class="pb-cell-main__text">
          <span class="pb-cell-main__title">${esc(title)}</span>
          <span class="pb-cell-main__meta">${esc(meta)}</span>
        </span></div></td>
      <td>${badge(level, row.user_level === "ADMIN" ? "brand" : "muted")}</td>
      <td>${warehouseCell(row)}</td>
      <td class="pb-nowrap">${isBlank(row.last_login_date) ? "ยังไม่เคยเข้าใช้" : esc(dateTime(String(row.last_login_date)))}</td>
      ${statusCell(row)}
    </tr>`;
  };
  return `<tbody>${rows.map(tr).join("")}</tbody>`;
}

function emptyState(filtered: boolean): string {
  return `<div class="pb-empty">
    <span class="pb-empty__icon">${icon(filtered ? "search" : "shield")}</span>
    <div class="pb-empty__title">${
      filtered ? "ไม่พบผู้ใช้ที่ตรงกับเงื่อนไข" : "ยังไม่มีผู้ใช้ในระบบ"
    }</div>
    <p class="pb-empty__text">${
      filtered
        ? "ลองลดเงื่อนไขการค้นหา หรือล้างตัวกรองเพื่อดูรายการทั้งหมด"
        : "เพิ่มผู้ใช้คนแรกเพื่อให้มีคนเข้าใช้ระบบได้"
    }</p>
    ${
      filtered
        ? '<button class="pb-btn pb-btn--secondary pb-btn--sm" type="button" data-act="clear">ล้างตัวกรอง</button>'
        : '<button class="pb-btn pb-btn--primary pb-btn--sm" type="button" data-act="create">เพิ่มผู้ใช้</button>'
    }
  </div>`;
}

/* ------------------------------------------------------------- controller */

class UsersPage {
  private readonly state: State = { page: 1, q: "", level: "", active: "", locked: "" };
  private searchTimer = 0;
  private inflight: AbortController | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly demo: boolean
  ) {}

  private table(): HTMLElement {
    return this.root.querySelector<HTMLElement>("#pb-users-table")!;
  }

  private foot(shown = 0, total = 0, totalPages = 0): void {
    const el = this.root.querySelector<HTMLElement>("#pb-users-foot");
    if (!el) return;
    el.innerHTML = `<span>${footSummary(shown, total, "ผู้ใช้")}</span>${pagination(
      this.state.page,
      totalPages
    )}`;
  }

  render(): void {
    this.root.querySelector("#pb-users-card")!.innerHTML = `${toolbar()}
      <div class="pb-tablewrap" id="pb-users-table"></div>
      <div class="pb-card__foot" id="pb-users-foot"></div>`;
    this.wire();

    if (this.demo) {
      this.table().innerHTML = demoState("ผู้ใช้และสิทธิ์", "shield");
      return;
    }
    void this.load();
  }

  private query(): string {
    const p = new URLSearchParams();
    p.set("page", String(this.state.page));
    p.set("limit", String(PAGE_SIZE));
    p.set("sort", "username");
    if (this.state.q) p.set("q", this.state.q);
    if (this.state.level) p.set("user_level", this.state.level);
    if (this.state.active) p.set("is_active", this.state.active);
    if (this.state.locked) p.set("status_user_locked", this.state.locked);
    return p.toString();
  }

  private async load(): Promise<void> {
    this.inflight?.abort();
    const ctrl = new AbortController();
    this.inflight = ctrl;

    this.table().innerHTML = `<table class="pb-table">${head()}${skeletonBody(COLS)}</table>`;

    try {
      const res = await get<PageResult>(`/users?${this.query()}`, { signal: ctrl.signal });
      if (ctrl.signal.aborted) return;

      if (res.items.length === 0) {
        this.table().innerHTML = emptyState(isFiltered(this.state));
        this.foot(0, res.total, 0);
        return;
      }
      this.table().innerHTML = `<table class="pb-table">${head()}${body(res.items)}</table>`;
      this.foot(res.items.length, res.total, res.total_pages);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const e = err instanceof ApiError ? err : null;
      // The API answers 403 for anyone who is not ADMIN. That is not a bug to
      // retry — it is the answer — so the message says whose account it is.
      this.table().innerHTML =
        e?.code === CODE.FORBIDDEN
          ? errorState("บัญชีนี้ไม่มีสิทธิ์ดูรายชื่อผู้ใช้ ต้องเป็นผู้ดูแลระบบเท่านั้น", e.traceId)
          : errorState(e?.message ?? "ติดต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง", e?.traceId ?? "");
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

  private async unlock(userId: string): Promise<void> {
    const ok = await confirmDialog({
      title: "ปลดล็อกบัญชี",
      bodyHtml: `<p>ปลดล็อก <span class="pb-mono">${esc(userId)}</span> และล้างจำนวนครั้งที่กรอกรหัสผ่านผิด
        บัญชีนี้จะเข้าสู่ระบบได้ทันทีด้วยรหัสผ่านเดิม</p>`,
      confirmLabel: "ปลดล็อก",
    });
    if (!ok) return;

    try {
      await put(`/users/${encodeURIComponent(userId)}/unlock`, undefined);
      toast("ปลดล็อกบัญชีเรียบร้อย", userId, "pos");
      this.reload(false);
    } catch (err) {
      const e = err instanceof ApiError ? err : null;
      toast("ปลดล็อกไม่สำเร็จ", e?.message ?? "ติดต่อเซิร์ฟเวอร์ไม่ได้", "neg");
    }
  }

  private clearFilters(): void {
    this.state.q = "";
    this.state.level = "";
    this.state.active = "";
    this.state.locked = "";
    const q = this.root.querySelector<HTMLInputElement>("#pb-users-q");
    if (q) q.value = "";
    for (const id of ["#pb-users-level", "#pb-users-active", "#pb-users-locked"]) {
      const sel = this.root.querySelector<HTMLSelectElement>(id);
      if (sel) sel.value = "";
    }
    this.reload();
  }

  private wire(): void {
    const q = this.root.querySelector<HTMLInputElement>("#pb-users-q");
    q?.addEventListener("input", () => {
      window.clearTimeout(this.searchTimer);
      this.searchTimer = window.setTimeout(() => {
        this.state.q = q.value.trim();
        this.reload();
      }, SEARCH_DEBOUNCE);
    });

    const select = (id: string, key: "level" | "active" | "locked"): void => {
      this.root.querySelector<HTMLSelectElement>(id)?.addEventListener("change", (e) => {
        this.state[key] = (e.target as HTMLSelectElement).value;
        this.reload();
      });
    };
    select("#pb-users-level", "level");
    select("#pb-users-active", "active");
    select("#pb-users-locked", "locked");

    // One listener for the whole card: the table is replaced on every load,
    // so anything bound to a row would be bound to a row that is already gone.
    this.root.addEventListener("click", (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-act],[data-page]");
      if (!el) return;

      const page = el.dataset.page;
      if (page) {
        this.state.page = Number(page);
        void this.load();
        return;
      }
      switch (el.dataset.act) {
        case "unlock":
          void this.unlock(el.dataset.id ?? "");
          break;
        case "create":
          void openCreateForm().then((created) => {
            if (created) this.reload();
          });
          break;
        case "clear":
          this.clearFilters();
          break;
        case "retry":
          void this.load();
          break;
      }
    });
  }
}

export function initUsers(user: Session): void {
  const root = document.getElementById("pb-page");
  if (!root) return;
  new UsersPage(root, user.demo).render();
}
