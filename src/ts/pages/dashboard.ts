/**
 * dashboard.ts — populates the dashboard cards.
 * The HTML holds empty card shells; every figure is injected here so the
 * swap to real API data is a one-file change.
 */

import { renderArea, renderDonut } from "../core/charts.js";
import { icon } from "../core/icons.js";
import { baht, compact, esc, money, qty, timeAgo } from "../core/format.js";
import {
  activity,
  documents,
  lowStock,
  routes,
  salesLabels,
  salesLastMonth,
  salesThisMonth,
  statusMeta,
  stockMix,
  topProducts,
} from "../data/mock.js";

function el<T extends HTMLElement>(sel: string): T | null {
  return document.querySelector<T>(sel);
}

/* ------------------------------------------------- signature: route rail */
function rail(): void {
  const host = el("#pb-rail");
  if (!host) return;
  host.innerHTML = routes
    .map((r) => {
      const done = r.stops.filter((s) => s === "done").length;
      return `
      <div class="pb-rail__row">
        <div class="pb-rail__id">
          <span class="pb-rail__code">${esc(r.code)}</span>
          <span class="pb-rail__name" title="${esc(r.vehicle)}">${esc(r.name)}</span>
        </div>
        <div class="pb-rail__track" role="img"
             aria-label="${esc(r.name)} ส่งแล้ว ${done} จาก ${r.stops.length} จุด">
          <span class="pb-rail__line"></span>
          <span class="pb-rail__load" style="width:${(r.loaded * 100).toFixed(0)}%"></span>
          <span class="pb-rail__stops">
            ${r.stops.map((s) => `<span class="pb-rail__stop" data-state="${s}"></span>`).join("")}
          </span>
        </div>
        <div class="pb-rail__meta">
          <strong>${compact(r.value)}</strong>
          ${done}/${r.stops.length} จุด
        </div>
      </div>`;
    })
    .join("");
}

/* ------------------------------------------------------------- kpi cards */
function kpis(): void {
  const total = salesThisMonth.reduce((a, b) => a + b, 0);
  const prev = salesLastMonth.reduce((a, b) => a + b, 0);
  const delta = ((total - prev) / prev) * 100;

  const set = (sel: string, html: string) => {
    const n = el(sel);
    if (n) n.innerHTML = html;
  };

  set("#kpi-sales", baht(total, 0));
  set(
    "#kpi-sales-delta",
    `<span class="pb-delta pb-delta--${delta >= 0 ? "up" : "down"}">${icon(
      delta >= 0 ? "arrowUp" : "arrowDown"
    )}${Math.abs(delta).toFixed(1)}%</span> เทียบเดือนก่อน`
  );
  set("#kpi-orders", qty(318));
  set("#kpi-orders-delta", `<span class="pb-delta pb-delta--up">${icon("arrowUp")}6.4%</span> 8 ใบรอตรวจสอบ`);
  set("#kpi-stock", qty(41_600));
  set("#kpi-stock-delta", `<span class="pb-delta pb-delta--down">${icon("arrowDown")}2.1%</span> 12 รายการต่ำกว่าจุดสั่ง`);
  set("#kpi-consign", baht(1_284_500, 0));
  set("#kpi-consign-delta", `<span class="pb-delta pb-delta--flat">คงที่</span> ค้างเรียกเก็บ 3 ร้าน`);
}

/* ---------------------------------------------------------------- charts */
function charts(): void {
  const area = el("#pb-chart-sales");
  if (area) {
    renderArea(area, {
      labels: salesLabels,
      series: [
        { name: "เดือนนี้", values: salesThisMonth, variant: "brand" },
        { name: "เดือนก่อน", values: salesLastMonth, variant: "muted" },
      ],
      fmt: (v) => compact(v),
    });
  }

  const donut = el("#pb-donut-stock");
  if (donut) {
    renderDonut(donut, stockMix, "ชิ้นในคลัง");
    const list = el("#pb-donut-list");
    if (list) {
      list.innerHTML = stockMix
        .map(
          (s) => `<div class="pb-donut__row">
            <span class="pb-legend__swatch" style="background:${s.color}"></span>
            <span>${esc(s.label)}</span>
            <span class="pb-donut__value">${qty(s.value)}</span>
          </div>`
        )
        .join("");
    }
  }
}

