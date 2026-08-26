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

/* --------------------------------------------------- auth · tokens · api */
// These modules run in a browser; give them the globals they touch.
// Every read happens inside a function, so shimming before the calls is enough
// — except `window`, which config.js writes to as it loads, so it has to exist
// before the import below rather than before the first call.
console.log("# auth / tokens / api");
{
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => void mem.set(k, String(v)),
    removeItem: (k) => void mem.delete(k),
    clear: () => mem.clear(),
  };
  globalThis.document = { querySelector: () => null };
  globalThis.location = { hostname: "localhost", pathname: "/dashboard.html", search: "" };
  globalThis.window = globalThis;

  const CFG = await mod("../public/assets/js/core/config.js");
  const T = await mod("../public/assets/js/core/tokens.js");
  const A = await mod("../public/assets/js/core/api.js");
  const AUTH = await mod("../public/assets/js/core/auth.js");

  /* config */
  // ค่าปกติคือ "auto" — เทสต์ยืนยันพฤติกรรมนั้น ถ้าตั้งเป็น prod/dev ค่อยข้ามสองข้อแรก
  const localBase = CFG.apiBase();
  globalThis.location.hostname = "penbunweb.pages.dev";
  const remoteBase = CFG.apiBase();
  check("apiBase is absolute and ends at the API prefix", /^https?:\/\/[^/]+\/api\/v2$/.test(remoteBase), remoteBase);
  check("auto keeps localhost on the dev API", localBase === "http://localhost:8089/api/v2", localBase);
  check("auto sends everything else to the deployed API", remoteBase.startsWith("https://") && remoteBase !== localBase, remoteBase);
  CFG.setApiBase("https://api.example.com/api/v2/");
  check("apiBase override wins and drops trailing slash", CFG.apiBase() === "https://api.example.com/api/v2", CFG.apiBase());
  CFG.setApiBase(null);
  check("apiBase override cleared", CFG.apiBase() === remoteBase, CFG.apiBase());
  globalThis.location.hostname = "localhost";
  check("apiBase and setApiBase reachable from the console", typeof globalThis.window?.penbun?.setApiBase === "function", String(globalThis.window?.penbun));

  /* tokens */
  const pair = {
    access_token: "a.b.c",
    refresh_token: "r.e.f",
    token_type: "Bearer",
    expires_in: 900,
    user: {
      user_id: "USR000001",
      user_name: "jack",
      full_name: "จักรพงษ์ ศรีวิไล",
      email: null,
      user_level: "ADMIN",
      must_change_password: false,
      last_login_date: null,
    },
  };
  T.clear();
  check("no session before login", T.read() === null);
  check("accessExpired with no session", T.accessExpired() === true);
  T.store(pair);
  check("access token stored", T.accessToken() === "a.b.c");
  check("refresh token stored", T.refreshToken() === "r.e.f");
  check("expiry derived from expires_in", Math.abs(T.read().expiresAt - (Date.now() + 900_000)) < 2000);
  check("fresh token is not expired", T.accessExpired() === false);
  check("skew larger than the TTL reports expired", T.accessExpired(1_000_000) === true);
  check("demo flag false after real login", T.isDemo() === false);

  mem.set("penbun.auth", "{not json");
  check("malformed storage reads as no session", T.read() === null);
  check("malformed storage is discarded", mem.has("penbun.auth") === false);
  mem.set("penbun.auth", JSON.stringify({ access: "x" }));
  check("storage missing fields reads as no session", T.read() === null);

  T.store(pair);
  mem.set("penbun.session", "legacy");
  T.clear();
  check("clear removes the session", T.read() === null);
  check("clear removes the beta 1.3.0 key", mem.has("penbun.session") === false);

  /* auth mapping */
  check("initials take one letter per word", AUTH.initialsOf("จักรพงษ์ ศรีวิไล", "jack") === "จศ", AUTH.initialsOf("จักรพงษ์ ศรีวิไล", "jack"));
  check("initials of a single word", AUTH.initialsOf("Somchai", "x") === "S", AUTH.initialsOf("Somchai", "x"));
  check("initials fall back to the username", AUTH.initialsOf("", "jack") === "JA", AUTH.initialsOf("", "jack"));
  check("initials never return empty", AUTH.initialsOf("", "") === "?");

  T.store(pair);
  const s = AUTH.session();
  check("session name prefers full_name", s.name === "จักรพงษ์ ศรีวิไล");
  check("session keeps the raw level", s.level === "ADMIN");
  check("session shows a Thai role label", s.role === "ผู้ดูแลระบบ");
  check("session is not demo", s.demo === false);
  check("isSignedIn true with a stored pair", AUTH.isSignedIn() === true);

  const nameless = { ...pair, user: { ...pair.user, full_name: null } };
  T.store(nameless);
  check("session falls back to user_name", AUTH.session().name === "jack");

  T.clear();
  check("session null after clear", AUTH.session() === null);
  const demo = AUTH.signInDemo();
  check("demo session is flagged", demo.demo === true && T.isDemo() === true);
  check("demo session holds no token", T.accessToken() === "");
  T.clear();

  /* api errors */
  const err = new A.ApiError(A.CODE.TOKEN_EXPIRED, "หมดอายุ", 401, [], "trace-1");
  check("ApiError keeps its code", err.code === "TOKEN_EXPIRED");
  check("TOKEN_EXPIRED is an auth failure", err.isAuthFailure === true);
  check("BUSINESS_RULE is not an auth failure", new A.ApiError(A.CODE.BUSINESS_RULE, "x").isAuthFailure === false);
  check("ApiError is an Error", err instanceof Error && err.message === "หมดอายุ");
  check("ApiError defaults are safe", new A.ApiError("X", "y").fieldErrors.length === 0);
}

