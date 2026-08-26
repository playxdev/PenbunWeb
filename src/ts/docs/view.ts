/**
 * docs/view.ts — markup for a document screen. Pure functions, no fetching.
 *
 * A document screen is two screens sharing a URL: a list, and an editor for
 * one document. They are here together because they share the status badge
 * and because the editor's read-only rendering is the list's cell renderer
 * pointed at item rows.
 *
 * Two rules from PenbunAPI shape almost everything below:
 *
 *   items are editable only in DRAFT — so the editor renders inputs in one
 *   state and cells in every other, rather than disabling inputs and hoping.
 *
 *   the list endpoint has no sort parameter — it orders by doc_date DESC,
 *   autoID DESC and that is the only order there is. So no sortable headers:
 *   a header that looks clickable and reorders nothing is worse than a plain
 *   one.
 */

import { esc, money } from "../core/format.js";
import { fieldBlock, refBlock, type Mode, type Row } from "../core/fields.js";
import { icon } from "../core/icons.js";
import { badge, cellValue, NUMERIC_KINDS } from "../core/table.js";
import { values as enumOptions } from "../core/enums.js";
import { actions, statusStyle, type DocColumn, type DocSpec } from "./schema.js";

export const docId = (s: DocSpec, header: Row): string => String(header[s.idKey] ?? "");

export const docStatus = (header: Row): string => String(header["doc_status"] ?? "");

export function statusBadge(s: DocSpec, status: string): string {
  const style = statusStyle(s, status);
  return badge(style.label, style.tone);
}

/* ------------------------------------------------------------------ list */

export function listHead(s: DocSpec): string {
  const cols = s.columns
    .map((c) => `<th${NUMERIC_KINDS.has(c.kind ?? "") ? " data-num" : ""}>${esc(c.label)}</th>`)
    .join("");
  return `<thead><tr>${cols}<th>สถานะ</th></tr></thead>`;
}

export function listBody(s: DocSpec, rows: Row[]): string {
  const body = rows
    .map((row) => {
      const id = docId(s, row);
      const cells = s.columns
        .map((c) => {
          const num = NUMERIC_KINDS.has(c.kind ?? "") ? ' data-num class="pb-num"' : "";
          return `<td${num}>${cellValue(c, row[c.key])}</td>`;
        })
        .join("");
      return `<tr data-id="${esc(id)}" tabindex="0" role="link"
        aria-label="เปิด${esc(s.label)} ${esc(String(row["doc_no"] ?? id))}">
        ${cells}<td>${statusBadge(s, docStatus(row))}</td></tr>`;
    })
    .join("");
  return `<tbody>${body}</tbody>`;
}

export function listEmpty(s: DocSpec, filtered: boolean): string {
  const title = filtered ? "ไม่พบเอกสารที่ตรงกับเงื่อนไข" : `ยังไม่มี${s.label}ในระบบ`;
  const text = filtered
    ? "ลองลดเงื่อนไข ล้างตัวกรอง หรือขยายช่วงวันที่"
    : `สร้าง${s.label}ใบแรกเพื่อเริ่มบันทึกการรับเข้า`;
  const action = filtered
    ? '<button class="pb-btn pb-btn--secondary pb-btn--sm" type="button" data-act="clear">ล้างตัวกรอง</button>'
    : `<button class="pb-btn pb-btn--primary pb-btn--sm" type="button" data-act="create">สร้าง${esc(s.label)}</button>`;
  return `<div class="pb-empty">
    <span class="pb-empty__icon">${icon(filtered ? "search" : s.icon)}</span>
    <div class="pb-empty__title">${esc(title)}</div>
    <p class="pb-empty__text">${esc(text)}</p>
    ${action}
  </div>`;
}