/* ----------------------------------------------------------- top sellers */
function bars(): void {
  const host = el("#pb-topproducts");
  if (!host) return;
  const max = Math.max(...topProducts.map((p) => p.value));
  host.innerHTML = topProducts
    .map(
      (p) => `
    <div class="pb-barlist__item">
      <div class="pb-barlist__head">
        <span class="pb-barlist__name">${esc(p.name)}</span>
        <span class="pb-barlist__value">${qty(p.value)}</span>
      </div>
      <div class="pb-meter"><span class="pb-meter__fill" style="width:${((p.value / max) * 100).toFixed(0)}%"></span></div>
      <div class="pb-barlist__meta">${esc(p.meta)}</div>
    </div>`
    )
    .join("");
}

/* ------------------------------------------------------------- documents */
function docs(): void {
  const body = el("#pb-docs-body");
  if (!body) return;
  body.innerHTML = documents
    .map((d) => {
      const st = statusMeta[d.status];
      const neg = d.amount < 0;
      return `
      <tr>
        <td>
          <div class="pb-cell-main">
            <span class="pb-thumb">${icon("file")}</span>
            <span class="pb-cell-main__text">
              <span class="pb-cell-main__title">${esc(d.id)}</span>
              <span class="pb-cell-main__meta">${esc(d.type)}</span>
            </span>
          </div>
        </td>
        <td>${esc(d.party)}</td>
        <td><span class="pb-badge pb-badge--muted pb-badge--plain">${esc(d.route)}</span></td>
        <td class="pb-nowrap pb-dim">${timeAgo(d.date)}</td>
        <td data-num class="pb-num ${neg ? "pb-neg" : ""}">${neg ? "−" : ""}${money(Math.abs(d.amount))}</td>
        <td><span class="pb-badge ${st.cls}">${st.label}</span></td>
      </tr>`;
    })
    .join("");
}

/* -------------------------------------------------------------- activity */
function feed(): void {
  const host = el("#pb-activity");
  if (!host) return;
  host.innerHTML = activity
    .map(
      (a) => `
    <div class="pb-timeline__item">
      <span class="pb-timeline__dot${a.kind ? ` pb-timeline__dot--${a.kind}` : ""}">${icon(a.iconName)}</span>
      <div class="pb-timeline__body">
        <div class="pb-timeline__title">${esc(a.title)}</div>
        <div class="pb-timeline__meta">${esc(a.meta)}</div>
      </div>
    </div>`
    )
    .join("");
}

/* ------------------------------------------------------------- low stock */
function alerts(): void {
  const host = el("#pb-lowstock");
  if (!host) return;
  host.innerHTML = lowStock
    .map((s) => {
      const ratio = Math.min(1, s.onHand / s.reorder);
      const crit = ratio < 0.25;
      return `
      <div class="pb-barlist__item">
        <div class="pb-barlist__head">
          <span class="pb-barlist__name">${esc(s.name)}</span>
          <span class="pb-barlist__value ${crit ? "pb-neg" : ""}">${qty(s.onHand)}</span>
        </div>
        <div class="pb-meter">
          <span class="pb-meter__fill ${crit ? "pb-meter__fill--neg" : ""}" style="width:${(ratio * 100).toFixed(0)}%"></span>
        </div>
        <div class="pb-barlist__meta">${esc(s.sku)} · จุดสั่งซื้อ ${qty(s.reorder)}</div>
      </div>`;
    })
    .join("");
}

export function initDashboard(): void {
  kpis();
  rail();
  charts();
  bars();
  docs();
  feed();
  alerts();
  window.addEventListener("penbun:themechange", () => charts());
}
