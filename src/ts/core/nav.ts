/**
 * nav.ts — the menu, defined once.
 * `id` must match the `data-page` attribute on each page's root element.
 */

import type { IconName } from "./icons.js";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: IconName;
  count?: number;
  alert?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    label: "ภาพรวม",
    items: [
      { id: "dashboard", label: "แดชบอร์ด", href: "/dashboard.html", icon: "dashboard" },
      { id: "reports", label: "รายงาน", href: "/reports.html", icon: "chart" },
    ],
  },
  {
    label: "สินค้าและสต็อก",
    items: [
      { id: "products", label: "สินค้า", href: "/products.html", icon: "book" },
      { id: "stock", label: "สต็อกคงเหลือ", href: "/stock.html", icon: "boxes", count: 12, alert: true },
      { id: "movements", label: "ความเคลื่อนไหวสต็อก", href: "/movements.html", icon: "history" },
      { id: "warehouses", label: "คลังสินค้า", href: "/warehouses.html", icon: "warehouse" },
      { id: "transfers", label: "โอนย้ายระหว่างคลัง", href: "/transfers.html", icon: "swap" },
    ],
  },
  {
    label: "เอกสาร",
    items: [
      { id: "receive", label: "ใบรับสินค้า", href: "/doc-receive.html", icon: "inbox" },
      { id: "orders", label: "ใบสั่งขาย", href: "/doc-order.html", icon: "file", count: 8 },
      { id: "returns", label: "ใบคืนสินค้า", href: "/doc-return.html", icon: "refresh" },
      { id: "vendor-returns", label: "ใบคืนผู้ขาย", href: "/doc-vendor-return.html", icon: "arrowLeft" },
    ],
  },
  {
    label: "การจัดจำหน่าย",
    items: [
      { id: "routes", label: "สาย / เส้นทาง", href: "/routes.html", icon: "truck" },
      { id: "consignment", label: "ฝากขาย", href: "/consignment.html", icon: "handshake", count: 3 },
      { id: "allocation", label: "ดึงจากประวัติ", href: "/allocation.html", icon: "history" },
    ],
  },
  {
    label: "คู่ค้า",
    items: [
      { id: "vendors", label: "ผู้ขาย / สำนักพิมพ์", href: "/vendors.html", icon: "store" },
      { id: "customers", label: "ลูกค้า / ร้านค้า", href: "/customers.html", icon: "users" },
      { id: "discounts", label: "โครงสร้างส่วนลด", href: "/discounts.html", icon: "tag" },
    ],
  },
  {
    label: "ระบบ",
    items: [
      { id: "users", label: "ผู้ใช้และสิทธิ์", href: "/users.html", icon: "shield" },
      { id: "settings", label: "ตั้งค่าระบบ", href: "/settings.html", icon: "settings" },
    ],
  },
];

/** Flat lookup for breadcrumbs and page titles. */
export const NAV_INDEX: Record<string, NavItem> = Object.fromEntries(
  NAV.flatMap((g) => g.items.map((i) => [i.id, i]))
);

export function groupOf(id: string): string | undefined {
  return NAV.find((g) => g.items.some((i) => i.id === id))?.label;
}
