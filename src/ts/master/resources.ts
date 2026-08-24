/**
 * master/resources.ts — the 18 master screens, declared once.
 *
 * One entry per descriptor in PenbunAPI `internal/resources/registry.go`,
 * in the same order, so the two files can be read side by side. Adding a
 * resource on the server means adding one entry here plus one thin HTML file
 * — no markup, no fetch code, no form.
 *
 * Column keys are the columns the resource's `Source` actually returns. For
 * the twelve resources still served from a derived table, that list is the
 * SELECT inside the Go descriptor; for the six with a real view it is the
 * view definition in PenbunSQL v7. Naming a column that the source does not
 * return prints "—" forever and nothing complains, so they are checked
 * against the source, not guessed from the table.
 */

import type { FilterDef, MasterResource } from "./schema.js";

/* --------------------------------------------------------------- shared */

/** Audit columns every resource but customer-route carries. */
const STATUS_COL = {
  key: "is_active",
  label: "สถานะ",
  kind: "bool" as const,
  labels: { "true": "ใช้งาน", "false": "พักการใช้งาน" },
};

const UPDATED_COL = { key: "update_date", label: "แก้ไขล่าสุด", kind: "date" as const, sort: "updated" };

const DESC_FIELD = {
  name: "description",
  kind: "string" as const,
  label: "คำอธิบาย",
  maxLen: 255,
  multiline: true,
  wide: true,
};

const PROVINCE_FILTER: FilterDef = { param: "province", label: "จังหวัด", free: true };

/** CK_tb_warehouse_type, CK_tb_route_type, CK_tb_vendor_trade_type of v7. */
const WAREHOUSE_TYPES = ["DC", "BRANCH", "RETURN", "DAMAGED", "PROVINCE", "INTERNATIONAL"] as const;
const WAREHOUSE_TYPE_LABEL: Record<string, string> = {
  DC: "ศูนย์กระจายสินค้า",
  BRANCH: "คลังสาขา",
  RETURN: "คลังรับคืน",
  DAMAGED: "คลังของชำรุด",
  PROVINCE: "คลังต่างจังหวัด",
  INTERNATIONAL: "คลังต่างประเทศ",
};

const ROUTE_TYPES = ["LEGACY_LINE", "REGION", "DAILY"] as const;
const ROUTE_TYPE_LABEL: Record<string, string> = {
  LEGACY_LINE: "สายเดิม",
  REGION: "ตามภาค",
  DAILY: "รายวัน",
};

const TRADE_TYPES = ["BUY", "CONSIGN"] as const;
const TRADE_TYPE_LABEL: Record<string, string> = { BUY: "ซื้อขาด", CONSIGN: "ฝากขาย" };

const enumFilter = (param: string, label: string, values: readonly string[], labels: Record<string, string>): FilterDef => ({
  param,
  label,
  options: values.map((v) => ({ value: v, label: labels[v] ?? v })),
});

/* ═══════════════════════════════════ Layer 1 · reference tables ═════════ */

export const COMPANY: MasterResource = {
  page: "company",
  name: "company",
  label: "บริษัท",
  group: "ข้อมูลพื้นฐาน",
  subtitle: "นิติบุคคลที่ออกเอกสารและเป็นเจ้าของคลัง",
  icon: "building",
  idKey: "company_id",
  titleKey: "name_th",
  refMeta: "company_code",
  audit: true,
  searchable: true,
  defaultSort: "name",
  defaultAsc: true,
  columns: [
    { key: "name_th", label: "บริษัท", sort: "name", meta: "company_code" },
    { key: "name_en", label: "ชื่อภาษาอังกฤษ" },
    { key: "tax_id", label: "เลขผู้เสียภาษี", kind: "code" },
    { key: "province", label: "จังหวัด" },
    { key: "phone", label: "โทรศัพท์" },
    UPDATED_COL,
    STATUS_COL,
  ],
  fields: [
    { name: "company_code", kind: "string", label: "รหัสบริษัท", required: true, maxLen: 20, noUpdate: true },
    { name: "name_th", kind: "string", label: "ชื่อภาษาไทย", required: true, maxLen: 200, wide: true },
    { name: "name_en", kind: "string", label: "ชื่อภาษาอังกฤษ", maxLen: 200, wide: true },
    { name: "tax_id", kind: "string", label: "เลขประจำตัวผู้เสียภาษี", maxLen: 20 },
    { name: "branch_code", kind: "string", label: "รหัสสาขา", maxLen: 10 },
    { name: "branch_name", kind: "string", label: "ชื่อสาขา", maxLen: 100 },
    { name: "address", kind: "string", label: "ที่อยู่", maxLen: 255, multiline: true, wide: true },
    { name: "province", kind: "string", label: "จังหวัด", maxLen: 100 },
    { name: "zip_code", kind: "string", label: "รหัสไปรษณีย์", maxLen: 10 },
    { name: "phone", kind: "string", label: "โทรศัพท์", maxLen: 30 },
    { name: "email", kind: "string", label: "อีเมล", maxLen: 150 },
    { name: "website", kind: "string", label: "เว็บไซต์", maxLen: 150 },
  ],
};

