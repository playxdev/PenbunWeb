/**
 * core/table.ts — the table parts that belong to no one screen.
 *
 * The master engine grew these first, and the document engine needs exactly
 * the same ones: a money cell is a money cell whether the row came from
 * `/warehouse` or from `/receive-note`. Copying them would give the two
 * engines cells that drift apart — a date rendered in Buddhist era on one
 * screen and Gregorian on the other, for the same column type.
 *
 * What stays behind in `master/view.ts` is the part that knows about master
 * descriptors: the identity cell, the sortable header, the empty state that
 * offers "เพิ่ม…". Nothing here knows what a resource is.
 */

import { icon } from "./icons.js";
import { date, esc, money, pct, qty } from "./format.js";

export const BLANK = "—";

export const isBlank = (v: unknown): boolean => v === null || v === undefined || v === "";

/** How one cell is rendered. Mirrors nothing on the server — a display choice. */
export type CellKind =
  | "text"
  | "code" // monospace — business IDs and SKUs
  | "money"
  | "qty"
  | "date"
  | "bool"
  | "badge"
  | "percent";

export type Tone = "brand" | "pos" | "neg" | "warn" | "muted";

/** The subset of a column definition a cell renderer needs. */
export interface CellSpec {
  kind?: CellKind;
  tone?: Tone;
  labels?: Readonly<Record<string, string>>;
  blank?: string;
}

export const NUMERIC_KINDS: ReadonlySet<string> = new Set(["money", "qty", "percent"]);

export function badge(text: string, tone: string): string {
  return `<span class="pb-badge pb-badge--${tone}">${esc(text)}</span>`;
}

export function cellValue(col: CellSpec, raw: unknown): string {
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

/* ----------------------------------------------------------------- states */

export function skeletonBody(cols: number, count = 6): string {
  const widths = ["70%", "45%", "55%", "40%", "60%", "35%", "50%", "45%", "30%"];
  const row = (i: number): string =>
    `<tr>${Array.from({ length: cols }, (_, c) => {
      const w = widths[(i + c) % widths.length];
      return `<td><span class="pb-skeleton" style="display:block;height:14px;width:${w}"></span></td>`;
    }).join("")}</tr>`;
  return `<tbody>${Array.from({ length: count }, (_, i) => row(i)).join("")}</tbody>`;
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

export function demoState(label: string, iconName: Parameters<typeof icon>[0] = "monitor"): string {
  return `<div class="pb-empty">
    <span class="pb-empty__icon">${icon(iconName)}</span>
    <div class="pb-empty__title">โหมดสาธิตไม่ได้เชื่อมต่อ PenbunAPI</div>
    <p class="pb-empty__text">หน้า${esc(label)}อ่านข้อมูลจริงจาก PenbunAPI เท่านั้น
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
  const btn = (n: number): string =>
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
