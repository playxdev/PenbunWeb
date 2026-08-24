/**
 * master/view.ts — markup for a master screen. Pure functions, no fetching.
 *
 * Kept apart from the controller so the shape of a row can be reasoned about
 * without also reasoning about request state, and so the same cell renderer
 * serves the table, the delete confirmation, and the ref picker.
 *
 * Two attribute names are avoided on purpose. `core/ui.ts` claims
 * `th[data-sort]` for client-side sorting and `[data-table-filter]` for
 * client-side filtering; a master table sorts and filters on the server, over
 * every page rather than the 25 rows on screen. Using those names would give
 * the user two sorts fighting for the same table.
 */

import { icon } from "../core/icons.js";
import { date, esc, money, pct, qty } from "../core/format.js";
import type { Column, MasterResource } from "./schema.js";
import { writable } from "./schema.js";

const BLANK = "—";

const isBlank = (v: unknown): boolean => v === null || v === undefined || v === "";

/** Row identity as the API knows it — the value every write puts in the URL. */
export const rowId = (r: MasterResource, row: Record<string, unknown>): string =>
  String(row[r.idKey] ?? "");

/* ------------------------------------------------------------------ cells */

function badge(text: string, tone: string): string {
  return `<span class="pb-badge pb-badge--${tone}">${esc(text)}</span>`;
}

function cellValue(col: Column, raw: unknown): string {
  const blank = col.blank ?? BLANK;
  if (isBlank(raw)) return `<span class="pb-muted">${esc(blank)}</span>`;

  switch (col.kind) {
    case "money":
      return esc(money(Number(raw)));
    case "qty":
      return esc(qty(Number(raw)));
    case "percent":
      return esc(pct(Number(raw)));
    case "date":
      return esc(date(String(raw)));
    case "bool": {
      const on = raw === true || raw === 1 || raw === "1";
      const label = col.labels?.[String(raw)] ?? (on ? "ใช่" : "ไม่");
      if (label === BLANK) return `<span class="pb-muted">${BLANK}</span>`;
      return badge(label, on ? (col.tone ?? "pos") : "muted");
    }
    case "badge":
      return badge(col.labels?.[String(raw)] ?? String(raw), col.tone ?? "muted");
    case "code":
      return `<span class="pb-mono">${esc(raw)}</span>`;
    default:
      return esc(raw);
  }
}

/** The leading column: name on top, business ID and context underneath. */
function identityCell(r: MasterResource, col: Column, row: Record<string, unknown>): string {
  const title = isBlank(row[col.key]) ? BLANK : String(row[col.key]);
  const metaParts = [rowId(r, row)];
  if (col.meta && !isBlank(row[col.meta]) && String(row[col.meta]) !== metaParts[0]) {
    metaParts.push(String(row[col.meta]));
  }
  return `<td><div class="pb-cell-main"><span class="pb-thumb">${icon(r.icon)}</span>
    <span class="pb-cell-main__text">
      <span class="pb-cell-main__title">${esc(title)}</span>
      <span class="pb-cell-main__meta">${esc(metaParts.join(" · "))}</span>
    </span></div></td>`;
}

function cell(r: MasterResource, col: Column, row: Record<string, unknown>, first: boolean): string {
  if (first) return identityCell(r, col, row);
  const numeric = col.kind === "money" || col.kind === "qty" || col.kind === "percent";
  const attrs = numeric ? ' data-num class="pb-num"' : "";
  return `<td${attrs}>${cellValue(col, row[col.key])}</td>`;
}

/* ------------------------------------------------------------------ table */

export function tableHead(r: MasterResource, sort: string | undefined, asc: boolean): string {
  const cols = r.columns
    .map((c, i) => {
      const numeric = c.kind === "money" || c.kind === "qty" || c.kind === "percent";
      const num = numeric && i > 0 ? " data-num" : "";
      if (!c.sort) return `<th${num}>${esc(c.label)}</th>`;
      // The ↑/↓ marker comes from `.pb-table th[aria-sort]::after` in
      // 04-components.css — the same one the client-side tables use.
      const active = c.sort === sort;
      const order = active ? (asc ? "ascending" : "descending") : "none";
      return `<th${num} class="pb-th-sort" data-sortkey="${esc(c.sort)}" aria-sort="${order}">
        <button type="button" class="pb-th-btn">${esc(c.label)}</button></th>`;
    })
    .join("");
  const actions = writable(r) ? '<th class="pb-col-actions"><span class="pb-visually-hidden">การจัดการ</span></th>' : "";
  return `<thead><tr>${cols}${actions}</tr></thead>`;
}