export const CUSTOMER_TYPE: MasterResource = {
  page: "customer-types",
  name: "customer-type",
  label: "ประเภทลูกค้า",
  group: "ข้อมูลพื้นฐาน",
  subtitle: "จัดกลุ่มลูกค้าและกำหนดเครดิตพื้นฐานของกลุ่ม",
  icon: "userPlus",
  idKey: "customer_type_id",
  titleKey: "type_name",
  audit: true,
  searchable: true,
  defaultSort: "updated",
  columns: [
    { key: "type_name", label: "ประเภทลูกค้า", sort: "name", meta: "customer_type_id" },
    { key: "description", label: "คำอธิบาย" },
    { key: "base_credit_day", label: "เครดิตพื้นฐาน (วัน)", kind: "qty" },
    UPDATED_COL,
    STATUS_COL,
  ],
  fields: [
    { name: "type_name", kind: "string", label: "ชื่อประเภท", required: true, maxLen: 100 },
    { name: "base_credit_day", kind: "int", label: "เครดิตพื้นฐาน (วัน)", hint: "ใช้เป็นค่าตั้งต้นของลูกค้าในกลุ่มนี้" },
    DESC_FIELD,
  ],
};

export const VENDOR_TYPE: MasterResource = {
  page: "vendor-types",
  name: "vendor-type",
  label: "ประเภทคู่ค้า",
  group: "ข้อมูลพื้นฐาน",
  subtitle: "จัดกลุ่มสำนักพิมพ์ ผู้ผลิต และผู้จัดจำหน่าย",
  icon: "briefcase",
  idKey: "vendor_type_id",
  titleKey: "type_name",
  audit: true,
  searchable: true,
  defaultSort: "updated",
  columns: [
    { key: "type_name", label: "ประเภทคู่ค้า", sort: "name", meta: "vendor_type_id" },
    { key: "description", label: "คำอธิบาย" },
    UPDATED_COL,
    STATUS_COL,
  ],
  fields: [
    { name: "type_name", kind: "string", label: "ชื่อประเภท", required: true, maxLen: 100 },
    DESC_FIELD,
  ],
};

export const DISCOUNT_TYPE: MasterResource = {
  page: "discount-types",
  name: "discount-type",
  label: "ประเภทส่วนลด",
  group: "ข้อมูลพื้นฐาน",
  subtitle: "แยกส่วนลดตามเงื่อนไข เช่น ตามยอด ตามกลุ่ม หรือตามช่วงเวลา",
  icon: "percent",
  idKey: "discount_type_id",
  titleKey: "discount_type_name",
  audit: true,
  searchable: true,
  defaultSort: "updated",
  columns: [
    { key: "discount_type_name", label: "ประเภทส่วนลด", sort: "name", meta: "discount_type_id" },
    { key: "description", label: "คำอธิบาย" },
    UPDATED_COL,
    STATUS_COL,
  ],
  fields: [
    { name: "discount_type_name", kind: "string", label: "ชื่อประเภทส่วนลด", required: true, maxLen: 100 },
    DESC_FIELD,
  ],
};

export const PRODUCT_CATEGORY: MasterResource = {
  page: "product-categories",
  name: "product-category",
  label: "หมวดสินค้า",
  group: "ข้อมูลพื้นฐาน",
  subtitle: "ชั้นบนสุดของผังสินค้า — หมวดคุมกลุ่ม กลุ่มคุมสินค้า",
  icon: "folder",
  idKey: "product_category_id",
  titleKey: "category_name",
  refMeta: "category_code",
  audit: true,
  searchable: true,
  defaultSort: "name",
  defaultAsc: true,
  columns: [
    { key: "category_name", label: "หมวดสินค้า", sort: "name", meta: "category_code" },
    { key: "description", label: "คำอธิบาย" },
    UPDATED_COL,
    STATUS_COL,
  ],
  fields: [
    { name: "category_code", kind: "string", label: "รหัสหมวด", required: true, maxLen: 20 },
    { name: "category_name", kind: "string", label: "ชื่อหมวด", required: true, maxLen: 100 },
    DESC_FIELD,
  ],
};

export const PRODUCT_FORMAT_TYPE: MasterResource = {
  page: "product-formats",
  name: "product-format-type",
  label: "รูปแบบสินค้า",
  group: "ข้อมูลพื้นฐาน",
  subtitle: "รูปเล่มหรือบรรจุภัณฑ์ เช่น ปกอ่อน ปกแข็ง กล่อง",
  icon: "copy",
  idKey: "product_format_type_id",
  titleKey: "format_name",
  audit: true,
  searchable: true,
  defaultSort: "updated",
  columns: [
    { key: "format_name", label: "รูปแบบสินค้า", sort: "name", meta: "product_format_type_id" },
    { key: "description", label: "คำอธิบาย" },
    UPDATED_COL,
    STATUS_COL,
  ],
  fields: [
    { name: "format_name", kind: "string", label: "ชื่อรูปแบบ", required: true, maxLen: 100 },
    DESC_FIELD,
  ],
};

