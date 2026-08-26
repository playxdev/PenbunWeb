/**
 * core/address.ts — จังหวัด → อำเภอ/เขต → ตำบล/แขวง → รหัสไปรษณีย์.
 *
 * PenbunSQL keeps an address as four nvarchar columns, not as foreign keys:
 * `province`, `district`, `sub_district`, `zip_code`. So this module is a
 * typing aid, not a reference table — the user picks from real lists and what
 * lands in the payload is the same plain string a text box would have sent.
 * Nothing here talks to PenbunAPI.
 *
 * The lists are static files under `/assets/data/th`, written by
 * `tools/gen_thai_address.mjs` from the source tables in playxdev/iHapWeb:
 *
 *     provinces.json        77 rows, ~4 KB — fetched once per page
 *     province/<id>.json    that province's districts with their
 *                           sub-districts nested, ~8 KB
 *
 * Picking a province is therefore one small request, after which the อำเภอ
 * list, the ตำบล list and every รหัสไปรษณีย์ under it are already in hand.
 * Both are cached by promise, so two forms opened on one page fetch once.
 *
 * Matching an address that is already stored is deliberately forgiving.
 * Rows written before this picker existed hold what somebody typed —
 * "บางรัก" where the canonical name is "เขตบางรัก", "จ.นนทบุรี" where it is
 * "นนทบุรี" — and a select that cannot find its own value would either look
 * empty or silently reassign the row to whatever sat at the top of the list.
 * `sameName` strips the จังหวัด/อำเภอ/เขต/ตำบล/แขวง prefix and the spaces
 * before comparing, and a value that still matches nothing is kept as its own
 * option rather than thrown away.
 */

import { esc } from "./format.js";

/** Which of the four columns a control stands for. */
export type AddressPart = "province" | "district" | "sub_district" | "zip_code";

export interface SubDistrict {
  id: number;
  th: string;
  en: string;
  /** Five digits, as a string: the column is nvarchar(20). */
  zip: string;
}

export interface District {
  id: number;
  th: string;
  en: string;
  subDistricts: SubDistrict[];
}

export interface Province {
  id: number;
  th: string;
  en: string;
}

interface ProvinceTree extends Province {
  districts: District[];
}

const BASE = "/assets/data/th";

/* ------------------------------------------------------------------ load */

let provinceList: Promise<Province[]> | null = null;
const trees = new Map<number, Promise<ProvinceTree>>();

async function readJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** The 77 provinces, sorted by Thai name. Fetched at most once per page. */
export function provinces(): Promise<Province[]> {
  provinceList ??= readJson<Province[]>(`${BASE}/provinces.json`).catch((err: unknown) => {
    provinceList = null; // a failed load must not poison every later attempt
    throw err;
  });
  return provinceList;
}

/** One province with its districts and their sub-districts. */
export function provinceTree(id: number): Promise<ProvinceTree> {
  let tree = trees.get(id);
  if (!tree) {
    tree = readJson<ProvinceTree>(`${BASE}/province/${id}.json`).catch((err: unknown) => {
      trees.delete(id);
      throw err;
    });
    trees.set(id, tree);
  }
  return tree;
}

/* --------------------------------------------------------------- compare */

/**
 * The comparable core of a place name: no prefix, no spaces.
 * "เขตบางรัก", "บางรัก" and "แขวงบางรัก" all reduce to "บางรัก".
 */
export const normalizeName = (raw: unknown): string =>
  String(raw ?? "")
    .trim()
    .replace(/^(จังหวัด|จ\.|อำเภอ|อ\.|เขต|ตำบล|ต\.|แขวง)\s*/u, "")
    .replace(/\s+/gu, "");

/** True when two names denote the same place, prefixes and spacing aside. */
export const sameName = (a: unknown, b: unknown): boolean => {
  const left = normalizeName(a);
  return left !== "" && left === normalizeName(b);
};

const find = <T extends { th: string; en: string }>(list: readonly T[], name: unknown): T | undefined => {
  const wanted = String(name ?? "").trim();
  // Nothing matches nothing: some rows carry an empty English name, and an
  // empty search would otherwise "find" the first of them.
  if (wanted === "") return undefined;
  return (
    list.find((item) => item.th === wanted) ??
    list.find((item) => sameName(item.th, wanted)) ??
    list.find((item) => item.en.toLowerCase() === wanted.toLowerCase())
  );
};

/* ------------------------------------------------------------- rendering */

/** Placeholders, in the order the three selects unlock. */
const PLACEHOLDER: Record<"province" | "district" | "sub_district", string> = {
  province: "เลือกจังหวัด",
  district: "เลือกจังหวัดก่อน",
  sub_district: "เลือกอำเภอก่อน",
};

/**
 * Fill one select with place names, keeping `current` selected.
 *
 * The value of an option is the Thai name, because that is the string the
 * column stores. A `current` the list does not contain is added at the end
 * and kept — see the note at the top of this file.
 */