function listToolbar(s: DocSpec): string {
  const statusOptions = s.statuses
    .map((v) => `<option value="${esc(v)}">${esc(statusStyle(s, v).label)}</option>`)
    .join("");

  const filters = (s.filters ?? [])
    .map((f) => {
      if (f.free || f.big) {
        const list = f.big ? ` list="pb-docfilter-list-${esc(f.param)}"` : "";
        const datalist = f.big ? `<datalist id="pb-docfilter-list-${esc(f.param)}"></datalist>` : "";
        return `<input class="pb-input pb-filter" type="search" data-filter="${esc(f.param)}"${list}
          data-resource="${esc(f.resource ?? "")}" placeholder="${esc(f.label)}"
          aria-label="กรองตาม${esc(f.label)}" autocomplete="off">${datalist}`;
      }
      const fixed = f.enumKey
        ? enumOptions(f.enumKey, (f.options ?? []).map((o) => o.value)).map((v) => ({
            value: v,
            label: f.enumLabels?.[v] ?? v,
          }))
        : (f.options ?? []);
      const opts = fixed.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("");
      return `<select class="pb-select pb-filter" data-filter="${esc(f.param)}"
        data-resource="${esc(f.resource ?? "")}" aria-label="กรองตาม${esc(f.label)}" style="width:auto">
        <option value="">ทุก${esc(f.label)}</option>${opts}</select>`;
    })
    .join("");

  return `<div class="pb-toolbar">
    <div class="pb-toolbar__grow">
      <div class="pb-inputgroup">
        <span class="pb-inputgroup__icon">${icon("search")}</span>
        <input class="pb-input" type="search" id="pb-doc-q" autocomplete="off"
               placeholder="ค้นหาจากเลขที่เอกสาร…" aria-label="ค้นหาจากเลขที่เอกสาร">
      </div>
    </div>
    <select class="pb-select" id="pb-doc-status" aria-label="กรองตามสถานะ" style="width:auto">
      <option value="">ทุกสถานะ</option>${statusOptions}
    </select>
    <input class="pb-input" type="date" id="pb-doc-from" aria-label="ตั้งแต่วันที่" style="width:auto">
    <input class="pb-input" type="date" id="pb-doc-to" aria-label="ถึงวันที่" style="width:auto">
    ${filters}
    <button class="pb-btn pb-btn--secondary pb-btn--sm" type="button" data-act="retry">
      ${icon("refresh")}<span>รีเฟรช</span></button>
  </div>`;
}

export function listShell(s: DocSpec): string {
  return `<div class="pb-pagehead">
    <div class="pb-pagehead__titles">
      <div class="pb-eyebrow">${esc(s.group)}</div>
      <h1>${esc(s.label)}</h1>
      <p class="pb-pagehead__sub">${esc(s.subtitle)}</p>
    </div>
    <div class="pb-pagehead__actions">
      <button class="pb-btn pb-btn--primary" type="button" data-act="create">สร้าง${esc(s.label)}</button>
    </div>
  </div>

  <div class="pb-card">
    ${listToolbar(s)}
    <div class="pb-tablewrap" id="pb-doc-table"></div>
    <div class="pb-card__foot">
      <span id="pb-doc-count"></span>
      <span id="pb-doc-pager"></span>
    </div>
  </div>`;
}

/* ---------------------------------------------------------------- editor */