export const UNIT_TYPE: MasterResource = {
  page: "unit-types",
  name: "unit-type",
  label: "หน่วยนับ",
  group: "ข้อมูลพื้นฐาน",
  subtitle: "หน่วยที่ใช้นับสินค้าในเอกสารและในสต็อก",
  icon: "ruler",
  idKey: "unit_type_id",
  titleKey: "unit_type_name",
  audit: true,
  searchable: true,
  defaultSort: "updated",
  columns: [
    { key: "unit_type_name", label: "หน่วยนับ", sort: "name", meta: "unit_type_id" },
    { key: "description", label: "คำอธิบาย" },
    UPDATED_COL,
    STATUS_COL,
  ],
  fields: [
    { name: "unit_type_name", kind: "string", label: "ชื่อหน่วยนับ", required: true, maxLen: 100 },
    DESC_FIELD,
  ],
};

export const BOOK_TYPE: MasterResource = {
  page: "book-types",
  name: "book-type",
  label: "ประเภทหนังสือ",
  group: "ข้อมูลพื้นฐาน",
  subtitle: "แยกหนังสือเรียน นิตยสาร และหนังสือทั่วไป",
  icon: "bookmark",
  idKey: "book_type_id",
  titleKey: "type_name",
  audit: true,
  searchable: true,
  defaultSort: "updated",
  columns: [
    { key: "type_name", label: "ประเภทหนังสือ", sort: "name", meta: "book_type_id" },
    { key: "description", label: "คำอธิบาย" },
    UPDATED_COL,
    STATUS_COL,
  ],
  fields: [
    { name: "type_name", kind: "string", label: "ชื่อประเภท", required: true, maxLen: 100 },
    DESC_FIELD,
  ],
};

/* ═══════════════════════════════════ Layer 2 · master data ══════════════ */

export const WAREHOUSE: MasterResource = {
  page: "warehouses",
  name: "warehouse",
  label: "คลังสินค้า",
  group: "สินค้าและสต็อก",
  subtitle: "ศูนย์กระจายสินค้า คลังสาขา และคลังรับคืน",
  icon: "warehouse",
  idKey: "warehouse_id",
  titleKey: "warehouse_name",
  refMeta: "warehouse_code",
  audit: true,
  searchable: true,
  defaultSort: "code",
  defaultAsc: true,
  columns: [
    { key: "warehouse_name", label: "คลังสินค้า", sort: "code", meta: "warehouse_code" },
    { key: "warehouse_type", label: "ประเภท", kind: "badge", tone: "muted", labels: WAREHOUSE_TYPE_LABEL },
    { key: "province", label: "จังหวัด" },
    { key: "company_name", label: "บริษัท" },
    { key: "is_main_dc", label: "คลังหลัก", kind: "bool", labels: { "true": "คลังหลัก", "false": "—" } },
    { key: "allow_negative_stock", label: "ติดลบได้", kind: "bool", labels: { "true": "อนุญาต", "false": "—" } },
    STATUS_COL,
  ],
  filters: [enumFilter("warehouse_type", "ประเภทคลัง", WAREHOUSE_TYPES, WAREHOUSE_TYPE_LABEL), PROVINCE_FILTER],
  refs: [{ field: "company_id", resource: "company", label: "บริษัท" }],
  fields: [
    { name: "warehouse_code", kind: "string", label: "รหัสคลัง", required: true, maxLen: 20, noUpdate: true },
    { name: "warehouse_name", kind: "string", label: "ชื่อคลัง", required: true, maxLen: 150 },
    {
      name: "warehouse_type",
      kind: "string",
      label: "ประเภทคลัง",
      required: true,
      enumValues: WAREHOUSE_TYPES,
      enumLabels: WAREHOUSE_TYPE_LABEL,
    },
    { name: "is_main_dc", kind: "bool", label: "เป็นคลังหลัก" },
    {
      name: "allow_negative_stock",
      kind: "bool",
      label: "อนุญาตให้สต็อกติดลบ",
      hint: "เปิดเมื่อคลังนี้ต้องรับการตัดสต็อกได้แม้ยอดคงเหลือไม่พอ",
    },
    { name: "address", kind: "string", label: "ที่อยู่", maxLen: 255, multiline: true, wide: true },
    { name: "province", kind: "string", label: "จังหวัด", maxLen: 100 },
    DESC_FIELD,
  ],
};

export const PRODUCT_GROUP: MasterResource = {
  page: "product-groups",
  name: "product-group",
  label: "กลุ่มสินค้า",
  group: "ข้อมูลพื้นฐาน",
  subtitle: "ชั้นกลางของผังสินค้า ทุกกลุ่มต้องสังกัดหมวด",
  icon: "apps",
  idKey: "product_group_id",
  titleKey: "product_group_name",
  audit: true,
  searchable: true,
  defaultSort: "updated",
  columns: [
    { key: "product_group_name", label: "กลุ่มสินค้า", sort: "name", meta: "product_group_id" },
    { key: "category_name", label: "หมวดสินค้า" },
    { key: "description", label: "คำอธิบาย" },
    UPDATED_COL,
    STATUS_COL,
  ],
  filters: [{ param: "product_category_id", label: "หมวดสินค้า", resource: "product-category" }],
  refs: [{ field: "product_category_id", resource: "product-category", label: "หมวดสินค้า", required: true }],
  fields: [
    { name: "product_group_name", kind: "string", label: "ชื่อกลุ่มสินค้า", required: true, maxLen: 150 },
    DESC_FIELD,
  ],
};

