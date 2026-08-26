/**
 * gen_thai_address.mjs — build the Thai address tables the address picker reads.
 *
 * Source of truth is the `data/raw` folder of playxdev/iHapWeb, which mirrors
 * the standard `provinces` / `districts` / `sub_districts` tables (77 / 928 /
 * 7 452 rows). That is one 2.3 MB JSON file for the sub-districts alone, so
 * none of it is committed here and none of it is shipped whole: this tool
 * splits it into what a form actually asks for.
 *
 *     public/assets/data/th/provinces.json     77 rows, ~4 KB — loaded once
 *     public/assets/data/th/province/<id>.json one province, districts and
 *                                              their sub-districts nested,
 *                                              ~8 KB each, 26 KB at worst
 *
 * A form therefore downloads 4 KB to fill the จังหวัด list, and one small
 * file the moment a province is picked — after which the อำเภอ and ตำบล lists
 * and the รหัสไปรษณีย์ are all in hand with no further request. Splitting per
 * district instead would mean 928 files and a second round trip for nothing.
 *
 * Names are written exactly as the source has them, prefixes included:
 * Bangkok's 50 districts are "เขตบางรัก", the other 878 are plain
 * ("เมืองนนทบุรี"), and no sub-district carries a ตำบล/แขวง prefix. The picker
 * writes these strings straight into `province` / `district` / `sub_district`,
 * which are nvarchar columns in PenbunSQL, not foreign keys — the numeric ids
 * are kept only so the three lists can be chained here in the browser.
 *
 * Usage:
 *
 *     node tools/gen_thai_address.mjs              # fetch the source with gh
 *     node tools/gen_thai_address.mjs --src DIR    # read DIR/*.json instead
 *
 * The default path needs the GitHub CLI signed in to an account that can read
 * the private iHapWeb repository. `--src` is for a checkout that is already on
 * disk, or for regenerating with no network at all.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "public", "assets", "data", "th");

const REPO = "playxdev/iHapWeb";
const TABLES = ["provinces", "districts", "sub_districts"];

const args = process.argv.slice(2);
const srcFlag = args.indexOf("--src");
const srcDir = srcFlag === -1 ? null : args[srcFlag + 1];
if (srcFlag !== -1 && !srcDir) {
  console.error("gen_thai_address: --src needs a directory");
  process.exit(1);
}

/**
 * The sub-district table is 2.3 MB, which is past what the contents endpoint
 * will inline, so every table is read through the blob endpoint instead: one
 * call for the tree to learn the sha, one per file to read it.
 */
function fetchTable(name) {
  const tree = JSON.parse(
    execFileSync("gh", ["api", `repos/${REPO}/git/trees/main?recursive=1`], {
      encoding: "utf8",
      maxBuffer: 64 << 20,
    })
  );
  const entry = tree.tree.find((t) => t.path === `data/raw/${name}.json`);
  if (!entry) throw new Error(`${REPO} has no data/raw/${name}.json`);
  const blob = JSON.parse(
    execFileSync("gh", ["api", `repos/${REPO}/git/blobs/${entry.sha}`], {
      encoding: "utf8",
      maxBuffer: 64 << 20,
    })
  );
  return JSON.parse(Buffer.from(blob.content, "base64").toString("utf8"));
}

const load = (name) =>
  srcDir ? JSON.parse(readFileSync(join(srcDir, `${name}.json`), "utf8")) : fetchTable(name);

let raw;
try {
  raw = Object.fromEntries(TABLES.map((t) => [t, load(t)]));
} catch (err) {
  console.error(`gen_thai_address: cannot read the source tables — ${err.message}`);
  console.error(srcDir ? `  looked in ${srcDir}` : `  needs: gh auth login (read access to ${REPO})`);
  process.exit(1);
}

// deleted_at is the source's own tombstone. Nothing carries one today, but a
// row that gains one must leave the picker rather than be offered forever.
const live = (rows) => rows.filter((r) => !r.deleted_at);

const provinces = live(raw.provinces);
const districts = live(raw.districts);
const subDistricts = live(raw.sub_districts);

const subsByDistrict = new Map();
for (const s of subDistricts) {
  const list = subsByDistrict.get(s.district_id) ?? [];
  list.push({ id: s.id, th: s.name_th, en: s.name_en, zip: String(s.zip_code) });
  subsByDistrict.set(s.district_id, list);
}

// Two rows in the source are local-government units rather than districts —
// "ท้องถิ่นเทศบาลตำบลบ้านฆ้อง" and "ท้องถิ่นเทศบาลตำบลสำนักขาม" — and neither
// has a single sub-district under it. Offering them would dead-end the picker
// on a choice that leads nowhere, so a childless district is dropped here.
const dropped = [];
const districtsByProvince = new Map();
for (const d of districts) {
  if ((subsByDistrict.get(d.id) ?? []).length === 0) {
    dropped.push(`${d.id} ${d.name_th}`);
    continue;
  }
  const list = districtsByProvince.get(d.province_id) ?? [];
  list.push({
    id: d.id,
    th: d.name_th,
    en: d.name_en,
    subDistricts: (subsByDistrict.get(d.id) ?? []).sort((a, b) => a.th.localeCompare(b.th, "th")),
  });
  districtsByProvince.set(d.province_id, list);
}

// A province with no district left means the source lost rows, not that the
// province has none, so the build stops rather than shipping a hole.
const empty = provinces
  .filter((p) => (districtsByProvince.get(p.id) ?? []).length === 0)
  .map((p) => `province ${p.id} ${p.name_th}`);
const badZip = subDistricts.filter((s) => !/^\d{5}$/.test(String(s.zip_code)));
if (empty.length > 0 || badZip.length > 0) {
  console.error("gen_thai_address: the source tables do not hold together");
  for (const e of empty.slice(0, 10)) console.error(`  empty: ${e}`);
  for (const s of badZip.slice(0, 10)) console.error(`  zip: ${s.id} ${s.name_th} → ${s.zip_code}`);
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "province"), { recursive: true });

const byName = (a, b) => a.th.localeCompare(b.th, "th");
const index = provinces.map((p) => ({ id: p.id, th: p.name_th, en: p.name_en })).sort(byName);
writeFileSync(join(OUT, "provinces.json"), JSON.stringify(index));

let bytes = 0;
for (const p of provinces) {
  const tree = {
    id: p.id,
    th: p.name_th,
    en: p.name_en,
    districts: (districtsByProvince.get(p.id) ?? []).sort(byName),
  };
  const json = JSON.stringify(tree);
  bytes += Buffer.byteLength(json);
  writeFileSync(join(OUT, "province", `${p.id}.json`), json);
}

const files = readdirSync(join(OUT, "province")).length;
console.log(
  `address: ${provinces.length} provinces · ${districts.length - dropped.length} districts · ` +
    `${subDistricts.length} sub-districts → ${files} files, ${(bytes / 1024).toFixed(0)} KB` +
    (dropped.length > 0 ? `\naddress: dropped ${dropped.length} childless: ${dropped.join(", ")}` : "")
);
