/**
 * mock.ts — sample data shaped like the PenbunAPI v4 responses.
 * Everything here is fake. Swap each export for a fetch() when the API lands.
 */

export interface RouteRow {
  code: string;
  name: string;
  stops: Array<"done" | "active" | "todo" | "late">;
  loaded: number; // 0–1
  value: number;
  vehicle: string;
}

export const routes: RouteRow[] = [
  { code: "R-01", name: "สายเหนือ – นนทบุรี", stops: ["done", "done", "done", "active", "todo", "todo"], loaded: 0.62, value: 184320, vehicle: "ทะเบียน 1กก-4471" },
  { code: "R-02", name: "สายตะวันออก – ชลบุรี", stops: ["done", "done", "active", "todo", "todo"], loaded: 0.44, value: 129850, vehicle: "ทะเบียน 2ขค-9930" },
  { code: "R-03", name: "สายใต้ – สมุทรสาคร", stops: ["done", "done", "done", "done", "done"], loaded: 1, value: 96240, vehicle: "ทะเบียน 3งจ-1120" },
  { code: "R-04", name: "สายกลาง – กรุงเทพชั้นใน", stops: ["done", "late", "todo", "todo", "todo", "todo", "todo"], loaded: 0.18, value: 212760, vehicle: "ทะเบียน 4ฉช-7781" },
  { code: "R-05", name: "สายอีสาน – นครราชสีมา", stops: ["done", "done", "active", "todo"], loaded: 0.55, value: 143910, vehicle: "ทะเบียน 5ญฐ-2205" },
];

export const salesLabels = [
  "1 ส.ค.", "3", "5", "7", "9", "11", "13", "15", "17", "19", "21", "23",
];

export const salesThisMonth = [
  182_000, 214_500, 168_300, 245_900, 281_400, 236_700, 298_100, 312_400, 274_600, 331_200, 348_900, 372_500,
];

export const salesLastMonth = [
  164_000, 178_200, 191_400, 203_800, 219_600, 226_100, 241_900, 255_300, 248_700, 269_400, 284_100, 292_800,
];

export interface DocRow {
  id: string;
  type: string;
  party: string;
  route: string;
  date: string;
  amount: number;
  status: "posted" | "draft" | "pending" | "void";
}

export const documents: DocRow[] = [
  { id: "ORD-2569-0912", type: "ใบสั่งขาย", party: "ร้านหนังสือบ้านสวน", route: "R-01", date: "2026-08-23T09:12:00", amount: 42_180, status: "posted" },
  { id: "RCV-2569-0182", type: "ใบรับสินค้า", party: "สนพ. อมรินทร์พริ้นติ้ง", route: "—", date: "2026-08-23T08:40:00", amount: 318_600, status: "posted" },
  { id: "ORD-2569-0911", type: "ใบสั่งขาย", party: "ศึกษาภัณฑ์ นครปฐม", route: "R-04", date: "2026-08-22T17:05:00", amount: 88_940, status: "pending" },
  { id: "RTN-2569-0064", type: "ใบคืนสินค้า", party: "ร้านเครื่องเขียนแสงทอง", route: "R-02", date: "2026-08-22T15:22:00", amount: -12_400, status: "posted" },
  { id: "ORD-2569-0910", type: "ใบสั่งขาย", party: "สหกรณ์โรงเรียนวัดไผ่", route: "R-05", date: "2026-08-22T11:48:00", amount: 27_350, status: "draft" },
  { id: "VRT-2569-0021", type: "ใบคืนผู้ขาย", party: "สนพ. นานมีบุ๊คส์", route: "—", date: "2026-08-21T16:03:00", amount: -64_720, status: "void" },
  { id: "ORD-2569-0909", type: "ใบสั่งขาย", party: "ร้านหนังสือดวงกมล สาขา 3", route: "R-03", date: "2026-08-21T10:15:00", amount: 156_800, status: "posted" },
];

export const statusMeta: Record<DocRow["status"], { label: string; cls: string }> = {
  posted: { label: "ผ่านรายการ", cls: "pb-badge--pos" },
  pending: { label: "รอตรวจสอบ", cls: "pb-badge--warn" },
  draft: { label: "ฉบับร่าง", cls: "pb-badge--muted" },
  void: { label: "ยกเลิก", cls: "pb-badge--neg" },
};