export function tableBody(r: MasterResource, rows: Array<Record<string, unknown>>): string {
  const body = rows
    .map((row) => {
      const id = rowId(r, row);
      const cells = r.columns.map((c, i) => cell(r, c, row, i === 0)).join("");
      const actions = writable(r)
        ? `<td class="pb-col-actions"><div class="pb-rowacts">
             <button class="pb-iconbtn pb-iconbtn--sm" type="button" data-act="edit" data-id="${esc(id)}"
                     title="แก้ไข" aria-label="แก้ไข ${esc(id)}">${icon("pencil")}</button>
             <button class="pb-iconbtn pb-iconbtn--sm pb-iconbtn--danger" type="button" data-act="delete"
                     data-id="${esc(id)}" title="ลบ" aria-label="ลบ ${esc(id)}">${icon("trash")}</button>
           </div></td>`
        : "";
      return `<tr data-id="${esc(id)}">${cells}${actions}</tr>`;
    })
    .join("");
  return `<tbody>${body}</tbody>`;
}

const colCount = (r: MasterResource): number => r.columns.length + (writable(r) ? 1 : 0);

export function skeletonRows(r: MasterResource, count = 6): string {
  const widths = ["70%", "45%", "55%", "40%", "60%", "35%", "50%", "45%", "30%"];
  const row = (i: number) =>
    `<tr>${Array.from({ length: colCount(r) }, (_, c) => {
      const w = widths[(i + c) % widths.length];
      return `<td><span class="pb-skeleton" style="display:block;height:14px;width:${w}"></span></td>`;
    }).join("")}</tr>`;
  return `<tbody>${Array.from({ length: count }, (_, i) => row(i)).join("")}</tbody>`;
}

/* ----------------------------------------------------------------- states */

export function emptyState(r: MasterResource, filtered: boolean): string {
  const title = filtered ? "ไม่พบรายการที่ตรงกับเงื่อนไข" : `ยังไม่มี${r.label}ในระบบ`;
  const text = filtered
    ? "ลองลดเงื่อนไขการค้นหา หรือล้างตัวกรองเพื่อดูรายการทั้งหมด"
    : `เพิ่ม${r.label}รายการแรกเพื่อให้หน้าจออื่นเรียกใช้ได้`;
  const action = filtered
    ? '<button class="pb-btn pb-btn--secondary pb-btn--sm" type="button" data-act="clear">ล้างตัวกรอง</button>'
    : writable(r)
      ? `<button class="pb-btn pb-btn--primary pb-btn--sm" type="button" data-act="create">เพิ่ม${esc(r.label)}</button>`
      : "";
  return `<div class="pb-empty">
    <span class="pb-empty__icon">${icon(filtered ? "search" : r.icon)}</span>
    <div class="pb-empty__title">${esc(title)}</div>
    <p class="pb-empty__text">${esc(text)}</p>
    ${action}
  </div>`;
}

/** Error states name the cause and the next action — never just "ผิดพลาด". */
export function errorState(message: string, traceId = ""): string {
  const ref = traceId
    ? `<p class="pb-empty__text"><span class="pb-mono">รหัสอ้างอิง ${esc(traceId)}</span></p>`
    : "";
  return `<div class="pb-empty">
    <span class="pb-empty__icon">${icon("alert")}</span>
    <div class="pb-empty__title">โหลดข้อมูลไม่สำเร็จ</div>
    <p class="pb-empty__text">${esc(message)}</p>
    ${ref}
    <button class="pb-btn pb-btn--secondary pb-btn--sm" type="button" data-act="retry">ลองใหม่</button>
  </div>`;
}

export function demoState(r: MasterResource): string {
  return `<div class="pb-empty">
    <span class="pb-empty__icon">${icon("monitor")}</span>
    <div class="pb-empty__title">โหมดสาธิตไม่ได้เชื่อมต่อ PenbunAPI</div>
    <p class="pb-empty__text">หน้า${esc(r.label)}อ่านข้อมูลจริงจาก PenbunAPI เท่านั้น
      ออกจากโหมดสาธิตแล้วเข้าสู่ระบบด้วยบัญชีจริงเพื่อดูและแก้ไขข้อมูล</p>
    <a class="pb-btn pb-btn--secondary pb-btn--sm" href="/index.html">ไปหน้าเข้าสู่ระบบ</a>
  </div>`;
}