/* ------------------------------------------------- api request pipeline */
// Drives core/api.ts against a stubbed fetch. No API needed; the point is
// the parts that are easy to get wrong — envelope unwrapping, the bearer
// header, and the single-flight refresh on TOKEN_EXPIRED.
console.log("# api pipeline (stubbed fetch)");
{
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => void mem.set(k, String(v)),
    removeItem: (k) => void mem.delete(k),
    clear: () => mem.clear(),
  };
  globalThis.document = { querySelector: () => null };
  globalThis.location = { hostname: "localhost", pathname: "/dashboard.html", search: "" };
  globalThis.window = globalThis;

  const CFG2 = await mod("../public/assets/js/core/config.js");
  const T = await mod("../public/assets/js/core/tokens.js");
  const A = await mod("../public/assets/js/core/api.js");
  const AUTH = await mod("../public/assets/js/core/auth.js");
  // ยืนยันเส้นทาง ไม่ใช่ origin — origin มาจาก USE_PROD ซึ่งเปลี่ยนได้ตามการตั้งค่า
  const BASE = CFG2.apiBase();

  const realFetch = globalThis.fetch;
  let calls = [];
  let handler = () => envelope({});

  const envelope = (data, over = {}) =>
    new Response(JSON.stringify({ status: "success", message: "ok", code: "OK", data, trace_id: "t", ...over }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  const failure = (code, status, message = "boom") =>
    new Response(JSON.stringify({ status: "error", message, code, data: null, trace_id: "t" }), {
      status,
      headers: { "content-type": "application/json" },
    });

  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init, calls.length);
  };

  const user = {
    user_id: "USR000001", user_name: "jack", full_name: "จักรพงษ์ ศรีวิไล", email: null,
    user_level: "ADMIN", must_change_password: false, last_login_date: null,
  };
  const pair = (n) => ({
    access_token: `access-${n}`, refresh_token: `refresh-${n}`,
    token_type: "Bearer", expires_in: 900, user,
  });

  const reset = (h) => { calls = []; handler = h; T.clear(); };

  /* login */
  reset(() => envelope(pair(1)));
  const s1 = await AUTH.signIn("  jack  ", "penbun1");
  check("login posts to /auth/login", calls[0].url === BASE + "/auth/login", calls[0].url);
  check("login uses POST", calls[0].init.method === "POST");
  check("login sends the credentials verbatim", calls[0].init.body === JSON.stringify({ username: "  jack  ", password: "penbun1" }), calls[0].init.body);
  check("login sends no bearer", calls[0].init.headers.Authorization === undefined);
  check("login stores the pair", T.accessToken() === "access-1" && T.refreshToken() === "refresh-1");
  check("login returns a mapped session", s1.username === "jack" && s1.level === "ADMIN");

  /* bearer on an authenticated call */
  reset(() => envelope(user));
  T.store(pair(1));
  await AUTH.fetchMe();
  check("GET /auth/me carries the bearer", calls[0].init.headers.Authorization === "Bearer access-1", calls[0].init.headers.Authorization);
  check("GET has no body", calls[0].init.body === undefined);

  /* 204 */
  reset(() => new Response(null, { status: 204 }));
  T.store(pair(1));
  check("204 resolves to null", (await A.post("/auth/logout")) === null);

  /* refresh + retry */
  reset((url, init, n) => {
    if (n === 1) return failure("TOKEN_EXPIRED", 401);
    if (n === 2) return envelope(pair(2));
    return envelope({ ok: init.headers.Authorization });
  });
  T.store(pair(1));
  const retried = await A.get("/stock/onhand");
  check("expired call refreshes then retries", calls.length === 3, `${calls.length} calls`);
  check("refresh hits /auth/refresh", calls[1].url.endsWith("/auth/refresh"), calls[1].url);
  check("refresh sends the stored refresh token", JSON.parse(calls[1].init.body).refresh_token === "refresh-1");
  check("retry uses the new access token", retried.ok === "Bearer access-2", JSON.stringify(retried));
  check("rotated pair is stored", T.accessToken() === "access-2");

  /* single flight */
  reset((url, init, n) => {
    if (url.endsWith("/auth/refresh")) return envelope(pair(9));
    return n <= 3 ? failure("TOKEN_EXPIRED", 401) : envelope({ n });
  });
  T.store(pair(1));
  await Promise.all([A.get("/a"), A.get("/b"), A.get("/c")]);
  const refreshes = calls.filter((c) => c.url.endsWith("/auth/refresh")).length;
  check("three expired calls trigger one refresh", refreshes === 1, `${refreshes} refreshes`);

  /* proactive refresh when the clock says the token is spent */
  reset((url) => (url.endsWith("/auth/refresh") ? envelope(pair(3)) : envelope({})));
  T.store({ ...pair(1), expires_in: 0 });
  await A.get("/products");
  check("a spent token refreshes before sending", calls[0].url.endsWith("/auth/refresh"), calls[0].url);
  check("only one extra call is spent", calls.length === 2, `${calls.length} calls`);

  /* a dead refresh token ends the session */
  reset((url, init, n) => (n === 1 ? failure("TOKEN_EXPIRED", 401) : failure("UNAUTHORIZED", 401)));
  T.store(pair(1));
  let caught = null;
  try { await A.get("/products"); } catch (e) { caught = e; }
  check("dead refresh rethrows", caught instanceof A.ApiError && caught.code === "UNAUTHORIZED", caught?.code);
  check("dead refresh clears the session", T.read() === null);

  /* business errors keep their code and trace */
  reset(() => failure("ACCOUNT_LOCKED", 423, "บัญชีถูกระงับ"));
  caught = null;
  try { await AUTH.signIn("jack", "nope"); } catch (e) { caught = e; }
  check("locked account surfaces its code", caught?.code === "ACCOUNT_LOCKED", caught?.code);
  check("locked account keeps the Thai message", caught?.message === "บัญชีถูกระงับ");
  check("locked account carries the trace id", caught?.traceId === "t");
  check("failed login stores nothing", T.read() === null);

  /* transport failure */
  reset(() => { throw new TypeError("failed to fetch"); });
  caught = null;
  try { await AUTH.signIn("jack", "penbun1"); } catch (e) { caught = e; }
  check("unreachable API becomes NETWORK", caught?.code === "NETWORK", caught?.code);

  /* a non-envelope response is not mistaken for success */
  reset(() => new Response("<html>nope</html>", { status: 502, headers: { "content-type": "text/html" } }));
  T.store(pair(1));
  caught = null;
  try { await A.get("/products"); } catch (e) { caught = e; }
  check("HTML error page throws", caught instanceof A.ApiError, String(caught));
  check("HTML error page keeps the HTTP status", caught?.httpStatus === 502, caught?.httpStatus);

  /* logout is best effort but always local */
  const redirects = [];
  globalThis.location = { hostname: "localhost", pathname: "/dashboard.html", search: "",
    set href(v) { redirects.push(v); }, get href() { return redirects.at(-1) ?? ""; } };
  reset(() => { throw new TypeError("offline"); });
  T.store(pair(1));
  await AUTH.signOut();
  check("logout clears the session even when the API is down", T.read() === null);
  check("logout returns to the sign-in page", redirects.at(-1) === "/index.html", redirects.at(-1));

  reset(() => new Response(null, { status: 204 }));
  AUTH.signInDemo();
  await AUTH.signOut();
  check("demo sign-out calls no endpoint", calls.length === 0, `${calls.length} calls`);

  globalThis.fetch = realFetch;
  globalThis.location = { hostname: "localhost", pathname: "/dashboard.html", search: "" };
  T.clear();
}

