/** format.ts — one place for every number and date the UI prints. */

const th = "th-TH";

export const money = (v: number, digits = 2): string =>
  v.toLocaleString(th, { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const baht = (v: number, digits = 2): string => `฿${money(v, digits)}`;

export const compact = (v: number): string =>
  v.toLocaleString(th, { notation: "compact", maximumFractionDigits: 1 });

export const qty = (v: number): string => v.toLocaleString(th);

export const pct = (v: number, digits = 1): string => `${v.toFixed(digits)}%`;

export const signed = (v: number, digits = 1): string =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits)}%`;

export const date = (d: Date | string): string =>
  new Date(d).toLocaleDateString(th, { day: "2-digit", month: "short", year: "numeric" });

export const dateTime = (d: Date | string): string =>
  new Date(d).toLocaleString(th, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const timeAgo = (d: Date | string): string => {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return "เมื่อครู่";
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
  return `${Math.floor(diff / 86400)} วันที่แล้ว`;
};

/** HTML-escape for anything interpolated into a template string. */
export const esc = (s: unknown): string =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