export const VENDOR: MasterResource = {
  page: "vendors",
  name: "vendor",
  label: "คู่ค้า",
  group: "คู่ค้า",
  subtitle: "สำนักพิมพ์และผู้จัดจำหน่าย พร้อมเงื่อนไขฝากขายที่ใช้คำนวณเงินจ่าย",
  icon: "store",
  idKey: "vendor_id",
  titleKey: "vendor_name",
  audit: true,
  searchable: true,
  defaultSort: "name",
  defaultAsc: true,
  columns: [
    { key: "vendor_name", label: "คู่ค้า", sort: "name", meta: "vendor_id" },
    { key: "vendor_type_name", label: "ประเภท" },
    { key: "trade_type", label: "รูปแบบการค้า", kind: "badge", tone: "brand", labels: TRADE_TYPE_LABEL },
    { key: "consign_share_percent", label: "ส่วนแบ่ง", kind: "percent" },
    { key: "province", label: "จังหวัด" },
    { key: "credit_term_day", label: "เครดิต (วัน)", kind: "qty" },
    STATUS_COL,
  ],
  filters: [
    { param: "vendor_type_id", label: "ประเภทคู่ค้า", resource: "vendor-type" },
    enumFilter("trade_type", "รูปแบบการค้า", TRADE_TYPES, TRADE_TYPE_LABEL),
    PROVINCE_FILTER,
  ],
  refs: [{ field: "vendor_type_id", resource: "vendor-type", label: "ประเภทคู่ค้า", required: true }],
  fields: [
    { name: "vendor_name", kind: "string", label: "ชื่อคู่ค้า", required: true, maxLen: 200, wide: true },
    {
      name: "trade_type",
      kind: "string",
      label: "รูปแบบการค้า",
      required: true,
      enumValues: TRADE_TYPES,
      enumLabels: TRADE_TYPE_LABEL,
      hint: "ฝากขายคิดเงินจ่ายจากยอดที่ขายได้จริง ไม่ใช่ยอดที่รับเข้า",
    },
    { name: "tax_id", kind: "string", label: "เลขประจำตัวผู้เสียภาษี", maxLen: 20 },
    { name: "branch_code", kind: "string", label: "รหัสสาขา", maxLen: 10 },
    { name: "branch_name", kind: "string", label: "ชื่อสาขา", maxLen: 100 },
    { name: "contact_person", kind: "string", label: "ผู้ติดต่อ", maxLen: 100 },
    { name: "phone1", kind: "string", label: "โทรศัพท์", maxLen: 30 },
    { name: "phone2", kind: "string", label: "โทรศัพท์สำรอง", maxLen: 30 },
    { name: "email", kind: "string", label: "อีเมล", maxLen: 150 },
    { name: "website", kind: "string", label: "เว็บไซต์", maxLen: 150 },
    { name: "address", kind: "string", label: "ที่อยู่", maxLen: 255, multiline: true, wide: true },
    { name: "sub_district", kind: "string", label: "ตำบล/แขวง", maxLen: 100 },
    { name: "district", kind: "string", label: "อำเภอ/เขต", maxLen: 100 },
    { name: "province", kind: "string", label: "จังหวัด", maxLen: 100 },
    { name: "zip_code", kind: "string", label: "รหัสไปรษณีย์", maxLen: 10 },
    { name: "credit_term_day", kind: "int", label: "เครดิต (วัน)" },
    { name: "currency", kind: "string", label: "สกุลเงิน", maxLen: 10 },
    { name: "consign_share_percent", kind: "decimal", label: "ส่วนแบ่งฝากขาย (%)" },
    { name: "settlement_cycle", kind: "string", label: "รอบจ่ายเงิน", maxLen: 20 },
    { name: "settlement_day", kind: "int", label: "วันที่จ่ายเงิน" },
    { name: "return_window_day", kind: "int", label: "ระยะเวลารับคืน (วัน)" },
    { name: "withholding_tax_percent", kind: "decimal", label: "หัก ณ ที่จ่าย (%)" },
    { name: "bank_name", kind: "string", label: "ธนาคาร", maxLen: 100 },
    { name: "bank_branch", kind: "string", label: "สาขาธนาคาร", maxLen: 100 },
    { name: "bank_account_no", kind: "string", label: "เลขที่บัญชี", maxLen: 30 },
    { name: "bank_account_name", kind: "string", label: "ชื่อบัญชี", maxLen: 150 },
    { name: "note", kind: "string", label: "หมายเหตุ", maxLen: 500, multiline: true, wide: true },
  ],
};