/* ---------------------------------------------------------- master data */
// The master screens are generated from descriptors, so the descriptors are
// what has to be right: a wrong sort key or a ref pointing at nothing fails
// only at runtime, on one screen, for one user.
console.log("# master registry");
{
  const R = await mod("../public/assets/js/master/resources.js");

  check("registry holds all 18 resources", R.MASTERS.length === 18, R.MASTERS.length);
  check("page ids are unique", new Set(R.MASTERS.map((m) => m.page)).size === 18);
  check("resource names are unique", new Set(R.MASTERS.map((m) => m.name)).size === 18);

  for (const m of R.MASTERS) {
    check(`${m.name}: idKey set`, typeof m.idKey === "string" && m.idKey.length > 0);
    check(`${m.name}: titleKey set`, typeof m.titleKey === "string" && m.titleKey.length > 0);
    check(`${m.name}: has columns`, m.columns.length > 0);
    check(`${m.name}: read-only or has fields`, m.readOnly === true || m.fields.length > 0);

    // A sort key the API does not know is a 400 the moment the user clicks it.
    const sortKeys = m.columns.filter((c) => c.sort).map((c) => c.sort);
    check(`${m.name}: sort keys are unique`, new Set(sortKeys).size === sortKeys.length, sortKeys.join(","));
    if (m.defaultSort) {
      check(`${m.name}: defaultSort "${m.defaultSort}" is a column sort key`,
        sortKeys.includes(m.defaultSort), sortKeys.join(","));
    }

    for (const ref of m.refs ?? []) {
      check(`${m.name}: ref ${ref.field} → known resource`, !!R.MASTER_BY_NAME[ref.resource], ref.resource);
      check(`${m.name}: ref ${ref.field} is not also a field`,
        !m.fields.some((f) => f.name === ref.field));
    }
    for (const f of m.filters ?? []) {
      const declared = f.resource ? !!R.MASTER_BY_NAME[f.resource] : f.free || (f.options?.length ?? 0) > 0;
      check(`${m.name}: filter ${f.param} has a source`, declared, JSON.stringify(f));
    }
    for (const f of m.fields) {
      check(`${m.name}: field ${f.name} has a label`, !!f.label);
      if (f.enumValues) {
        check(`${m.name}: field ${f.name} enum is non-empty`, f.enumValues.length > 0);
      }
    }
  }

  // vw_customer_route selects neither is_active nor update_date; asking for
  // either would be a query against a column the view does not have.
  const cr = R.MASTER_BY_NAME["customer-route"];
  check("customer-route declares no audit columns", cr.audit === false);
  check("customer-route shows no status column", !cr.columns.some((c) => c.key === "is_active"));
  check("customer-route has no searchable columns", cr.searchable === false);
  check("book stays writable — /book takes POST/PUT/DELETE", R.MASTER_BY_NAME["book"].readOnly !== true);
  check("every page id resolves back", R.MASTERS.every((m) => R.masterForPage(m.page) === m));
  check("unknown page resolves to nothing", R.masterForPage("nope") === undefined);
}

