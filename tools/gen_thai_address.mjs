/**
 * gen_thai_address.mjs — build the Thai address tables the address picker reads.
 *
 * Three sources, because no single one of them is complete:
 *
 *   1. playxdev/iHapWeb `data/raw` — the base, and the newest of the three
 *      (77 provinces · 928 districts · 7,452 sub-districts, refreshed 2025).
 *   2. `../docs/post/*.sql` — a 2021 phpMyAdmin dump of the same tables. It is
 *      older and smaller, but it holds 12 rows the base lost, nine of them in
 *      Bangkok. It only ever fills gaps: where both have a row, the base wins,
 *      and its rows without a five-digit zip are skipped.
 *   3. `tools/address-overrides.json` — Bangkok's 180 แขวง as announced today.
 *      Both dumps predate the 2560/2564 splits (บางนา into two, บางบอน into
 *      four, …) and both still list แขวง that were transferred to another เขต
 *      years ago, so province 1's sub-districts are replaced wholesale rather
 *      than patched row by row. That file carries its own sources.
 *
 * The 2.3 MB of source is not committed and none of it is shipped whole: this
 * tool splits it into what a form actually asks for.
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
 *     node tools/gen_thai_address.mjs               # fetch the base with gh
 *     node tools/gen_thai_address.mjs --src DIR     # read DIR/*.json instead
 *     node tools/gen_thai_address.mjs --sql DIR     # the 2021 dump lives here
 *     node tools/gen_thai_address.mjs --no-sql      # base + overrides only
 *
 * The default path needs the GitHub CLI signed in to an account that can read
 * the private iHapWeb repository. `--src` is for a checkout that is already on
 * disk, or for regenerating with no network at all. The dump defaults to
 * `../docs/post` beside this repository and is skipped, loudly, when absent —
 * Bangkok is unaffected either way, since the overrides file decides it.
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
const flag = (name) => {
  const at = args.indexOf(name);
  if (at === -1) return null;
  const value = args[at + 1];
  if (!value) {
    console.error(`gen_thai_address: ${name} needs a directory`);
    process.exit(1);
  }
  return value;
};
const srcDir = flag("--src");
const sqlDir = args.includes("--no-sql") ? null : (flag("--sql") ?? join(ROOT, "..", "docs", "post"));
const OVERRIDES = join(ROOT, "tools", "address-overrides.json");

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
const districtIds = new Set(districts.map((d) => d.id));
const provinceOfDistrict = new Map(districts.map((d) => [d.id, d.province_id]));

/** One shape for all three sources, so nothing downstream has to ask which. */
const subDistricts = live(raw.sub_districts).map((s) => ({
  id: s.id,
  districtId: s.district_id,
  th: s.name_th,
  en: s.name_en || s.name_th,
  zip: String(s.zip_code),
}));

/* ------------------------------------------- 2. the 2021 dump, as a filler */

/** Values of one `INSERT ... VALUES (…)` tuple, quotes and escapes undone. */
function tupleValues(line) {
  const values = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === "'") {
      let text = "";
      i++;
      while (i < line.length && line[i] !== "'") {
        if (line[i] === "\\") {
          text += line[i + 1];
          i += 2;
        } else {
          text += line[i++];
        }
      }
      i++;
      values.push(text);
    } else {
      let text = "";
      while (i < line.length && line[i] !== ",") text += line[i++];
      const trimmed = text.trim();
      values.push(trimmed === "NULL" ? null : trimmed);
    }
    while (i < line.length && (line[i] === "," || line[i] === " ")) i++;
  }
  return values;
}

const supplement = { added: 0, noZip: 0, unknownDistrict: 0 };
if (sqlDir) {
  try {
    const dump = readFileSync(join(sqlDir, "subdistrict.sql"), "utf8");
    const known = new Set(subDistricts.map((s) => s.id));
    for (const m of dump.matchAll(/^\((.*)\)[,;]\s*$/gm)) {
      const [id, districtId, th, en, , , zip] = tupleValues(m[1]);
      const sid = Number(id);
      if (!Number.isFinite(sid) || known.has(sid)) continue;
      if (!districtIds.has(Number(districtId))) {
        supplement.unknownDistrict++;
        continue;
      }
      // The dump leaves a zip NULL on ten rows. A ตำบล with no รหัสไปรษณีย์
      // would fill the box with "null", which is worse than not offering it.
      if (!/^\d{5}$/.test(String(zip ?? ""))) {
        supplement.noZip++;
        continue;
      }
      subDistricts.push({ id: sid, districtId: Number(districtId), th, en: en || th, zip: String(zip) });
      known.add(sid);
      supplement.added++;
    }
  } catch (err) {
    console.warn(`address: no 2021 dump at ${sqlDir} — ${err.message}`);
    console.warn("address: continuing without it; Bangkok is unaffected (see the overrides file)");
  }
}

