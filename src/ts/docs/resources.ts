/**
 * docs/resources.ts — the document screens, declared once.
 *
 * One entry per spec in PenbunAPI `internal/domain/document/specs.go`, field
 * for field. Column keys are the columns `HeaderSource` and `ItemSource`
 * actually select — for all four documents that is still a derived table
 * written inside the Go spec (PENBUN-TODO §2.2), so the SELECT list there is
 * the contract until the views land. Naming a column the source does not
 * return prints "—" forever and nothing complains.
 *
 * Only ใบรับสินค้า is here so far. The other three are the same nine
 * endpoints with different fields, but each carries a rule the engine has to
 * respect first — the delivery note ends at DELIVERED and needs `period_key`
 * for consignment, the return note routes each line to a warehouse by
 * condition — so they land one at a time rather than as a batch of
 * descriptors that look right and behave wrong.
 */

import { TRADE_TYPE_KEY } from "../master/resources.js";
import type { DocSpec } from "./schema.js";

const TRADE_TYPES = ["BUY", "CONSIGN"] as const;
const TRADE_TYPE_LABEL: Record<string, string> = { BUY: "ซื้อขาด", CONSIGN: "ฝากขาย" };

/** doc_no · doc_date · remark are on every document (specs.go → docFields). */
const DOC_NO_FIELD = {
  name: "doc_no",
  kind: "string" as const,
  label: "เลขที่เอกสาร",
  required: true,
  maxLen: 50,
  noUpdate: true,
  hint: "เลขที่บนกระดาษ ไม่ใช่รหัสที่ระบบออกให้",
};

const DOC_DATE_FIELD = { name: "doc_date", kind: "date" as const, label: "วันที่เอกสาร" };

const REMARK_FIELD = {
  name: "remark",
  kind: "string" as const,
  label: "หมายเหตุ",
  maxLen: 500,
  multiline: true,
  wide: true,
};

const ITEM_REMARK_FIELD = { name: "remark", kind: "string" as const, label: "หมายเหตุ", maxLen: 255 };

/* ═══════════════════════════════════════════════ ใบรับสินค้า ═══════════ */

export const RECEIVE_NOTE: DocSpec = {
  page: "receive",
  name: "receive-note",
  label: "ใบรับสินค้า",
  group: "เอกสาร",
  subtitle: "รับหนังสือเข้าคลังจากคู่ค้า ทั้งแบบซื้อขาดและฝากขาย",
  icon: "inbox",
  idKey: "receive_note_id",

  postedStatus: "POSTED",
  postedStatuses: ["POSTED"],
  statuses: ["DRAFT", "CONFIRMED", "POSTED", "CANCELLED"],
  statusStyle: {
    DRAFT: { label: "ร่าง", tone: "muted" },
    CONFIRMED: { label: "ยืนยันแล้ว", tone: "brand" },
    POSTED: { label: "รับเข้าสต็อกแล้ว", tone: "pos" },
    CANCELLED: { label: "ยกเลิก", tone: "neg" },
  },

  postLabel: "รับเข้าสต็อก",
  postWarning:
    "ระบบจะเพิ่มยอดสต็อกตามรายการในเอกสารนี้ทันที บัญชีการเคลื่อนไหวสต็อกเป็นแบบเพิ่มอย่างเดียว " +
    "เอกสารที่รับเข้าแล้วจึงยกเลิกไม่ได้ ต้องออกเอกสารกลับรายการซึ่งยังไม่มีในระบบ",

  columns: [
    { key: "doc_no", label: "เลขที่เอกสาร", kind: "code" },
    { key: "doc_date", label: "วันที่", kind: "date" },
    { key: "vendor_name", label: "คู่ค้า" },
    { key: "warehouse_name", label: "คลังปลายทาง" },
    { key: "trade_type", label: "รูปแบบการค้า", kind: "badge", tone: "brand", labels: TRADE_TYPE_LABEL },
    { key: "total_qty", label: "จำนวนรวม", kind: "qty" },
    { key: "total_amount", label: "มูลค่ารวม", kind: "money" },
  ],

  itemColumns: [
    { key: "sku_code", label: "SKU", kind: "code" },
    { key: "product_name", label: "สินค้า" },
    { key: "issue_no", label: "ฉบับที่" },
    { key: "qty", label: "จำนวน", kind: "qty" },
    { key: "unit_cost", label: "ราคาทุน/หน่วย", kind: "money" },
    { key: "cover_price", label: "ราคาปก", kind: "money" },
    { key: "amount", label: "มูลค่า", kind: "money" },
    { key: "remark", label: "หมายเหตุ" },
  ],

  headerRefs: [
    { field: "vendor_id", resource: "vendor", label: "คู่ค้า", required: true, big: true },
    { field: "warehouse_id", resource: "warehouse", label: "คลังปลายทาง", required: true },
    { field: "company_id", resource: "company", label: "บริษัท" },
  ],
  headerFields: [
    DOC_NO_FIELD,
    DOC_DATE_FIELD,
    {
      name: "trade_type",
      kind: "string",
      label: "รูปแบบการค้า",
      enumKey: TRADE_TYPE_KEY,
      enumValues: TRADE_TYPES,
      enumLabels: TRADE_TYPE_LABEL,
      // specs.go says this in as many words: getting it wrong makes the whole
      // period's settlement to the owner wrong, so the screen fills it from
      // the chosen vendor and lets the user see it before saving.
      hint: "เติมให้อัตโนมัติจากคู่ค้าที่เลือก แก้ได้ก่อนบันทึก",
    },
    { name: "vendor_doc_no", kind: "string", label: "เลขที่เอกสารของคู่ค้า", maxLen: 50 },
    REMARK_FIELD,
  ],

  itemRefs: [{ field: "sku_id", resource: "product-sku", label: "SKU", required: true, big: true }],
  itemFields: [
    { name: "qty", kind: "decimal", label: "จำนวน", required: true, min: 0 },
    { name: "unit_cost", kind: "decimal", label: "ราคาทุน/หน่วย", required: true, min: 0 },
    { name: "cover_price", kind: "decimal", label: "ราคาปก", min: 0 },
    ITEM_REMARK_FIELD,
  ],

  filters: [
    { param: "vendor_id", label: "คู่ค้า", resource: "vendor", big: true },
    {
      param: "trade_type",
      label: "รูปแบบการค้า",
      enumKey: TRADE_TYPE_KEY,
      enumLabels: TRADE_TYPE_LABEL,
      options: TRADE_TYPES.map((v) => ({ value: v, label: TRADE_TYPE_LABEL[v] })),
    },
    // The filter matches vw/derived column `warehouse_code`, not warehouse_id,
    // so it cannot reuse the warehouse picker — that one answers business IDs.
    { param: "warehouse_code", label: "รหัสคลัง", free: true },
  ],
};

export const DOCS: DocSpec[] = [RECEIVE_NOTE];

export const DOC_BY_NAME: Record<string, DocSpec> = Object.fromEntries(DOCS.map((d) => [d.name, d]));

/** The screen for one `data-page`, or nothing when the page is not a document. */
export const docForPage = (page: string | undefined): DocSpec | undefined =>
  DOCS.find((d) => d.page === page);