console.log("# master view");
{
  const V = await mod("../public/assets/js/master/view.js");
  const R = await mod("../public/assets/js/master/resources.js");
  const wh = R.MASTER_BY_NAME["warehouse"];

  check("pageWindow keeps the current page", V.pageWindow(7, 20).includes(7));
  check("pageWindow is at most five wide", V.pageWindow(7, 20).length === 5, V.pageWindow(7, 20).join(","));
  check("pageWindow clamps at the start", V.pageWindow(1, 20).join(",") === "1,2,3,4,5");
  check("pageWindow clamps at the end", V.pageWindow(20, 20).join(",") === "16,17,18,19,20");
  check("pageWindow of one page", V.pageWindow(1, 1).join(",") === "1");
  check("pagination hidden for a single page", V.pagination(1, 1) === "");

  const rows = [
    { warehouse_id: "WH000001", warehouse_code: "DC-01", warehouse_name: "ศูนย์กระจายสินค้า",
      warehouse_type: "DC", province: "นนทบุรี", company_name: null,
      is_main_dc: true, allow_negative_stock: false, is_active: true },
  ];
  const body = V.tableBody(wh, rows);
  check("row carries its business id", body.includes('data-id="WH000001"'), body.slice(0, 80));
  check("coded value renders its Thai label", body.includes("ศูนย์กระจายสินค้า"));
  check("false bool falls back to the blank label", body.includes("—"));
  check("null cell is not printed as null", !body.includes(">null<"), body);
  check("writable resource gets row actions", body.includes('data-act="delete"'));

  const injected = V.tableBody(wh, [{ ...rows[0], warehouse_name: '<img src=x onerror="alert(1)">' }]);
  check("cell content is escaped", !injected.includes("<img"), injected.slice(0, 200));

  // Book writes go to internal/domain/book, not the CRUD engine, but they go
  // to the same path — so the screen is writable. A descriptor that really is
  // read-only must offer nothing to click.
  const book = R.MASTER_BY_NAME["book"];
  check("book screen offers row actions", V.tableBody(book, [{ book_id: "BK1", book_name: "x" }]).includes("data-act="));
  check("read-only resource gets no row actions",
    !V.tableBody({ ...book, readOnly: true }, [{ book_id: "BK1", book_name: "x" }]).includes("data-act="));

  const head = V.tableHead(wh, "code", true);
  check("active sort column is marked ascending", head.includes('aria-sort="ascending"'));
  check("sortable header carries its key", head.includes('data-sortkey="code"'));
  // core/ui.ts owns th[data-sort]; a master table sorts on the server.
  check("master header avoids the client-side sort hook", !/<th[^>]*\sdata-sort[=\s>]/.test(head), head);

  check("empty list offers the primary action", V.emptyState(wh, false).includes('data-act="create"'));
  check("filtered empty list offers a way back", V.emptyState(wh, true).includes('data-act="clear"'));
  check("error state offers a retry", V.errorState("boom", "abc123").includes('data-act="retry"'));
  check("error state shows the trace id", V.errorState("boom", "abc123").includes("abc123"));
  check("foot summary counts rows", V.footSummary(25, 612, "คลัง").includes("612"));
  check("row id reads idKey", V.rowId(wh, rows[0]) === "WH000001");
}