/* -------------------------------------- 3. the overrides, for what is stale */

const overrides = JSON.parse(readFileSync(OVERRIDES, "utf8"));
const replaced = [];
for (const [key, spec] of Object.entries(overrides.provinces ?? {})) {
  if (!spec.replaceSubDistricts) continue;
  const provinceId = Number(key);
  const rows = spec.subDistricts ?? [];

  const wrong = rows.filter((r) => provinceOfDistrict.get(r.districtId) !== provinceId);
  const badly = rows.filter((r) => !/^\d{5}$/.test(String(r.zip ?? "")));
  if (wrong.length > 0 || badly.length > 0 || rows.length !== spec.expected) {
    console.error(`gen_thai_address: ${OVERRIDES} does not describe province ${provinceId}`);
    for (const r of wrong.slice(0, 5)) console.error(`  district ${r.districtId} is not in this province: ${r.th}`);
    for (const r of badly.slice(0, 5)) console.error(`  zip ${r.zip}: ${r.th}`);
    if (rows.length !== spec.expected) console.error(`  ${rows.length} rows, expected ${spec.expected}`);
    process.exit(1);
  }

  // Wholesale, not row by row: the file is the list, and a row the sources
  // still carry under an old เขต has to disappear with the rest.
  let dropped = 0;
  for (let i = subDistricts.length - 1; i >= 0; i--) {
    if (provinceOfDistrict.get(subDistricts[i].districtId) === provinceId) {
      subDistricts.splice(i, 1);
      dropped++;
    }
  }
  for (const r of rows) {
    subDistricts.push({ id: r.id, districtId: r.districtId, th: r.th, en: r.en, zip: String(r.zip) });
  }
  replaced.push(`${spec.label ?? provinceId}: ${dropped} → ${rows.length}`);
}

/* ------------------------------------------------------------------ shape */

const subsByDistrict = new Map();
for (const s of subDistricts) {
  const list = subsByDistrict.get(s.districtId) ?? [];
  list.push({ id: s.id, th: s.th, en: s.en, zip: s.zip });
  subsByDistrict.set(s.districtId, list);
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
    en: d.name_en || d.name_th,
    subDistricts: (subsByDistrict.get(d.id) ?? []).sort((a, b) => a.th.localeCompare(b.th, "th")),
  });
  districtsByProvince.set(d.province_id, list);
}

// A province with no district left means the source lost rows, not that the
// province has none, so the build stops rather than shipping a hole.
const empty = provinces
  .filter((p) => (districtsByProvince.get(p.id) ?? []).length === 0)
  .map((p) => `province ${p.id} ${p.name_th}`);
const badZip = subDistricts.filter((s) => !/^\d{5}$/.test(s.zip));
const duplicates = subDistricts.length - new Set(subDistricts.map((s) => s.id)).size;
if (empty.length > 0 || badZip.length > 0 || duplicates > 0) {
  console.error("gen_thai_address: the source tables do not hold together");
  for (const e of empty.slice(0, 10)) console.error(`  empty: ${e}`);
  for (const s of badZip.slice(0, 10)) console.error(`  zip: ${s.id} ${s.th} → ${s.zip}`);
  if (duplicates > 0) console.error(`  ${duplicates} sub-district ids appear twice`);
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
    `${subDistricts.length} sub-districts → ${files} files, ${(bytes / 1024).toFixed(0)} KB`
);
if (supplement.added > 0 || supplement.noZip > 0) {
  console.log(
    `address: the 2021 dump filled ${supplement.added} gaps` +
      (supplement.noZip > 0 ? `, skipped ${supplement.noZip} rows with no zip` : "") +
      (supplement.unknownDistrict > 0 ? `, ${supplement.unknownDistrict} under a district nobody has` : "")
  );
}
for (const line of replaced) console.log(`address: overrides replaced ${line}`);
if (dropped.length > 0) console.log(`address: dropped ${dropped.length} childless: ${dropped.join(", ")}`);