/** One editable line. `line_no` is positional: the API renumbers from 1. */
function itemInputs(s: DocSpec, item: Row | undefined): string {
  const cells = [
    ...s.itemRefs.map((ref) => {
      const current = item?.[ref.field] == null ? "" : String(item[ref.field]);
      return `<td><input class="pb-input" type="search" data-ref="${esc(ref.field)}"
        data-resource="${esc(ref.resource)}" list="pb-reflist-${esc(ref.field)}"
        value="${esc(current)}" autocomplete="off" placeholder="${esc(ref.label)}"></td>`;
    }),
    ...s.itemFields.map((f) => {
      const raw = item?.[f.name];
      const value = raw === null || raw === undefined ? "" : String(raw);
      if (f.kind === "decimal" || f.kind === "int") {
        const step = f.kind === "int" ? "1" : "0.01";
        const min = f.min !== undefined ? ` min="${f.min}"` : "";
        return `<td data-num><input class="pb-input pb-num" type="number" inputmode="decimal"
          step="${step}"${min} data-item="${esc(f.name)}" value="${esc(value)}"
          aria-label="${esc(f.label)}"></td>`;
      }
      return `<td><input class="pb-input" type="text" data-item="${esc(f.name)}"
        value="${esc(value)}"${f.maxLen ? ` maxlength="${f.maxLen}"` : ""}
        aria-label="${esc(f.label)}" autocomplete="off"></td>`;
    }),
  ].join("");

  return `<tr data-line>
    ${cells}
    <td data-num class="pb-num" data-line-amount><span class="pb-muted">—</span></td>
    <td class="pb-col-actions">
      <button class="pb-iconbtn pb-iconbtn--sm pb-iconbtn--danger" type="button"
              data-act="line-remove" title="ลบบรรทัด" aria-label="ลบบรรทัด">${icon("trash")}</button>
    </td>
  </tr>`;
}

function editableItemsTable(s: DocSpec, items: Row[]): string {
  const head = [
    ...s.itemRefs.map((r) => `<th>${esc(r.label)}</th>`),
    ...s.itemFields.map(
      (f) => `<th${f.kind === "decimal" || f.kind === "int" ? " data-num" : ""}>${esc(f.label)}</th>`
    ),
    '<th data-num>มูลค่า</th>',
    '<th class="pb-col-actions"><span class="pb-visually-hidden">การจัดการ</span></th>',
  ].join("");

  const rows = (items.length > 0 ? items : [undefined]).map((it) => itemInputs(s, it)).join("");
  const lists = s.itemRefs
    .map((r) => `<datalist id="pb-reflist-${esc(r.field)}"></datalist>`)
    .join("");

  return `<table class="pb-table"><thead><tr>${head}</tr></thead>
    <tbody id="pb-doc-lines">${rows}</tbody></table>${lists}`;
}