export const CUSTOMER: MasterResource = {
  page: "customers",
  name: "customer",
  label: "ลูกค้า",
  group: "คู่ค้า",
  subtitle: "ร้านค้าปลีก โรงเรียน และสหกรณ์ที่รับสินค้าผ่านสายจัดส่ง",
  icon: "users",
  idKey: "customer_id",
  titleKey: "customer_name",
  refMeta: "customer_code",
  audit: true,
  searchable: true,
  defaultSort: "name",
  defaultAsc: true,
  columns: [
    { key: "customer_name", label: "ลูกค้า", sort: "name", meta: "customer_code" },
    { key: "customer_type_name", label: "ประเภท" },
    { key: "province", label: "จังหวัด" },
    { key: "discount_group", label: "กลุ่มส่วนลด", kind: "badge", tone: "muted" },
    { key: "credit_limit", label: "วงเงินเครดิต", kind: "money" },
    { key: "credit_term_day", label: "เครดิต (วัน)", kind: "qty" },
    STATUS_COL,
  ],
  filters: [
    { param: "customer_type_id", label: "ประเภทลูกค้า", resource: "customer-type" },
    PROVINCE_FILTER,
    { param: "discount_group", label: "กลุ่มส่วนลด", free: true },
  ],
  refs: [{ field: "customer_type_id", resource: "customer-type", label: "ประเภทลูกค้า", required: true }],
  fields: [
    { name: "customer_code", kind: "string", label: "รหัสลูกค้า", maxLen: 20 },
    { name: "customer_name", kind: "string", label: "ชื่อลูกค้า", required: true, maxLen: 200, wide: true },
    { name: "report_name", kind: "string", label: "ชื่อในรายงาน", maxLen: 200, wide: true },
    { name: "tax_id", kind: "string", label: "เลขประจำตัวผู้เสียภาษี", maxLen: 20 },
    { name: "branch_code", kind: "string", label: "รหัสสาขา", maxLen: 10 },
    { name: "branch_name", kind: "string", label: "ชื่อสาขา", maxLen: 100 },
    { name: "contact_person", kind: "string", label: "ผู้ติดต่อ", maxLen: 100 },
    { name: "phone1", kind: "string", label: "โทรศัพท์", maxLen: 30 },
    { name: "phone2", kind: "string", label: "โทรศัพท์สำรอง", maxLen: 30 },
    { name: "email", kind: "string", label: "อีเมล", maxLen: 150 },
    { name: "line_id", kind: "string", label: "LINE ID", maxLen: 50 },
    { name: "address", kind: "string", label: "ที่อยู่", maxLen: 255, multiline: true, wide: true },
    { name: "sub_district", kind: "string", label: "ตำบล/แขวง", maxLen: 100 },
    { name: "district", kind: "string", label: "อำเภอ/เขต", maxLen: 100 },
    { name: "province", kind: "string", label: "จังหวัด", maxLen: 100 },
    { name: "zip_code", kind: "string", label: "รหัสไปรษณีย์", maxLen: 10 },
    { name: "credit_limit", kind: "decimal", label: "วงเงินเครดิต" },
    { name: "credit_term_day", kind: "int", label: "เครดิต (วัน)" },
    { name: "is_vat", kind: "bool", label: "จด VAT" },
    { name: "invoice_format", kind: "string", label: "รูปแบบใบกำกับ", maxLen: 20 },
    { name: "discount_group", kind: "string", label: "กลุ่มส่วนลด", maxLen: 20 },
    { name: "note", kind: "string", label: "หมายเหตุ", maxLen: 500, multiline: true, wide: true },
  ],
};

export const DISCOUNT: MasterResource = {
  page: "discounts",
  name: "discount",
  label: "ส่วนลด",
  group: "คู่ค้า",
  subtitle: "โครงสร้างส่วนลดที่ใช้ได้กับใบส่งหนังสือ",
  icon: "tag",
  idKey: "discount_id",
  titleKey: "discount_name",
  refMeta: "discount_code",
  audit: true,
  searchable: true,
  defaultSort: "name",
  defaultAsc: true,
  columns: [
    { key: "discount_name", label: "ส่วนลด", sort: "name", meta: "discount_code" },
    { key: "discount_type_name", label: "ประเภท" },
    { key: "discount_value", label: "มูลค่า", kind: "money" },
    { key: "is_percent", label: "หน่วย", kind: "bool", labels: { "true": "เปอร์เซ็นต์", "false": "บาท" } },
    { key: "min_order_amount", label: "ยอดขั้นต่ำ", kind: "money" },
    { key: "start_date", label: "เริ่มใช้", kind: "date" },
    { key: "end_date", label: "สิ้นสุด", kind: "date" },
    STATUS_COL,
  ],
  filters: [
    { param: "discount_type_id", label: "ประเภทส่วนลด", resource: "discount-type" },
    {
      param: "is_percent",
      label: "หน่วย",
      options: [
        { value: "true", label: "เปอร์เซ็นต์" },
        { value: "false", label: "บาท" },
      ],
    },
  ],
  refs: [{ field: "discount_type_id", resource: "discount-type", label: "ประเภทส่วนลด", required: true }],
  fields: [
    { name: "discount_code", kind: "string", label: "รหัสส่วนลด", required: true, maxLen: 20, noUpdate: true },
    { name: "discount_name", kind: "string", label: "ชื่อส่วนลด", required: true, maxLen: 150 },
    { name: "discount_value", kind: "decimal", label: "มูลค่าส่วนลด", min: 0 },
    { name: "is_percent", kind: "bool", label: "คิดเป็นเปอร์เซ็นต์" },
    { name: "min_order_amount", kind: "decimal", label: "ยอดสั่งซื้อขั้นต่ำ", min: 0 },
    { name: "start_date", kind: "date", label: "วันที่เริ่มใช้" },
    { name: "end_date", kind: "date", label: "วันที่สิ้นสุด" },
    DESC_FIELD,
  ],
};

/* ═══════════════════════════════════ Layer 3 · distribution ═════════════ */

