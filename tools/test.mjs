/**
 * test.mjs — zero-dependency test runner for PenbunWeb.
 *
 * Runs against the compiled output in public/assets/js (run `npm run build`
 * first — `npm test` does both) plus live HTTP checks against tools/serve.mjs.
 *
 *   npm test          # build + all suites
 *   node tools/test.mjs --no-server   # unit suites only
 */
import { spawn } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const mod = (p) => import(new URL(p, import.meta.url));

let passed = 0;
let failed = 0;
const failures = [];

function check(name, ok, extra = "") {
  if (ok) {
    passed++;
  } else {
    failed++;
    failures.push(`${name}${extra ? ` — ${extra}` : ""}`);
    console.error(`  ✗ ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

/* ------------------------------------------------------------ format.ts */
console.log("# format");
const F = await mod("../public/assets/js/core/format.js");
check("money groups thousands", F.money(1234.5) === "1,234.50", F.money(1234.5));
check("money respects digits=0", F.money(184320, 0) === "184,320", F.money(184320, 0));
check("baht prefixes ฿", F.baht(0) === "฿0.00", F.baht(0));
check("pct formats", F.pct(12.34, 1) === "12.3%");
check("signed positive keeps +", F.signed(6.4) === "+6.4%");
check("signed negative uses U+2212", F.signed(-2.1) === "−2.1%", F.signed(-2.1));
check("signed zero has no sign", F.signed(0) === "0.0%");
check("esc escapes markup", F.esc(`<a href="x">&'</a>`) === "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;", F.esc("<a>&'"));
check("esc accepts non-strings", F.esc(42) === "42");
check("date renders Buddhist era", F.date("2026-08-23").includes("2569"), F.date("2026-08-23"));
check("timeAgo now → เมื่อครู่", F.timeAgo(new Date()) === "เมื่อครู่");
check("timeAgo minutes", F.timeAgo(new Date(Date.now() - 5 * 6e4)) === "5 นาทีที่แล้ว", F.timeAgo(new Date(Date.now() - 5 * 6e4)));
check("timeAgo hours", F.timeAgo(new Date(Date.now() - 3 * 36e5)).includes("ชั่วโมง"));
check("timeAgo days", F.timeAgo(new Date(Date.now() - 2 * 864e5)).includes("วัน"));

/* ------------------------------------------------------------- icons.ts */
console.log("# icons");
const I = await mod("../public/assets/js/core/icons.js");
check("known icon returns svg", I.icon("book").startsWith("<svg"));
check("unknown icon falls back to info", I.icon("nope").includes(I.icon("info").slice(5)));
check("class applied", I.icon("book", "pb-nav__icon").includes('class="pb-nav__icon"'));

/* ------------------------------------------------------------ charts.ts */
console.log("# charts");
const C = await mod("../public/assets/js/core/charts.js");
const M = await mod("../public/assets/js/data/mock.js");
const host = () => ({ innerHTML: "" });

const area = host();
C.renderArea(area, {
  labels: M.salesLabels,
  series: [
    { name: "เดือนนี้", values: M.salesThisMonth, variant: "brand" },
    { name: "เดือนก่อน", values: M.salesLastMonth, variant: "muted" },
  ],
});
check("area renders svg", area.innerHTML.includes("<svg"));
check("area has no NaN/undefined", !/(NaN|undefined)/.test(area.innerHTML));

const areaEmpty = host();
C.renderArea(areaEmpty, { labels: [], series: [] });
check("area empty input → blank", areaEmpty.innerHTML === "", areaEmpty.innerHTML.slice(0, 80));

const areaGap = host();
C.renderArea(areaGap, {
  labels: ["1"],
  series: [{ name: "a", values: [5] }, { name: "b", values: [] }],
});
check("area tolerates empty series among data", !/(NaN|undefined)/.test(areaGap.innerHTML));

const donut = host();
C.renderDonut(donut, M.stockMix, "ชิ้นในคลัง");
check("donut renders one ring per slice + base", (donut.innerHTML.match(/<circle/g) ?? []).length === M.stockMix.length + 1);
check("donut center shows total", donut.innerHTML.includes("41,600"), donut.innerHTML);
check("donut has no NaN", !donut.innerHTML.includes("NaN"));

const donutZero = host();
C.renderDonut(donutZero, [{ label: "a", value: 0, color: "#000" }], "empty");
check("donut zero total skips rings", !(donutZero.innerHTML.includes('stroke="#000"') && donutZero.innerHTML.includes("stroke-dasharray=\"-")));
check("donut zero total has no NaN/negative dasharray", !/NaN|dasharray="-/.test(donutZero.innerHTML), donutZero.innerHTML);

const spark = host();
C.renderSparkline(spark, [3, 8, 5, 9]);
check("sparkline renders path", spark.innerHTML.includes("<path"));
const sparkOne = host();
C.renderSparkline(sparkOne, [7]);
check("sparkline single point → blank", sparkOne.innerHTML === "");

/* --------------------------------------------------------------- ui.ts */
console.log("# ui (numericCellValue)");
const U = await mod("../public/assets/js/core/ui.js");
const cell = (s) => U.numericCellValue(s);
check("plain number", cell("96") === 96);
check("thousand separators", cell("42,180.00") === 42180);
check("U+2212 minus is negative (regression)", cell("−40") === -40, cell("−40"));
check("U+2212 with separators", cell("−12,400.00") === -12400, cell("−12,400.00"));
check("plus sign stripped", cell("+1,200") === 1200);
check("percent stripped", cell("35.00%") === 35);
check("baht symbol stripped", cell("฿1,284,500") === 1284500);
check("thai text → null", cell("ไม่มีสต็อก") === null);
check("em dash → null", cell("—") === null);
check("lone minus → null", cell("-") === null);

/* --------------------------------------------------------------- nav.ts */
console.log("# nav ↔ pages consistency");
const N = await mod("../public/assets/js/core/nav.js");
const pages = readdirSync(new URL("../public", import.meta.url)).filter((f) => f.endsWith(".html"));
for (const g of N.NAV) {
  for (const item of g.items) {
    const file = item.href.replace(/^\//, "");
    check(`nav "${item.id}" file exists`, pages.includes(file), item.href);
    try {
      const html = readFileSync(new URL(`../public/${file}`, import.meta.url), "utf8");
      const m = html.match(/data-page="([^"]*)"/);
      check(`nav "${item.id}" matches data-page`, m?.[1] === item.id, `${file} has data-page=${m?.[1]}`);
    } catch {
      check(`nav "${item.id}" readable`, false, file);
    }
  }
}
const navIds = new Set(Object.keys(N.NAV_INDEX));
// Pages mounted inside the shell on purpose without a sidebar entry.
const SHELL_ONLY = new Set(["profile"]);
for (const f of pages) {
  const html = readFileSync(new URL(`../public/${f}`, import.meta.url), "utf8");
  const m = html.match(/data-page="([^"]*)"/);
  if (m && !SHELL_ONLY.has(m[1])) check(`page "${f}" known in NAV_INDEX`, navIds.has(m[1]), m[1]);
}

/* ------------------------------------------------------- HTTP smoke test */
if (!process.argv.includes("--no-server")) {
  console.log("# http (tools/serve.mjs)");
  const PORT = 4677;
  const BASE = `http://localhost:${PORT}`;
  const server = spawn(process.execPath, [fileURLToPath(new URL("./serve.mjs", import.meta.url)), String(PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stderr.on("data", (d) => process.stderr.write(`[serve] ${d}`));
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("server did not start")), 4000);
    server.stdout.on("data", (d) => {
      if (String(d).includes("http://localhost")) clearTimeout(t), resolve();
    });
    server.on("exit", (code) => reject(new Error(`server exited early (${code})`)));
  });

  try {
    for (const f of pages) {
      const r = await fetch(`${BASE}/${f}`);
      check(`GET /${f}`, r.status === 200, r.status);
      const html = await r.text();
      const refs = [...html.matchAll(/(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1]);
      for (const ref of new Set(refs)) {
        if (ref.startsWith("//")) continue;
        const ar = await fetch(BASE + ref);
        check(`${f} → ${ref}`, ar.status === 200, ar.status);
      }
    }
    check("/ falls back to index", (await fetch(BASE + "/")).status === 200);
    check("/dashboard extensionless", (await fetch(BASE + "/dashboard")).status === 200);

    const nf = await fetch(BASE + "/definitely-missing");
    check("missing page is 404", nf.status === 404, nf.status);
    check("404 body is styled page", (await nf.text()).includes("pb-errpage"));

    check("traversal blocked", (await fetch(BASE + "/..%2f..%2fetc%2fpasswd")).status !== 200);

    // Regression: malformed URI must not crash the server.
    const bad = await fetch(BASE + "/%ZZ").then(
      (r) => r.status,
      () => 0
    );
    check("malformed URI answered", bad >= 400 && bad < 500, `got ${bad}`);
    await new Promise((r) => setTimeout(r, 200));
    const alive = await fetch(BASE + "/dashboard.html").then(
      (r) => r.ok,
      () => false
    );
    check("server survives malformed URI (regression)", alive);

    const wm = await fetch(BASE + "/assets/image/png/icon/site.webmanifest");
    check("webmanifest mime", wm.headers.get("content-type") === "application/manifest+json", wm.headers.get("content-type"));
    const png = await fetch(BASE + "/assets/image/png/icon/favicon-32x32.png");
    check("png mime", png.headers.get("content-type") === "image/png", png.headers.get("content-type"));
  } finally {
    server.kill();
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