export interface BarRow {
  name: string;
  meta: string;
  value: number;
}

export const topProducts: BarRow[] = [
  { name: "แบบฝึกหัดคณิตศาสตร์ ป.4 (ฉบับปรับปรุง)", meta: "หมวดหนังสือเรียน · SKU BK-10241", value: 1_284 },
  { name: "สมุดเส้นบรรทัด 70 แกรม 40 แผ่น", meta: "หมวดเครื่องเขียน · SKU ST-2210", value: 1_042 },
  { name: "ปากกาหมึกเจล 0.5 มม. (แพ็ก 12)", meta: "หมวดเครื่องเขียน · SKU ST-3388", value: 868 },
  { name: "หนังสืออ่านนอกเวลา ม.ต้น ชุดที่ 2", meta: "หมวดหนังสือทั่วไป · SKU BK-77120", value: 640 },
  { name: "กล่องบรรจุหนังสือ ขนาด M", meta: "หมวดบรรจุภัณฑ์ · SKU PK-0042", value: 512 },
];

export const stockMix = [
  { label: "หนังสือเรียน", value: 18_420, color: "var(--pb-brand)" },
  { label: "เครื่องเขียน", value: 12_060, color: "var(--pb-pos)" },
  { label: "หนังสือทั่วไป", value: 7_940, color: "#708994" },
  { label: "บรรจุภัณฑ์", value: 3_180, color: "var(--pb-text-3)" },
];

export interface ActivityRow {
  title: string;
  meta: string;
  kind: "brand" | "pos" | "neg" | "";
  iconName: string;
}

export const activity: ActivityRow[] = [
  { title: "รับสินค้าเข้าคลัง DC-01 จำนวน 4,200 ชิ้น", meta: "RCV-2569-0182 · 08:40 น.", kind: "pos", iconName: "inbox" },
  { title: "สาย R-04 แจ้งจุดส่งล่าช้า 1 จุด", meta: "ร้านศึกษาภัณฑ์ สาขาบางแค · 09:05 น.", kind: "neg", iconName: "alert" },
  { title: "ปิดยอดฝากขายรอบเดือน ส.ค. สาย R-03", meta: "18 ร้านค้า · 10:22 น.", kind: "brand", iconName: "handshake" },
  { title: "ปรับปรุงยอดสต็อกจากการตรวจนับ 32 รายการ", meta: "คลัง WH-02 · 11:47 น.", kind: "", iconName: "boxes" },
  { title: "อนุมัติส่วนลดพิเศษระดับลูกค้า 6 ราย", meta: "ฝ่ายขาย · 13:10 น.", kind: "brand", iconName: "tag" },
];

export interface StockAlert {
  sku: string;
  name: string;
  onHand: number;
  reorder: number;
}

export const lowStock: StockAlert[] = [
  { sku: "ST-2210", name: "สมุดเส้นบรรทัด 70 แกรม 40 แผ่น", onHand: 240, reorder: 800 },
  { sku: "BK-10241", name: "แบบฝึกหัดคณิตศาสตร์ ป.4", onHand: 96, reorder: 500 },
  { sku: "PK-0042", name: "กล่องบรรจุหนังสือ ขนาด M", onHand: 58, reorder: 300 },
  { sku: "ST-3388", name: "ปากกาหมึกเจล 0.5 มม. (แพ็ก 12)", onHand: 312, reorder: 600 },
];

export interface NoticeRow {
  title: string;
  meta: string;
  kind: "brand" | "pos" | "neg";
  at: Date;
}

/** Sample notifications shown in the topbar bell dropdown. */
export const notices: NoticeRow[] = [
  { title: "สต็อกต่ำกว่าจุดสั่งซื้อ 12 รายการ", meta: "คลัง DC-01", kind: "neg", at: new Date(Date.now() - 12 * 6e4) },
  { title: "ใบรับสินค้า RCV-2569-0182 ผ่านการตรวจรับ", meta: "สนพ. อมรินทร์", kind: "pos", at: new Date(Date.now() - 95 * 6e4) },
  { title: "สาย 3 ปิดยอดฝากขายรอบเดือน", meta: "ร้านค้า 18 แห่ง", kind: "brand", at: new Date(Date.now() - 5 * 36e5) },
];