function fill(sel: HTMLSelectElement, list: ReadonlyArray<{ th: string; en: string }>, current: string): void {
  const match = find(list, current);
  const options = list
    .map((item) => `<option value="${esc(item.th)}"${item === match ? " selected" : ""}>${esc(item.th)}</option>`)
    .join("");
  const part = (sel.dataset.address ?? "province") as "province" | "district" | "sub_district";
  sel.innerHTML = `<option value="">— ${esc(PLACEHOLDER[part])} —</option>${options}`;
  if (match) {
    sel.value = match.th;
  } else if (current !== "") {
    sel.insertAdjacentHTML("beforeend", `<option value="${esc(current)}" selected>${esc(current)}</option>`);
    sel.value = current;
  } else {
    sel.value = "";
  }
  sel.disabled = false;
}

/** A list that could not be loaded still shows what the row holds. */
function failed(sel: HTMLSelectElement, current: string): void {
  sel.innerHTML = `<option value="${esc(current)}">${esc(current || "โหลดรายชื่อไม่สำเร็จ")}</option>`;
  sel.value = current;
  sel.disabled = current === "";
}

/** Nothing to choose from yet: the select waits on the one above it. */
function locked(sel: HTMLSelectElement, part: "district" | "sub_district"): void {
  sel.innerHTML = `<option value="">— ${esc(PLACEHOLDER[part])} —</option>`;
  sel.value = "";
  sel.disabled = true;
}

/* ----------------------------------------------------------------- wire */

/**
 * Turn the address selects inside `root` into one cascade.
 *
 * Called after the markup is in the document — `core/fields.ts` renders the
 * controls with their stored value in `data-value` and leaves them saying
 * "กำลังโหลด…" until this fills them in, the same contract `fillRefSelects`
 * has with a ref picker.
 *
 * Every step below the first is skipped when its control is absent, so a form
 * that carries only `province` still gets its list. Every screen with an
 * address carries the whole cascade since PenbunSQL v10 gave tb_warehouse the
 * three columns it was missing: ลูกค้า · คู่ค้า · บริษัท · คลังสินค้า, and the
 * mock "ข้อมูลองค์กร" card on the settings screen.
 */
export async function wireAddress(root: HTMLElement): Promise<void> {
  const provinceSel = root.querySelector<HTMLSelectElement>('select[data-address="province"]');
  if (!provinceSel) return;

  const districtSel = root.querySelector<HTMLSelectElement>('select[data-address="district"]');
  const subSel = root.querySelector<HTMLSelectElement>('select[data-address="sub_district"]');
  const zip = root.querySelector<HTMLInputElement>('input[data-address="zip_code"]');

  const stored = {
    province: provinceSel.dataset.value ?? "",
    district: districtSel?.dataset.value ?? "",
    sub: subSel?.dataset.value ?? "",
  };

  /** The province tree behind whatever the province select currently holds. */
  let tree: ProvinceTree | null = null;

  const fillSubDistricts = (districtName: string, current: string): void => {
    if (!subSel) return;
    const district = tree ? find(tree.districts, districtName) : undefined;
    if (!district) {
      locked(subSel, "sub_district");
      return;
    }
    fill(subSel, district.subDistricts, current);
  };

  const loadTree = async (provinceName: string, keep: { district: string; sub: string }): Promise<void> => {
    if (!districtSel) return;
    tree = null;
    if (provinceName === "") {
      locked(districtSel, "district");
      if (subSel) locked(subSel, "sub_district");
      return;
    }
    districtSel.innerHTML = '<option value="">กำลังโหลด…</option>';
    districtSel.disabled = true;
    try {
      const list = await provinces();
      const province = find(list, provinceName);
      // A province name that matches nothing — a legacy row, or an option
      // this build does not know — leaves the two lists below it as they are
      // rather than emptying a row that is perfectly valid in the database.
      if (!province) {
        failed(districtSel, keep.district);
        if (subSel) failed(subSel, keep.sub);
        return;
      }
      tree = await provinceTree(province.id);
      fill(districtSel, tree.districts, keep.district);
      fillSubDistricts(districtSel.value, keep.sub);
    } catch {
      failed(districtSel, keep.district);
      if (subSel) failed(subSel, keep.sub);
    }
  };

  provinceSel.addEventListener("change", () => {
    // The user moved the top of the cascade: what sat below it belongs to a
    // different province and is cleared, ไปรษณีย์ included.
    void loadTree(provinceSel.value, { district: "", sub: "" });
    if (zip && !zip.disabled) zip.value = "";
  });

  districtSel?.addEventListener("change", () => {
    fillSubDistricts(districtSel.value, "");
    if (zip && !zip.disabled) zip.value = "";
  });

  subSel?.addEventListener("change", () => {
    if (!zip || zip.disabled || !tree) return;
    const district = districtSel ? find(tree.districts, districtSel.value) : undefined;
    const sub = district ? find(district.subDistricts, subSel.value) : undefined;
    // Choosing a ตำบล is the only thing that writes the รหัสไปรษณีย์, and it
    // overwrites: the two must agree, and the picker is the one that knows.
    if (sub) zip.value = sub.zip;
  });

  try {
    fill(provinceSel, await provinces(), stored.province);
  } catch {
    failed(provinceSel, stored.province);
  }
  await loadTree(provinceSel.value, { district: stored.district, sub: stored.sub });
}

/** Province names for a datalist — the list filter offers them as hints. */
export async function provinceNames(): Promise<string[]> {
  return (await provinces()).map((p) => p.th);
}