console.log("# master requests (stubbed fetch)");
{
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => void mem.set(k, String(v)),
    removeItem: (k) => void mem.delete(k),
    clear: () => mem.clear(),
  };
  globalThis.document = { querySelector: () => null };
  globalThis.location = { hostname: "localhost", pathname: "/warehouses.html", search: "" };
  globalThis.window = globalThis;
  const BASE3 = (await mod("../public/assets/js/core/config.js")).apiBase();

  const T = await mod("../public/assets/js/core/tokens.js");
  const REPO = await mod("../public/assets/js/master/repo.js");
  const R = await mod("../public/assets/js/master/resources.js");

  const realFetch = globalThis.fetch;
  let calls = [];
  const page = (items = []) =>
    new Response(
      JSON.stringify({
        status: "success", message: "ok", code: "OK", trace_id: "t",
        data: { items, page: 1, limit: 25, total: items.length, total_pages: 1 },
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  let handler = () => page();
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init, calls.length);
  };
  T.store({
    access_token: "a", refresh_token: "r", token_type: "Bearer", expires_in: 900,
    user: { user_id: "U1", user_name: "jack", full_name: "j", email: null,
            user_level: "ADMIN", must_change_password: false, last_login_date: null },
  });

  const query = (n = 0) => new URL(calls[n].url).searchParams;
  const reset = () => { calls = []; handler = () => page(); REPO.forgetOptions("warehouse"); REPO.forgetOptions("customer-type"); };

  const wh = R.MASTER_BY_NAME["warehouse"];
  reset();
  await REPO.listRows(wh, { page: 2, limit: 25, q: "ศูนย์", sort: "code", asc: true,
    isActive: true, filters: { warehouse_type: "DC", province: "" } });
  check("list hits the resource path", calls[0].url.startsWith(BASE3 + "/warehouse?"), calls[0].url);
  check("page and limit are sent", query().get("page") === "2" && query().get("limit") === "25");
  check("search goes to the API as q", query().get("q") === "ศูนย์");
  check("ascending sort has no minus", query().get("sort") === "code");
  check("is_active filter is sent", query().get("is_active") === "true");
  check("declared filter is sent", query().get("warehouse_type") === "DC");
  check("empty filter is dropped", query().has("province") === false);

  reset();
  await REPO.listRows(wh, { page: 1, limit: 25, sort: "name", asc: false });
  check("descending sort is prefixed with minus", query().get("sort") === "-name", query().get("sort"));
  check("absent search is not sent", query().has("q") === false);
  check("absent status is not sent", query().has("is_active") === false);

  // vw_customer_route has no is_active column — the request must not ask.
  reset();
  await REPO.listRows(R.MASTER_BY_NAME["customer-route"], { page: 1, limit: 25, isActive: true });
  check("customer-route never filters on is_active", query().has("is_active") === false, calls[0].url);

  reset();
  handler = () => new Response(JSON.stringify({ status: "success", message: "ok", code: "OK",
    trace_id: "t", data: { warehouse_id: "WH1" } }), { status: 200, headers: { "content-type": "application/json" } });
  await REPO.getRow(wh, "WH 1/A");
  check("business id is URL-encoded", calls[0].url.endsWith("/warehouse/WH%201%2FA"), calls[0].url);

  reset();
  handler = () => new Response(null, { status: 204 });
  check("delete resolves on 204", (await REPO.deleteRow(wh, "WH1")) === null);
  check("delete uses DELETE", calls[0].init.method === "DELETE");

  reset();
  handler = () => page([{ customer_type_id: "CT1", type_name: "ร้านค้าปลีก", base_credit_day: 30 }]);
  const first = await REPO.options("customer-type");
  const second = await REPO.options("customer-type");
  check("ref options map to id + label", first[0].value === "CT1" && first[0].label === "ร้านค้าปลีก",
    JSON.stringify(first[0]));
  check("ref options are cached", calls.length === 1, `${calls.length} calls`);
  check("cached call returns the same list", second === first);
  check("ref options ask for active rows only", query().get("is_active") === "true");
  check("ref options ask for a full page", query().get("limit") === "200");

  REPO.forgetOptions("customer-type");
  calls = [];
  await REPO.options("customer-type");
  check("forgetOptions drops the cache", calls.length === 1, `${calls.length} calls`);

  calls = [];
  await REPO.options("customer-type", "ปลีก");
  check("a search is a separate cache entry", calls.length === 1);
  check("a search asks the API, not the cached page", query().get("q") === "ปลีก");
  check("a search asks for a short list", query().get("limit") === "20");

  check("unknown resource yields no options", (await REPO.options("nope")).length === 0);

  globalThis.fetch = realFetch;
  T.clear();
  globalThis.location = { hostname: "localhost", pathname: "/dashboard.html", search: "" };
}

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

/* ------------------------------------------------ CSP ↔ config.ts origin */
// public/_headers and config.ts each name the API origin, and nothing links
// them. Getting them out of step breaks every deployed request while local
// development stays green, because tools/serve.mjs sends no CSP at all.
console.log("# csp ↔ api origin");
{
  const headers = readFileSync(new URL("../public/_headers", import.meta.url), "utf8");
  const config = readFileSync(new URL("../src/ts/core/config.ts", import.meta.url), "utf8");

  const prod = config.match(/const PROD_ORIGIN = "([^"]+)"/)?.[1];
  check("config.ts declares PROD_ORIGIN", Boolean(prod), String(prod));

  const csp = headers.match(/Content-Security-Policy:.*/)?.[0] ?? "";
  const connect = csp.match(/connect-src ([^;]+)/)?.[1] ?? "";
  check("CSP allows the API origin in connect-src", prod ? connect.includes(prod) : false, connect.trim());

  // Nothing under assets/js or assets/css carries a content hash, so any
  // lifetime at all leaves a returning visitor running the previous deploy —
  // fresh HTML calling into a bundle that does not know the new routes.
  const rule = (path) => {
    const block = headers.split(/\n(?=\/)/).find((b) => b.startsWith(path + "\n"));
    return block?.match(/Cache-Control:\s*(.+)/)?.[1]?.trim() ?? "";
  };
  for (const path of ["/*.html", "/assets/js/*", "/assets/css/*"]) {
    const value = rule(path);
    check(`${path} revalidates on every load`, /max-age=0/.test(value) && /must-revalidate/.test(value), value);
  }
  check("images keep a real cache lifetime", /max-age=[1-9]/.test(rule("/assets/image/*")), rule("/assets/image/*"));
}