export const ROUTE: MasterResource = {
  page: "routes",
  name: "route",
  label: "สายจัดจำหน่าย",
  group: "การจัดจำหน่าย",
  subtitle: "สายรถและเส้นทางส่งของที่ผูกกับคลังต้นทาง",
  icon: "truck",
  idKey: "route_id",
  titleKey: "route_name",
  refMeta: "route_code",
  audit: true,
  searchable: true,
  defaultSort: "code",
  defaultAsc: true,
  columns: [
    { key: "route_name", label: "สายจัดจำหน่าย", sort: "code", meta: "route_code" },
    { key: "route_type", label: "ชนิดสาย", kind: "badge", tone: "brand", labels: ROUTE_TYPE_LABEL },
    { key: "region_name", label: "ภาค" },
    { key: "warehouse_code", label: "คลังต้นทาง", kind: "code" },
    { key: "sort_order", label: "ลำดับ", kind: "qty", sort: "order" },
    UPDATED_COL,
    STATUS_COL,
  ],
  filters: [
    enumFilter("route_type", "ชนิดสาย", ROUTE_TYPES, ROUTE_TYPE_LABEL),
    { param: "warehouse_id", label: "คลังต้นทาง", resource: "warehouse" },
  ],
  refs: [{ field: "warehouse_id", resource: "warehouse", label: "คลังต้นทาง" }],
  fields: [
    { name: "route_code", kind: "string", label: "รหัสสาย", required: true, maxLen: 20, noUpdate: true },
    { name: "route_name", kind: "string", label: "ชื่อสาย", required: true, maxLen: 150 },
    {
      name: "route_type",
      kind: "string",
      label: "ชนิดสาย",
      required: true,
      enumValues: ROUTE_TYPES,
      enumLabels: ROUTE_TYPE_LABEL,
    },
    { name: "region_name", kind: "string", label: "ภาค", maxLen: 50 },
    { name: "sort_order", kind: "int", label: "ลำดับ", hint: "ลำดับที่สายนี้ปรากฏในรายการและในแผงสาย" },
    DESC_FIELD,
  ],
};

export const CUSTOMER_ROUTE: MasterResource = {
  page: "customer-routes",
  name: "customer-route",
  label: "การผูกลูกค้ากับสาย",
  group: "การจัดจำหน่าย",
  subtitle: "ลูกค้าหนึ่งรายมีสายหลักได้สายเดียว ลำดับจุดจอดกำหนดคิวส่งของ",
  icon: "link",
  idKey: "customer_route_id",
  titleKey: "customer_name",
  // vw_customer_route คืนเฉพาะคอลัมน์ที่ใช้แสดงผล ไม่มี is_active / update_date
  // การกรองหรือแสดงสถานะจึงเป็นการถามหาคอลัมน์ที่ไม่มีอยู่ใน View
  audit: false,
  searchable: false,
  defaultSort: "route",
  defaultAsc: true,
  columns: [
    { key: "customer_name", label: "ลูกค้า", meta: "customer_id" },
    { key: "route_name", label: "สายจัดจำหน่าย", sort: "route", meta: "route_code" },
    { key: "route_type", label: "ชนิดสาย", kind: "badge", tone: "muted", labels: ROUTE_TYPE_LABEL },
    { key: "region_name", label: "ภาค" },
    { key: "is_primary", label: "สายหลัก", kind: "bool", tone: "brand", labels: { "true": "สายหลัก", "false": "สายรอง" } },
    { key: "delivery_seq", label: "ลำดับจุดจอด", kind: "qty", sort: "seq" },
  ],
  filters: [
    { param: "customer_id", label: "ลูกค้า", resource: "customer", big: true },
    { param: "route_code", label: "รหัสสาย", free: true },
    {
      param: "is_primary",
      label: "สายหลัก",
      options: [
        { value: "true", label: "สายหลัก" },
        { value: "false", label: "สายรอง" },
      ],
    },
  ],
  refs: [
    { field: "customer_id", resource: "customer", label: "ลูกค้า", required: true, noUpdate: true, big: true },
    { field: "route_id", resource: "route", label: "สายจัดจำหน่าย", required: true, noUpdate: true },
  ],
  fields: [
    {
      name: "is_primary",
      kind: "bool",
      label: "เป็นสายหลัก",
      hint: "ลูกค้าหนึ่งรายมีสายหลักได้สายเดียว ตั้งซ้ำจะได้รหัส DUPLICATE",
    },
    { name: "delivery_seq", kind: "int", label: "ลำดับจุดจอด" },
    DESC_FIELD,
  ],
};

/* ═══════════════════════════════════ Layer 4–5 · products ═══════════════ */