/* ------------------------------------------------------------- pagination */

/** A window of at most five page numbers, always including the current one. */
export function pageWindow(page: number, totalPages: number, span = 5): number[] {
  if (totalPages <= 1) return [1];
  const half = Math.floor(span / 2);
  let start = Math.max(1, page - half);
  const end = Math.min(totalPages, start + span - 1);
  start = Math.max(1, end - span + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function pagination(page: number, totalPages: number): string {
  if (totalPages <= 1) return "";
  const btn = (n: number) =>
    `<button type="button" data-page="${n}"${n === page ? ' aria-current="true"' : ""}>${n}</button>`;
  const prev = `<button type="button" data-page="${page - 1}" aria-label="หน้าก่อนหน้า"${
    page <= 1 ? " disabled" : ""
  }>‹</button>`;
  const next = `<button type="button" data-page="${page + 1}" aria-label="หน้าถัดไป"${
    page >= totalPages ? " disabled" : ""
  }>›</button>`;
  return `<nav class="pb-pagination" aria-label="แบ่งหน้า">${prev}${pageWindow(page, totalPages)
    .map(btn)
    .join("")}${next}</nav>`;
}

export function footSummary(shown: number, total: number, label: string): string {
  if (total === 0) return `ไม่พบ${esc(label)}`;
  return `แสดง ${qty(shown)} จาก ${qty(total)} รายการ`;
}

/* ---------------------------------------------------------------- toolbar */

export function toolbar(r: MasterResource): string {
  const search = r.searchable
    ? `<div class="pb-toolbar__grow">
        <div class="pb-inputgroup">
          <span class="pb-inputgroup__icon">${icon("search")}</span>
          <input class="pb-input" type="search" id="pb-master-q" autocomplete="off"
                 placeholder="ค้นหา${esc(r.label)}…" aria-label="ค้นหา${esc(r.label)}">
        </div>
      </div>`
    : '<div class="pb-toolbar__grow"></div>';

  const status =
    r.audit === false
      ? ""
      : `<select class="pb-select" id="pb-master-active" aria-label="กรองตามสถานะ" style="width:auto">
          <option value="">ทุกสถานะ</option>
          <option value="true">ใช้งาน</option>
          <option value="false">พักการใช้งาน</option>
        </select>`;

  const filters = (r.filters ?? [])
    .map((f) => {
      if (f.free || f.big) {
        const list = f.big ? ` list="pb-filter-list-${esc(f.param)}"` : "";
        const datalist = f.big ? `<datalist id="pb-filter-list-${esc(f.param)}"></datalist>` : "";
        return `<input class="pb-input pb-filter" type="search" data-filter="${esc(f.param)}"${list}
                       placeholder="${esc(f.label)}" aria-label="กรองตาม${esc(f.label)}" autocomplete="off">${datalist}`;
      }
      const opts = (f.options ?? [])
        .map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`)
        .join("");
      return `<select class="pb-select pb-filter" data-filter="${esc(f.param)}"
                      data-resource="${esc(f.resource ?? "")}" aria-label="กรองตาม${esc(f.label)}" style="width:auto">
        <option value="">ทุก${esc(f.label)}</option>${opts}
      </select>`;
    })
    .join("");

  return `<div class="pb-toolbar">${search}${status}${filters}
    <button class="pb-btn pb-btn--secondary pb-btn--sm" type="button" data-act="retry">
      ${icon("refresh")}<span>รีเฟรช</span></button>
  </div>`;
}

/* ------------------------------------------------------------- page shell */

export function pageShell(r: MasterResource): string {
  const create = writable(r)
    ? `<button class="pb-btn pb-btn--primary" type="button" data-act="create">เพิ่ม${esc(r.label)}</button>`
    : `<span class="pb-badge pb-badge--muted">อ่านอย่างเดียว</span>`;

  return `<div class="pb-pagehead">
    <div class="pb-pagehead__titles">
      <div class="pb-eyebrow">${esc(r.group)}</div>
      <h1>${esc(r.label)}</h1>
      <p class="pb-pagehead__sub">${esc(r.subtitle)}</p>
    </div>
    <div class="pb-pagehead__actions">${create}</div>
  </div>

  <div class="pb-card">
    ${toolbar(r)}
    <div class="pb-tablewrap" id="pb-master-table"></div>
    <div class="pb-card__foot">
      <span id="pb-master-count"></span>
      <span id="pb-master-pager"></span>
    </div>
  </div>`;
}