/* --------------------------------------------------- version ↔ package.json */
// The screen prints core/version.ts, the release tag comes from package.json,
// and nothing links them. A version string that disagrees with the artifact it
// ships in is how the old "เกี่ยวกับระบบ" card came to claim v4.0.0 forever.
console.log("# version");
{
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const V = await mod("../public/assets/js/core/version.js");
  check("WEB_VERSION matches package.json", V.WEB_VERSION === pkg.version, `${V.WEB_VERSION} vs ${pkg.version}`);

  const settings = readFileSync(new URL("../public/settings.html", import.meta.url), "utf8");
  for (const id of ["pb-ver-web", "pb-ver-api", "pb-ver-base", "pb-ver-status"]) {
    check(`settings.html has #${id}`, settings.includes(`id="${id}"`), id);
  }
  // The card used to hardcode versions of things it cannot see.
  check("settings.html states no API version of its own", !/v4\.0\.0/.test(settings));

  // /version and /healthz live on the app root, not under /api/v2.
  const CFG3 = await mod("../public/assets/js/core/config.js");
  check("apiRoot drops the version prefix", !/\/api\/v\d+$/.test(CFG3.apiRoot()), CFG3.apiRoot());
  check("apiRoot is a prefix of apiBase", CFG3.apiBase().startsWith(CFG3.apiRoot()), CFG3.apiRoot());
}