export const PRODUCT: MasterResource = {
  page: "products",
  name: "product",
  label: "สินค้า",
  group: "สินค้าและสต็อก",
  subtitle: "ตารางเดียวรองรับทั้งของที่นับสต็อกและบริการที่ไม่นับ",
  icon: "package",
  idKey: "product_id",
  titleKey: "product_name",
  refMeta: "product_code",
  audit: true,
  searchable: true,
  defaultSort: "name",
  defaultAsc: true,
  columns: [
    { key: "product_name", label: "สินค้า", sort: "name", meta: "product_code" },
    { key: "category_name", label: "หมวด" },
    { key: "product_group_name", label: "กลุ่ม" },
    { key: "unit_type_name", label: "หน่วย" },
    { key: "vendor_name", label: "คู่ค้า" },
    { key: "cost_price", label: "ราคาทุน", kind: "money" },
    { key: "sell_price", label: "ราคาขาย", kind: "money" },
    { key: "count_stock", label: "นับสต็อก", kind: "bool", labels: { "true": "นับสต็อก", "false": "ไม่นับ" } },
    STATUS_COL,
  ],
  filters: [
    { param: "product_category_id", label: "หมวดสินค้า", resource: "product-category" },
    { param: "product_group_id", label: "กลุ่มสินค้า", resource: "product-group" },
    { param: "vendor_id", label: "คู่ค้า", resource: "vendor", big: true },
    {
      param: "count_stock",
      label: "การนับสต็อก",
      options: [
        { value: "true", label: "นับสต็อก" },
        { value: "false", label: "ไม่นับสต็อก" },
      ],
    },
  ],
  refs: [
    { field: "product_group_id", resource: "product-group", label: "กลุ่มสินค้า", required: true },
    { field: "product_format_type_id", resource: "product-format-type", label: "รูปแบบสินค้า" },
    { field: "unit_type_id", resource: "unit-type", label: "หน่วยนับ" },
    { field: "vendor_id", resource: "vendor", label: "คู่ค้า", big: true },
  ],
  fields: [
    { name: "product_code", kind: "string", label: "รหัสสินค้า", required: true, maxLen: 50 },
    { name: "product_name", kind: "string", label: "ชื่อสินค้า", required: true, maxLen: 250, wide: true },
    {
      name: "count_stock",
      kind: "bool",
      label: "นับสต็อก",
      hint: "ปิดสำหรับบริการ เช่น ค่าส่ง ซึ่งไม่มียอดคงเหลือให้ตัด",
    },
    { name: "cost_price", kind: "decimal", label: "ราคาทุน" },
    { name: "sell_price", kind: "decimal", label: "ราคาขาย" },
    { name: "barcode", kind: "string", label: "บาร์โค้ด", maxLen: 50 },
    { name: "weight_kg", kind: "decimal", label: "น้ำหนัก (กก.)" },
    { name: "pack_qty", kind: "decimal", label: "จำนวนต่อแพ็ก" },
    { name: "description", kind: "string", label: "รายละเอียด", maxLen: 500, multiline: true, wide: true },
  ],
};

export const PRODUCT_SKU: MasterResource = {
  page: "product-skus",
  name: "product-sku",
  label: "SKU",
  group: "สินค้าและสต็อก",
  subtitle: '"ฉบับ" ในภาษาโปรแกรมเดิม — สต็อกทั้งระบบนับที่ระดับนี้ ไม่ใช่ระดับสินค้า',
  icon: "boxes",
  idKey: "sku_id",
  titleKey: "sku_code",
  refMeta: "variation_name",
  audit: true,
  searchable: true,
  defaultSort: "code",
  defaultAsc: true,
  columns: [
    { key: "sku_code", label: "SKU", sort: "code", kind: "code", meta: "variation_name" },
    { key: "product_name", label: "สินค้า", meta: "product_code" },
    { key: "issue_no", label: "ฉบับที่", sort: "issue" },
    { key: "volume_no", label: "เล่มที่" },
    { key: "cover_price", label: "ราคาปก", kind: "money" },
    { key: "sell_price", label: "ราคาขาย", kind: "money" },
    { key: "publication_date", label: "วางแผง", kind: "date" },
    { key: "return_deadline", label: "กำหนดรับคืน", kind: "date" },
    STATUS_COL,
  ],
  filters: [
    { param: "product_id", label: "สินค้า", resource: "product", big: true },
    { param: "issue_no", label: "ฉบับที่", free: true },
  ],
  refs: [{ field: "product_id", resource: "product", label: "สินค้า", required: true, noUpdate: true, big: true, wide: true }],
  fields: [
    { name: "sku_code", kind: "string", label: "รหัส SKU", required: true, maxLen: 50 },
    { name: "variation_name", kind: "string", label: "ชื่อรุ่น/แบบ", maxLen: 150 },
    { name: "barcode", kind: "string", label: "บาร์โค้ด", maxLen: 50 },
    { name: "vendor_part_no", kind: "string", label: "รหัสของคู่ค้า", maxLen: 50 },
    { name: "issue_no", kind: "string", label: "ฉบับที่", maxLen: 30 },
    { name: "volume_no", kind: "string", label: "เล่มที่", maxLen: 30 },
    { name: "edition_label", kind: "string", label: "ครั้งที่พิมพ์", maxLen: 50 },
    { name: "cost_price", kind: "decimal", label: "ราคาทุน" },
    { name: "sell_price", kind: "decimal", label: "ราคาขาย" },
    { name: "cover_price", kind: "decimal", label: "ราคาปก" },
    { name: "pack_qty", kind: "decimal", label: "จำนวนต่อแพ็ก" },
    { name: "publication_date", kind: "date", label: "วันวางแผง" },
    { name: "return_deadline", kind: "date", label: "กำหนดรับคืน" },
    { name: "description", kind: "string", label: "รายละเอียด", maxLen: 500, multiline: true, wide: true },
  ],
};

/**
 * BOOK writes two tables in one transaction, so PenbunAPI keeps POST/PUT/
 * DELETE /book in `internal/domain/book` while GET /book comes from the CRUD
 * engine. Both live at the same path, so the descriptor needs no special case
 * — but the form does: `vw_book` returns neither the product's barcode,
 * weight and pack size nor either description, so those inputs open blank on
 * edit and are sent only when the user fills them in.
 */