function readOnlyItemsTable(s: DocSpec, items: Row[]): string {
  const head = s.itemColumns
    .map((c: DocColumn) => `<th${NUMERIC_KINDS.has(c.kind ?? "") ? " data-num" : ""}>${esc(c.label)}</th>`)
    .join("");
  const rows = items
    .map((it) => {
      const cells = s.itemColumns
        .map((c) => {
          const num = NUMERIC_KINDS.has(c.kind ?? "") ? ' data-num class="pb-num"' : "";
          return `<td${num}>${cellValue(c, it[c.key])}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  return `<table class="pb-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

/**
 * The buttons for one document, in the order the lifecycle runs.
 *
 * Nothing here is offered outside the status that allows it, so a user never
 * meets a 422 they could not have predicted. There is no reversal button:
 * the endpoint does not exist yet (PENBUN-TODO §3.4).
 */
function editorActions(s: DocSpec, status: string, creating: boolean): string {
  if (creating) {
    return `<button class="pb-btn pb-btn--secondary" type="button" data-act="back">ยกเลิก</button>
      <button class="pb-btn pb-btn--primary" type="button" data-act="save">บันทึกร่าง</button>`;
  }

  const a = actions(status);
  const out: string[] = [
    `<button class="pb-btn pb-btn--secondary" type="button" data-act="back">${icon("arrowLeft")}<span>รายการ</span></button>`,
  ];
  if (a.remove) {
    out.push(
      '<button class="pb-btn pb-btn--ghost pb-btn--danger" type="button" data-act="delete">ลบ</button>'
    );
  }
  if (a.cancel) {
    out.push('<button class="pb-btn pb-btn--secondary" type="button" data-act="cancel">ยกเลิกเอกสาร</button>');
  }
  if (a.edit) {
    out.push('<button class="pb-btn pb-btn--secondary" type="button" data-act="save">บันทึก</button>');
    out.push('<button class="pb-btn pb-btn--primary" type="button" data-act="confirm">ยืนยันเอกสาร</button>');
  }
  if (a.post) {
    out.push(
      `<button class="pb-btn pb-btn--primary" type="button" data-act="post">${esc(s.postLabel)}</button>`
    );
  }
  return out.join("");
}

/** Totals belong to the database — it recalculates them on every write. */
function totalsFoot(header: Row): string {
  const qtyRaw = header["total_qty"];
  const amtRaw = header["total_amount"];
  const shown =
    qtyRaw === undefined && amtRaw === undefined
      ? '<span class="pb-muted">ยอดรวมจะคำนวณเมื่อบันทึก</span>'
      : `<span>รวม <strong class="pb-num">${cellValue({ kind: "qty" }, qtyRaw)}</strong> หน่วย</span>
         <span> · มูลค่า <strong class="pb-num">${esc(money(Number(amtRaw ?? 0)))}</strong></span>`;
  return `<div class="pb-card__foot">
    <span class="pb-hint">ยอดรวมคำนวณจากรายการจริงโดยฐานข้อมูล ไม่ได้ส่งมาจากหน้าจอ</span>
    <span>${shown}</span>
  </div>`;
}

export interface EditorState {
  header: Row;
  items: Row[];
  creating: boolean;
}

export function editorShell(s: DocSpec, state: EditorState): string {
  const { header, items, creating } = state;
  const status = creating ? "DRAFT" : docStatus(header);
  const editable = creating || actions(status).edit;
  const mode: Mode = creating ? "create" : "edit";
  const id = docId(s, header);
  const docNo = String(header["doc_no"] ?? "");

  const title = creating ? `สร้าง${s.label}` : docNo || id || s.label;
  const sub = creating
    ? "บันทึกเป็นร่างก่อน แก้ไขรายการได้จนกว่าจะยืนยัน"
    : `<span class="pb-mono">${esc(id)}</span> · ${statusBadge(s, status)}`;

  const refs = s.headerRefs.map((r) => refBlock(r, creating ? undefined : header, mode)).join("");
  const fields = s.headerFields.map((f) => fieldBlock(f, creating ? undefined : header, mode)).join("");

  const itemsBlock = editable ? editableItemsTable(s, items) : readOnlyItemsTable(s, items);
  const addLine = editable
    ? `<button class="pb-btn pb-btn--secondary pb-btn--sm" type="button" data-act="line-add">
         ${icon("plus")}<span>เพิ่มบรรทัด</span></button>`
    : `<span class="pb-badge pb-badge--muted">แก้ไขรายการได้เฉพาะสถานะร่าง</span>`;

  return `<div class="pb-pagehead">
    <div class="pb-pagehead__titles">
      <div class="pb-eyebrow">${esc(s.label)}</div>
      <h1>${esc(title)}</h1>
      <p class="pb-pagehead__sub">${sub}</p>
    </div>
    <div class="pb-pagehead__actions" id="pb-doc-actions">${editorActions(s, status, creating)}</div>
  </div>

  <div class="pb-doc-editor">
  <span class="pb-error pb-hide" data-form-error></span>

  <div class="pb-card">
    <div class="pb-card__head"><div>
      <div class="pb-card__title">หัวเอกสาร</div>
      <div class="pb-card__sub">คู่ค้า คลังปลายทาง และเลขที่เอกสารบนกระดาษ</div>
    </div></div>
    <div class="pb-card__body">
      <fieldset class="pb-formgrid" id="pb-doc-header"${editable ? "" : " disabled"}>${refs}${fields}</fieldset>
    </div>
  </div>

  <div class="pb-card">
    <div class="pb-card__head">
      <div>
        <div class="pb-card__title">รายการ</div>
        <div class="pb-card__sub">ต้องมีอย่างน้อย 1 บรรทัดจึงจะบันทึกได้</div>
      </div>
      ${addLine}
    </div>
    <div class="pb-tablewrap" id="pb-doc-items">${itemsBlock}</div>
    ${totalsFoot(header)}
  </div>
  </div>`;
}