/* ---------------------------------------------------------------- enums.ts */
// The three coded lists exist in the CHECK constraint, in the Go descriptors
// and here. This suite covers the rule that keeps the third copy honest:
// the server decides membership, the local array decides only order.
console.log("# enums");
{
  const E = await mod("../public/assets/js/core/enums.js");
  const R2 = await mod("../public/assets/js/master/resources.js");
  E.reset();

  const fallback = ["DC", "BRANCH", "RETURN"];
  check("no server answer → fallback unchanged", E.values("warehouse_warehouse_type", fallback) === fallback);

  globalThis.sessionStorage = (() => {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => void m.set(k, String(v)),
      removeItem: (k) => void m.delete(k),
    };
  })();

  const realFetch2 = globalThis.fetch;
  let hits = 0;
  globalThis.fetch = async () => {
    hits++;
    return new Response(
      JSON.stringify({
        status: "success",
        message: "ok",
        code: "OK",
        trace_id: "t",
        // Alphabetical, one value this build does not know, one it lists but
        // the database no longer accepts (RETURN is absent).
        data: { warehouse_warehouse_type: ["BRANCH", "DC", "LOCKER"] },
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };

  await E.loadEnums();
  const merged = E.values("warehouse_warehouse_type", fallback);
  check("server list wins over the fallback", merged.join(",") === "DC,BRANCH,LOCKER", merged.join(","));
  check("fallback order survives", merged[0] === "DC" && merged[1] === "BRANCH");
  check("unknown value is appended, not dropped", merged.includes("LOCKER"));
  check("value the database dropped disappears", !merged.includes("RETURN"));
  check("a key the server never sent falls back", E.values("route_route_type", ["DAILY"]).join(",") === "DAILY");

  await E.loadEnums();
  check("session cache spares a second call", hits === 1, `fetch called ${hits}×`);

  // A failing endpoint must leave the screen usable, not throw into the caller.
  E.reset();
  globalThis.fetch = async () => {
    throw new Error("offline");
  };
  let threw = false;
  await E.loadEnums().catch(() => (threw = true));
  check("loadEnums never rejects", !threw);
  check("after a failure the fallback still answers", E.values("warehouse_warehouse_type", fallback) === fallback);
  globalThis.fetch = realFetch2;

  // The keys are `<table without tb_>_<column>`, which is how the meta handler
  // names them. Getting one wrong fails silently: the fallback answers forever.
  check("warehouse key", R2.WAREHOUSE_TYPE_KEY === "warehouse_warehouse_type", R2.WAREHOUSE_TYPE_KEY);
  check("route key", R2.ROUTE_TYPE_KEY === "route_route_type", R2.ROUTE_TYPE_KEY);
  check("trade key", R2.TRADE_TYPE_KEY === "vendor_trade_type", R2.TRADE_TYPE_KEY);

  // Every enum control must declare a key, or it is a hardcoded list again.
  for (const m of R2.MASTERS) {
    for (const f of m.fields) {
      if (f.enumValues) check(`${m.name}: field ${f.name} declares enumKey`, !!f.enumKey, f.name);
    }
    for (const f of m.filters ?? []) {
      if (f.enumKey) check(`${m.name}: filter ${f.param} has labels`, !!f.enumLabels, f.param);
    }
  }
}

/* ------------------------------------------------------- document engine */
// The document screens are generated from descriptors like the master ones,
// but the rules they have to respect are stricter: a wrong status guard is a
// button that moves stock when the user thought they were still drafting.
console.log("# document registry");
{
  const D = await mod("../public/assets/js/docs/resources.js");
  const S = await mod("../public/assets/js/docs/schema.js");
  const R3 = await mod("../public/assets/js/master/resources.js");

  check("registry holds the declared documents", D.DOCS.length >= 1, D.DOCS.length);
  check("page ids are unique", new Set(D.DOCS.map((d) => d.page)).size === D.DOCS.length);
  check("names are unique", new Set(D.DOCS.map((d) => d.name)).size === D.DOCS.length);

  for (const d of D.DOCS) {
    check(`${d.name}: idKey set`, typeof d.idKey === "string" && d.idKey.length > 0);
    check(`${d.name}: has list columns`, d.columns.length > 0);
    check(`${d.name}: has item columns`, d.itemColumns.length > 0);
    check(`${d.name}: has header fields`, d.headerFields.length > 0);
    check(`${d.name}: has item fields`, d.itemFields.length > 0);

    // The list endpoint takes no sort parameter, so a column may not claim one.
    check(`${d.name}: no column claims a sort key`, d.columns.every((c) => c.sort === undefined));

    check(`${d.name}: statuses include DRAFT`, d.statuses.includes("DRAFT"));
    check(`${d.name}: statuses include CONFIRMED`, d.statuses.includes("CONFIRMED"));
    check(`${d.name}: statuses include CANCELLED`, d.statuses.includes("CANCELLED"));
    check(`${d.name}: postedStatus is a known status`, d.statuses.includes(d.postedStatus), d.postedStatus);
    check(
      `${d.name}: every postedStatus is a known status`,
      d.postedStatuses.every((v) => d.statuses.includes(v)),
      d.postedStatuses.join(",")
    );
    check(
      `${d.name}: postedStatuses contains postedStatus`,
      d.postedStatuses.includes(d.postedStatus)
    );
    for (const st of d.statuses) {
      check(`${d.name}: status ${st} has a label`, !!d.statusStyle[st]?.label, st);
    }

    // Refs resolve against master resources — that is where their options
    // come from, and a name with no descriptor is a picker that stays empty.
    for (const ref of [...d.headerRefs, ...d.itemRefs]) {
      check(`${d.name}: ref ${ref.field} → known resource`, !!R3.MASTER_BY_NAME[ref.resource], ref.resource);
    }
    for (const f of [...d.headerFields, ...d.itemFields]) {
      check(`${d.name}: field ${f.name} has a label`, !!f.label);
      if (f.enumValues) check(`${d.name}: field ${f.name} declares enumKey`, !!f.enumKey, f.name);
    }
    for (const f of d.filters ?? []) {
      const declared = f.resource ? !!R3.MASTER_BY_NAME[f.resource] : f.free || (f.options?.length ?? 0) > 0;
      check(`${d.name}: filter ${f.param} has a source`, declared, JSON.stringify(f));
    }
  }

  check("page id resolves back", D.DOCS.every((d) => D.docForPage(d.page) === d));
  check("unknown page resolves to nothing", D.docForPage("nope") === undefined);

  // ใบรับสินค้า specifics, straight from specs.go.
  const rn = D.RECEIVE_NOTE;
  check("receive-note path matches the Go spec name", rn.name === "receive-note");
  check("receive-note ends at POSTED", rn.postedStatus === "POSTED");
  check("receive-note items are keyed by sku_id", rn.itemRefs.some((r) => r.field === "sku_id"));
  check("doc_no cannot be updated", rn.headerFields.find((f) => f.name === "doc_no")?.noUpdate === true);
  check("qty is required", rn.itemFields.find((f) => f.name === "qty")?.required === true);
  check("unit_cost is required", rn.itemFields.find((f) => f.name === "unit_cost")?.required === true);
  check("trade_type reads the live enum", rn.headerFields.find((f) => f.name === "trade_type")?.enumKey === "vendor_trade_type");

  // The lifecycle table. Every line here is a guard PenbunAPI enforces too;
  // the screen's job is to never offer what the server would refuse.
  const A = (st) => S.actions(st);
  check("DRAFT can be edited", A("DRAFT").edit === true);
  check("DRAFT can be confirmed", A("DRAFT").confirm === true);
  check("DRAFT can be cancelled", A("DRAFT").cancel === true);
  check("DRAFT can be deleted", A("DRAFT").remove === true);
  check("DRAFT cannot be posted", A("DRAFT").post === false);

  check("CONFIRMED can be posted", A("CONFIRMED").post === true);
  check("CONFIRMED can be cancelled", A("CONFIRMED").cancel === true);
  check("CONFIRMED cannot be edited", A("CONFIRMED").edit === false);
  check("CONFIRMED cannot be deleted", A("CONFIRMED").remove === false);
  check("CONFIRMED cannot be confirmed again", A("CONFIRMED").confirm === false);

  for (const terminal of ["POSTED", "DELIVERED", "INVOICED", "CANCELLED"]) {
    const a = A(terminal);
    check(`${terminal} offers nothing`,
      !a.edit && !a.confirm && !a.post && !a.cancel && !a.remove, JSON.stringify(a));
  }

  check("isPosted follows the spec, not a shared constant", S.isPosted(rn, "POSTED") && !S.isPosted(rn, "DELIVERED"));
}

console.log("# document view");
{
  const D = await mod("../public/assets/js/docs/resources.js");
  const V2 = await mod("../public/assets/js/docs/view.js");
  const rn = D.RECEIVE_NOTE;

  const head = V2.listHead(rn);
  check("list head has no sortable header", !head.includes("data-sortkey") && !head.includes("pb-th-sort"));
  check("list head ends with a status column", head.includes("สถานะ"));

  const rows = [
    { receive_note_id: "RCV1", doc_no: "A/1", doc_date: "2026-08-20", vendor_name: "ก", trade_type: "BUY",
      total_qty: 10, total_amount: 250, doc_status: "POSTED" },
  ];
  const body = V2.listBody(rn, rows);
  check("row carries its business id", body.includes('data-id="RCV1"'));
  check("status renders as its Thai label", body.includes("รับเข้าสต็อกแล้ว"), body.slice(0, 200));
  check("list body escapes markup", !V2.listBody(rn, [{ receive_note_id: "<x>", doc_no: "<b>" }]).includes("<b>"));

  const draft = V2.editorShell(rn, { header: { doc_status: "DRAFT", receive_note_id: "RCV1" }, items: [], creating: false });
  check("draft renders editable lines", draft.includes("pb-doc-lines"));
  check("draft offers ยืนยันเอกสาร", draft.includes('data-act="confirm"'));
  check("draft offers delete", draft.includes('data-act="delete"'));
  check("draft does not offer post", !draft.includes('data-act="post"'));

  const confirmed = V2.editorShell(rn, { header: { doc_status: "CONFIRMED", receive_note_id: "RCV1" }, items: [], creating: false });
  check("confirmed offers the post action", confirmed.includes('data-act="post"'));
  check("confirmed uses the spec's post wording", confirmed.includes(rn.postLabel));
  check("confirmed locks the header fieldset", confirmed.includes("<fieldset class=\"pb-formgrid\" id=\"pb-doc-header\" disabled>"));
  check("confirmed hides the line editor", !confirmed.includes("pb-doc-lines"));

  const posted = V2.editorShell(rn, { header: { doc_status: "POSTED", receive_note_id: "RCV1" }, items: [], creating: false });
  check("posted offers no write action",
    !posted.includes('data-act="post"') && !posted.includes('data-act="save"') &&
    !posted.includes('data-act="cancel"') && !posted.includes('data-act="delete"'));

  // No screen may offer a reversal until PUT /{doc}/{id}/reverse exists.
  for (const [name, html] of [["draft", draft], ["confirmed", confirmed], ["posted", posted]]) {
    check(`${name} offers no reversal`, !html.includes('data-act="reverse"'), name);
  }

  const creating = V2.editorShell(rn, { header: {}, items: [], creating: true });
  check("new document starts editable", creating.includes("pb-doc-lines"));
  check("new document has one blank line", (creating.match(/<tr data-line>/g) ?? []).length === 1);
  check("new document says totals come later", creating.includes("ยอดรวมจะคำนวณเมื่อบันทึก"));
}

console.log("# document requests (stubbed fetch)");
{
  const REPO2 = await mod("../public/assets/js/docs/repo.js");
  const D = await mod("../public/assets/js/docs/resources.js");
  const rn = D.RECEIVE_NOTE;
  const BASE4 = (await mod("../public/assets/js/core/config.js")).apiBase();

  const realFetch3 = globalThis.fetch;
  let calls = [];
  const detail = () =>
    new Response(
      JSON.stringify({
        status: "success", message: "ok", code: "OK", trace_id: "t",
        data: { header: { receive_note_id: "RCV1", doc_status: "DRAFT" }, items: [] },
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return detail();
  };
  const reset = () => (calls = []);
  const query = () => new URL(calls[0].url).searchParams;

  reset();
  await REPO2.listDocs(rn, {
    page: 2, limit: 25, status: "DRAFT", docNo: "A/1",
    dateFrom: "2026-08-01", dateTo: "2026-08-31",
    filters: { vendor_id: "VEN1", warehouse_code: "" },
  });
  check("list hits the document path", calls[0].url.startsWith(BASE4 + "/receive-note?"), calls[0].url);
  check("status goes out as doc_status", query().get("doc_status") === "DRAFT");
  check("search goes out as doc_no", query().get("doc_no") === "A/1");
  check("date range is sent", query().get("date_from") === "2026-08-01" && query().get("date_to") === "2026-08-31");
  check("declared filter is sent", query().get("vendor_id") === "VEN1");
  check("empty filter is dropped", query().has("warehouse_code") === false);
  // The endpoint accepts neither, and sending them would be a 400 waiting to happen.
  check("never sends sort", query().has("sort") === false);
  check("never sends q", query().has("q") === false);

  reset();
  await REPO2.getDoc(rn, "RCV 1/A");
  check("business id is URL-encoded", calls[0].url.endsWith("/receive-note/RCV%201%2FA"), calls[0].url);

  reset();
  await REPO2.createDoc(rn, { doc_no: "A/1", items: [{ sku_id: "SKU1", qty: 1, unit_cost: 2 }] });
  check("create posts to the collection", calls[0].init.method === "POST" && calls[0].url.endsWith("/receive-note"));
  check("create carries its items", JSON.parse(calls[0].init.body).items.length === 1);

  reset();
  await REPO2.replaceDocItems(rn, "RCV1", [{ sku_id: "SKU1", qty: 1 }]);
  check("items replace hits /items", calls[0].url.endsWith("/receive-note/RCV1/items"), calls[0].url);
  check("items replace is a PUT", calls[0].init.method === "PUT");
  check("items replace wraps the array", Array.isArray(JSON.parse(calls[0].init.body).items));

  for (const [fn, suffix] of [["confirmDoc", "/confirm"], ["postDoc", "/post"], ["cancelDoc", "/cancel"]]) {
    reset();
    await REPO2[fn](rn, "RCV1");
    check(`${fn} → ${suffix}`, calls[0].url.endsWith("/receive-note/RCV1" + suffix), calls[0].url);
    check(`${fn} is a PUT`, calls[0].init.method === "PUT");
    check(`${fn} sends no body`, calls[0].init.body === undefined, String(calls[0].init.body));
  }

  reset();
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(null, { status: 204 });
  };
  await REPO2.deleteDoc(rn, "RCV1");
  check("delete uses DELETE on the row", calls[0].init.method === "DELETE" && calls[0].url.endsWith("/receive-note/RCV1"));

  globalThis.fetch = realFetch3;
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