export const BOOK: MasterResource = {
  page: "books",
  name: "book",
  label: "หนังสือ",
  group: "สินค้าและสต็อก",
  subtitle: "หนังสือหนึ่งเล่มผูกกับสินค้าหนึ่งแถวเสมอ ระบบสร้างให้พร้อมกัน",
  icon: "book",
  idKey: "book_id",
  titleKey: "book_name",
  audit: true,
  searchable: true,
  defaultSort: "name",
  defaultAsc: true,
  columns: [
    { key: "book_name", label: "หนังสือ", sort: "name", meta: "product_code" },
    { key: "author", label: "ผู้แต่ง", sort: "author" },
    { key: "isbn", label: "ISBN", kind: "code" },
    { key: "book_type_name", label: "ประเภท" },
    { key: "vendor_name", label: "คู่ค้า" },
    { key: "cover_price", label: "ราคาปก", kind: "money" },
    { key: "net_price", label: "ราคาสุทธิ", kind: "money" },
    { key: "effective_date", label: "วันที่มีผล", kind: "date" },
    STATUS_COL,
  ],
  filters: [
    { param: "book_type_id", label: "ประเภทหนังสือ", resource: "book-type" },
    { param: "vendor_id", label: "คู่ค้า", resource: "vendor", big: true },
  ],
  refs: [
    { field: "book_type_id", resource: "book-type", label: "ประเภทหนังสือ", required: true },
    { field: "product_group_id", resource: "product-group", label: "กลุ่มสินค้า", required: true },
    { field: "product_format_type_id", resource: "product-format-type", label: "รูปแบบสินค้า" },
    { field: "unit_type_id", resource: "unit-type", label: "หน่วยนับ" },
    { field: "vendor_id", resource: "vendor", label: "คู่ค้า", big: true },
  ],
  fields: [
    { name: "book_name", kind: "string", label: "ชื่อหนังสือ", required: true, maxLen: 250, wide: true },
    {
      name: "product_code",
      kind: "string",
      label: "รหัสสินค้า",
      required: true,
      maxLen: 50,
      hint: "ระบบสร้างแถวสินค้าให้อัตโนมัติ ชื่อสินค้ายึดตามชื่อหนังสือถ้าไม่ระบุแยก",
    },
    { name: "author", kind: "string", label: "ผู้แต่ง", maxLen: 200 },
    { name: "translator", kind: "string", label: "ผู้แปล", maxLen: 200 },
    { name: "isbn", kind: "string", label: "ISBN", maxLen: 20 },
    { name: "publisher_name", kind: "string", label: "สำนักพิมพ์", maxLen: 200 },
    { name: "page_count", kind: "int", label: "จำนวนหน้า", min: 0 },
    { name: "cover_price", kind: "decimal", label: "ราคาปก", min: 0 },
    { name: "net_price", kind: "decimal", label: "ราคาสุทธิ", min: 0 },
    { name: "vendor_discount_percent", kind: "decimal", label: "ส่วนลดจากคู่ค้า (%)", min: 0 },
    { name: "customer_discount_percent", kind: "decimal", label: "ส่วนลดให้ลูกค้า (%)", min: 0 },
    { name: "effective_date", kind: "date", label: "วันที่มีผล" },
    { name: "sell_price", kind: "decimal", label: "ราคาขาย", min: 0 },
    { name: "cost_price", kind: "decimal", label: "ราคาทุน", min: 0 },
    { name: "barcode", kind: "string", label: "บาร์โค้ด", maxLen: 50 },
    { name: "weight_kg", kind: "decimal", label: "น้ำหนัก (กก.)", min: 0 },
    { name: "pack_qty", kind: "decimal", label: "จำนวนต่อแพ็ก", min: 0 },
    {
      name: "book_description",
      kind: "string",
      label: "รายละเอียดหนังสือ",
      maxLen: 500,
      multiline: true,
      wide: true,
    },
  ],
};

/* ────────────────────────────────────────────────────────────── registry */

/** Same order as resources.All() in PenbunAPI. */
export const MASTERS: MasterResource[] = [
  COMPANY,
  CUSTOMER_TYPE,
  VENDOR_TYPE,
  DISCOUNT_TYPE,
  PRODUCT_CATEGORY,
  PRODUCT_FORMAT_TYPE,
  UNIT_TYPE,
  BOOK_TYPE,
  WAREHOUSE,
  PRODUCT_GROUP,
  VENDOR,
  CUSTOMER,
  DISCOUNT,
  ROUTE,
  CUSTOMER_ROUTE,
  PRODUCT,
  PRODUCT_SKU,
  BOOK,
];

/** Keyed by `data-page`. */
export const MASTER_BY_PAGE: Record<string, MasterResource> = Object.fromEntries(
  MASTERS.map((m) => [m.page, m])
);

/** Keyed by API resource name — how a Ref finds the screen it points at. */
export const MASTER_BY_NAME: Record<string, MasterResource> = Object.fromEntries(
  MASTERS.map((m) => [m.name, m])
);

export const masterForPage = (page: string | undefined): MasterResource | undefined =>
  page ? MASTER_BY_PAGE[page] : undefined;
