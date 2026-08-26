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
import { values as enumOptions } from "../core/enums.js";
import { esc } from "../core/format.js";
import { BLANK, cellValue, demoState as demoBlock, isBlank, NUMERIC_KINDS, skeletonBody } from "../core/table.js";
import type { Column, MasterResource } from "./schema.js";
import { writable } from "./schema.js";

// Cells, pagination and the error state moved to core/table.ts when the
// document engine turned out to need exactly the same ones. They are
// re-exported here because this is where the rest of the app already reaches
// for them, and because a master screen should not have to know they moved.
export { errorState, footSummary, pageWindow, pagination } from "../core/table.js";

/** Row identity as the API knows it — the value every write puts in the URL. */
export const rowId = (r: MasterResource, row: Record<string, unknown>): string =>
  String(row[r.idKey] ?? "");

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
  const attrs = NUMERIC_KINDS.has(col.kind ?? "") ? ' data-num class="pb-num"' : "";
  return `<td${attrs}>${cellValue(col, row[col.key])}</td>`;
}

/* ------------------------------------------------------------------ table */

export function tableHead(r: MasterResource, sort: string | undefined, asc: boolean): string {
  const cols = r.columns
    .map((c, i) => {
      const num = NUMERIC_KINDS.has(c.kind ?? "") && i > 0 ? " data-num" : "";
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

export const skeletonRows = (r: MasterResource, count = 6): string => skeletonBody(colCount(r), count);

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

export const demoState = (r: MasterResource): string => demoBlock(r.label, r.icon);

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
      // An enum filter offers what the database accepts today, not what this
      // build was compiled with — see core/enums.ts.
      const fixed = f.enumKey
        ? enumOptions(f.enumKey, (f.options ?? []).map((o) => o.value)).map((v) => ({
            value: v,
            label: f.enumLabels?.[v] ?? v,
          }))
        : (f.options ?? []);
      const opts = fixed
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
