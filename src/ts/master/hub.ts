/**
 * master/hub.ts — the index of every master-data screen.
 *
 * Twenty tables do not belong in the sidebar; the ones used daily
 * (สินค้า · คลัง · คู่ค้า · ลูกค้า · ส่วนลด · สาย) keep their own menu entry
 * and the rest are reached from here. The list is read from the registry, so
 * a new descriptor shows up without this file changing.
 */

import { esc } from "../core/format.js";
import { icon } from "../core/icons.js";
import { MASTERS } from "./resources.js";
import { writable } from "./schema.js";
import type { MasterResource } from "./schema.js";

/** Display order of the groups. Anything unlisted is appended. */
const GROUP_ORDER = ["ข้อมูลพื้นฐาน", "สินค้าและสต็อก", "คู่ค้า", "การจัดจำหน่าย"];

const card = (m: MasterResource): string =>
  `<a class="pb-mastercard" href="/${esc(m.page)}.html">
    <span class="pb-mastercard__icon">${icon(m.icon)}</span>
    <span class="pb-mastercard__text">
      <span class="pb-mastercard__title">${esc(m.label)}</span>
      <span class="pb-mastercard__sub">${esc(m.subtitle)}</span>
      <span class="pb-mastercard__meta"><span class="pb-mono">/${esc(m.name)}</span>${
        writable(m) ? "" : ' · <span class="pb-muted">อ่านอย่างเดียว</span>'
      }</span>
    </span>
  </a>`;

export function initMasterHub(): void {
  const root = document.getElementById("pb-page");
  if (!root) return;

  const groups = [...new Set(MASTERS.map((m) => m.group))].sort(
    (a, b) => (GROUP_ORDER.indexOf(a) + 1 || 99) - (GROUP_ORDER.indexOf(b) + 1 || 99)
  );

  const sections = groups
    .map((g) => {
      const items = MASTERS.filter((m) => m.group === g).map(card).join("");
      return `<section class="pb-card">
        <div class="pb-card__head"><div>
          <h2 class="pb-card__title">${esc(g)}</h2>
          <p class="pb-card__sub">${MASTERS.filter((m) => m.group === g).length} รายการ</p>
        </div></div>
        <div class="pb-card__body"><div class="pb-mastergrid">${items}</div></div>
      </section>`;
    })
    .join("");

  root.innerHTML = `<div class="pb-pagehead">
    <div class="pb-pagehead__titles">
      <div class="pb-eyebrow">ระบบ</div>
      <h1>ข้อมูลพื้นฐาน</h1>
      <p class="pb-pagehead__sub">ตารางอ้างอิงทั้ง ${MASTERS.length} ชุดที่หน้าจออื่นเรียกใช้
        แก้ที่นี่แล้วมีผลกับทุกเอกสารที่สร้างหลังจากนั้น</p>
    </div>
  </div>
  <div class="pb-stack">${sections}</div>`;
}
