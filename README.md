# PenbunWeb — beta 1.4.0

Front end for **Penbun System**, a wholesale and distribution system for books and stationery.
Built with **pure HTML + CSS + TypeScript**, with no framework and no runtime dependency.

> **New in 1.4.0:** the discount map — **กลุ่มส่วนลด** and **กฎส่วนลด**, the two screens behind
> PenbunSQL v9's `tb_discount_group` and `tb_price_rule`. A customer's group is a real reference
> now, not a text box that resolved against nothing. The database owns the arithmetic
> (`UFN_RESOLVE_DISCOUNT`); these screens own the rules that feed it.
>
> **Scope of this release:** look and feel plus UX/UI, **real authentication**, and
> **all 20 master-data screens reading and writing PenbunAPI for real**.
> Sign-in, sign-out, token refresh and the forced first password change talk to PenbunAPI;
> so do product, SKU, book, warehouse, route, vendor, customer, discount and every reference table.
> Documents, stock, consignment, allocation and reports are still sample data from `src/ts/data/mock.ts`.
> Buttons that are not implemented show a toast instead of silently doing nothing or failing.

---

## 1. Getting Started

```bash
npm install          # installs TypeScript only
npm run dev          # build + open http://localhost:4173
```

Other commands:

| Command | Description |
|---|---|
| `npm run build` | Compile `src/ts` → `public/assets/js` |
| `npm run watch` | Compile continuously |
| `npm run typecheck` | Type-check without emitting files |
| `npm run serve` | Static server with a `404.html` fallback |
| `npm run preview` | Build and run through Wrangler Pages |
| `npm run deploy` | Build and upload `public/` to Cloudflare Pages |
| `npm run gen:master` | Build, then write one HTML file per master resource from the registry |
| `python3 tools/gen_pages.py` | Generate the remaining mock list/error pages from the shared template |
| `node tools/gen_thai_address.mjs` | Rebuild the Thai address tables in `public/assets/data/th` (`--src DIR` · `--sql DIR` · `--no-sql`) |

**Sign in:** a real PenbunAPI account. `POST /auth/login` issues the token pair.
Click **ดู UI แบบสาธิต** to browse the screens with no API running — that session never calls the API.
**Sign out:** open the user menu in the top-right corner. The access token is revoked
server-side through `POST /auth/logout`, the local session is cleared either way, and the app returns to login.

### Pointing the front end at an API

The base URL is resolved at runtime by `src/ts/core/config.ts`, so one build works everywhere:

| Priority | Source | Use |
|---|---|---|
| 1 | `localStorage["penbun.apiBase"]` | Per-browser override — `penbun.setApiBase("https://…")` |
| 2 | `<meta name="penbun-api-base" content="…">` | Per-deployment override |
| 3 | `API_TARGET` in `config.ts` | `"auto"` (default), `"prod"`, or `"dev"` |

`API_TARGET` is the one line to edit, and `"auto"` is the answer almost every day:

| `API_TARGET` | Served from localhost | Served from anywhere else |
|---|---|---|
| `"auto"` | `http://localhost:8089/api/v2` | `PROD_ORIGIN` + `/api/v2` |
| `"prod"` | `PROD_ORIGIN` + `/api/v2` | `PROD_ORIGIN` + `/api/v2` |
| `"dev"` | `http://localhost:8089/api/v2` | `http://localhost:8089/api/v2` |

`"auto"` is the guard rail, not just a convenience: under `"prod"` a page opened on
localhost reads and writes the production database, so saving a record while developing
is a real production write. Set `"prod"` or `"dev"` deliberately and briefly.

To switch one tab instead of the whole build, use the console — it leaves no edit to
forget to revert:

```js
penbun.apiBase()                                     // what am I talking to?
penbun.setApiBase("http://localhost:8089/api/v2")    // this tab only
penbun.setApiBase(null)                              // back to API_TARGET
```

The prefix is `/api/v2` because that is what `main.go` mounts. PenbunAPI's README calls it v4;
the router is the contract.

Three settings must agree or every request fails before it starts:

- PenbunAPI `CORS_ORIGINS` must list this app's origin — the Pages domain for deployed
  builds, plus `http://localhost:4173` for `npm run dev`.
- `public/_headers` `connect-src` must list the API origin, or the browser blocks the
  request before CORS is even consulted. `npm test` fails if it drifts from `PROD_ORIGIN`.
- `PROD_ORIGIN` in `config.ts` is where the API actually lives. Moving the API means
  editing it and `public/_headers` together.

---

## 2. Project Structure

```text
penbunweb/
├─ public/                     ← served directly
│  ├─ index.html               ← login
│  ├─ dashboard.html           ← post-login landing page
│  ├─ stock.html · movements.html · transfers.html      ← still mock data
│  ├─ doc-receive.html · doc-order.html · doc-return.html · doc-vendor-return.html
│  ├─ consignment.html · allocation.html · users.html · reports.html
│  ├─ master.html            ← hub for the 20 master screens
│  ├─ products.html · books.html · product-skus.html · warehouses.html
│  ├─ routes.html · customer-routes.html · vendors.html · customers.html · discounts.html
│  ├─ company.html · customer-types.html · vendor-types.html · discount-types.html
│  ├─ product-categories.html · product-groups.html · product-formats.html
│  ├─ unit-types.html · book-types.html                ← generated by npm run gen:master
│  ├─ settings.html · profile.html
│  ├─ 401.html · 403.html · 404.html · 500.html · 502.html · 503.html
│  ├─ _headers                 ← security headers + cache rules
│  └─ assets/
│     ├─ css/  01-tokens · 02-base · 03-layout · 04-components · 05-pages
│     ├─ data/ th/  จังหวัด → อำเภอ → ตำบล → ไปรษณีย์ (generated, committed)
│     └─ js/   (tsc output — not committed)
├─ src/ts/                     ← 40 pages in public/, all fed from here
│  ├─ core/       config · tokens · api · auth · theme · nav · ui · charts · icons · format
│  │              enums · version · schema · fields · table · address ← shared by both engines
│  ├─ master/     schema · resources · repo · view · form · page · hub   ← the master engine
│  ├─ docs/       schema · resources · repo · view · page              ← the document engine
│  ├─ components/ brand · sidebar · nav-menu · topbar · theme-toggle · footer
│  ├─ layouts/    app-layout.ts   ← wraps every page's content in the shell
│  ├─ data/       mock.ts         ← sample data for the screens not yet wired
│  ├─ pages/      dashboard.ts · settings.ts · profile.ts · users.ts
│  ├─ main.ts        ← entry point for shell pages
│  └─ standalone.ts  ← entry point for login/error pages
├─ tools/  gen_pages.py · gen_master_pages.mjs · gen_thai_address.mjs · serve.mjs · test.mjs
├─ wrangler.toml   ← Cloudflare Pages config (output dir = public)
├─ .nvmrc           ← pins Node 20 for Cloudflare builds
├─ DESIGN.md        ← design concept + prompts for adding screens
└─ tsconfig.json · package.json
```

### Important Principle: The Menu Has One Source of Truth

Each page file contains only its own content inside `<div id="pb-page" data-page="...">`.
At runtime, `src/ts/layouts/app-layout.ts` wraps it with the sidebar, topbar, and footer using the menu
from `src/ts/core/nav.ts`. To add or edit a menu item, change `nav.ts` once instead of updating every page.

Pages reachable only from the master hub live in `HUB_ITEMS` rather than `NAV`, so they stay out of the
sidebar but still resolve a title and a highlighted parent. Both lists feed `NAV_INDEX`, which is what
`tools/test.mjs` checks every page id against.

---

## 3. Light/Dark Theme

The theme follows [cookievirus/darkmode](https://github.com/cookievirus/darkmode):

1. Store the user choice in `localStorage["penbun.theme"]` as `light`, `dark`, or `auto`.
2. Apply it to `<html>` as both a class (`.light` / `.dark`) and the `data-bs-theme` attribute.
3. A short inline script in every page `<head>` runs before first paint, preventing a white flash.
4. `auto` listens live to `prefers-color-scheme` and synchronizes between tabs through the `storage` event.

The topbar button cycles light → dark → auto. The settings page exposes direct choices.

---

## 4. Color and Type

| Role | Value | Usage |
|---|---|---|
| Primary / Brand | `rgb(249 115 22)` `#F97316` | Primary action, active menu, route rail, main chart line |
| Dark surface | `rgb(17 24 39)` `#111827` | Cards in dark mode |
| Dark canvas | `rgb(6 7 18)` `#060712` | Dark page background and login left panel |
| Light canvas | `rgb(248 250 252)` `#F8FAFC` | Light page background |
| Positive | `rgb(22 163 74)` `#16A34A` | Posted items, receipts, increases |
| Negative | `rgb(255 30 30)` `#FF1E1E` | Cancellations, below-reorder items, urgent reductions |

All colors are declared once in `01-tokens.css`; other CSS files must use variables such as
`var(--pb-brand)`, `var(--pb-surface)`, and `var(--pb-pos)`. See `DESIGN.md` for the rationale.

Typography:

- UI/body and numeric values: **Google Sans** (loaded from Google Fonts CDN).
- Document numbers and SKUs: **IBM Plex Mono**.
- Base size is 14px, table text is 13px, and numeric cells use `tabular-nums`.

---

## 5. Screens in This Release

**Login** — split left/right layout with support for both themes, wired to PenbunAPI.
Failures are shown in place and named: wrong credentials, locked account (`ACCOUNT_LOCKED`),
unreachable API, database unavailable. A first-time account is sent to the change-password
step on the same page, because PenbunAPI blocks every other route until it is done.

**Dashboard** — four KPI cards, the **route rail** (signature element), sales trend chart, stock mix donut, recent documents, today’s activity, top-selling products, and below-reorder products.

**Master data (20 screens + hub)** — real CRUD against PenbunAPI. Server-side search,
filter, sort and paging; create/edit dialogs generated from the descriptor; soft delete with
confirmation. See §6.

**Discount map (new in 1.4.0)** — **กลุ่มส่วนลด** carries the customer groups; **กฎส่วนลด**
carries one row per rule, scoped to a group, a customer, a route or a SKU. Rules that are not
`บวกทับ` compete and the most specific one wins; `บวกทับ` rules add on top of that winner. The
form shows all four target fields at once and each hint names the scope it belongs to — the
database refuses a mismatch, so nothing invalid saves. Reasoning: `../DISCOUNT-MODEL.md`.

**List pages (mock)** — searchable/filterable toolbars, sortable tables and pagination for
stock, movements, transfers, the four document types, consignment, allocation history,
and reports. These still read `mock.ts`.

**ผู้ใช้และสิทธิ์** — reads `GET /user`, which PenbunAPI mounts read-only and ADMIN-only, so the
screen lists, searches, filters (สิทธิ์ · สถานะ · ล็อก) and pages, but offers no form. Its one
write is the one the API has: `PUT /users/{user_id}/unlock`. A non-ADMIN account gets the 403
spelled out rather than an empty table. Columns come from `vw_users` (PenbunSQL v11), which
withholds `user_password` and `counting_password_fail`.

**Settings** — forms, tabs, and the “About system” card, which reports only what `GET /version`
and this build can vouch for.

**Profile** — the left card and the ข้อมูลผู้ใช้ tab read the signed-in session, so every box on
them is one column of `tb_users`: `full_name`, `user_name`, `email`, `user_id`, `user_level`,
`last_login_date`. Fields the table has no column for are not on the screen — a form that
collects what nothing can store is a form that lies. The avatar is two letters taken from the
username, first and last (`root` → `rt`, `user01` → `u1`), because `full_name` is nullable and
Thai names have no capitals to lean on. Saving is still a stub: PenbunAPI v4 has no
profile-update route. The สิทธิ์การใช้งาน and อุปกรณ์ที่ใช้งาน tabs are still mock — RBAC and
session tables do not exist yet.

**Error pages** — `401`, `403`, `404`, `500`, `502`, and `503`, with reference codes and working back/retry/copy actions.

---

## 6. Connecting the Real API

| Change | File | Status |
|---|---|---|
| Login | `src/ts/core/auth.ts` → `signIn()` | **Done** — `POST /auth/login`, pair stored by `core/tokens.ts` |
| Logout | `signOut()` | **Done** — `POST /auth/logout`, then the local session is cleared |
| Token refresh | `src/ts/core/api.ts` → `refreshSession()` | **Done** — single-flight, retried once on `TOKEN_EXPIRED` |
| Forced first password change | `standalone.ts` + `#pb-changepw` | **Done** — `POST /auth/change-password` |
| Page protection | `requireSession()` + `validateSession()` | **Done** — instant local guard, then `GET /auth/me` |
| Master data (20 resources) | `src/ts/master/*` | **Done** — list, create, edit, soft delete against the five CRUD endpoints |
| ใบรับสินค้า | `src/ts/docs/*` | **Done** — list, editor, confirm, post, cancel, delete against the nine endpoints |
| ใบส่งหนังสือ · ใบรับคืน · ใบส่งคืนคู่ค้า | `doc-order.html`, `doc-return.html`, `doc-vendor-return.html` | Open — same engine, one descriptor each, plus the rule each carries |
| Stock · consignment · allocation | `stock.html`, `movements.html`, … | Open — `/stock/*`, `/consign/*`, `/allocation/*` |
| Profile (read) | `src/ts/pages/profile.ts` | **Done** — rendered from the session `GET /auth/me` returns |
| Profile (save) | `profile.html` → บันทึกการแก้ไข | Blocked — PenbunAPI has no profile-update route, only `/auth/me` and `/auth/change-password` |
| Users (list) | `src/ts/pages/users.ts` | **Done** — `GET /user`, read-only and ADMIN-only |
| Unlock a user | `users.html` → ปลดล็อก | **Done** — `PUT /users/{user_id}/unlock` |
| User create/edit | — | Blocked — PenbunAPI has no user CRUD; passwords and levels must not go through the generic engine |
| Permission-based menu | `src/ts/core/nav.ts` | Blocked — needs role/permission tables; PenbunSQL v8 still has none |
| Enum options | `src/ts/core/enums.ts` | **Done** — `GET /meta/enums`; the arrays in `master/resources.ts` are now only a fallback |
| Version number | `settings.html`, “About system” | **Done** — `GET /version`, plus `WEB_VERSION` in `core/version.ts` |

### The master-data engine

PenbunAPI declares its 20 master resources as descriptors and gets five endpoints each from one
generic engine. `src/ts/master/` is the same idea on this side: **a master screen is declared,
not written.**

```text
master/schema.ts      Field · Ref · FilterDef · Column · MasterResource   (mirrors internal/schema + internal/crud)
master/resources.ts   the 20 descriptors, in the order of resources.All()
master/repo.ts        the five requests + the ref-option cache
master/view.ts        table · toolbar · states · pagination  (markup only)
master/form.ts        the create/edit dialog, built from Field[] and Ref[]
master/page.ts        the controller: URL-backed state, single-flight requests
master/hub.ts         master.html — the index of all 18
```

Three modules under `core/` are shared with the document engine, because PenbunAPI shares the
same ones between its two engines: `core/schema.ts` (Field · Ref · FilterDef, mirroring
`internal/schema`), `core/fields.ts` (one input control per Field, plus reading the form back)
and `core/table.ts` (cells, pagination, states).

**Adding a resource** takes two steps: append a descriptor to `MASTERS`, then run
`npm run gen:master` to write its HTML file. No markup, no fetch code, no form.

Four things the engine does deliberately:

- **Search, filter, sort and paging are server-side.** `core/ui.ts` owns `th[data-sort]` and
  `[data-table-filter]` for client-side tables; master tables use `data-sortkey` instead so the
  two never fight over the same table. Filtering 25 of 4,000 rows in the browser finds nothing
  and looks broken.
- **List state lives in the URL**, so a filtered list can be linked to and reloaded in place.
- **Update sends only what changed.** PenbunAPI rejects `NoUpdate` fields outright and answers
  “ไม่มีข้อมูลที่ต้องแก้ไข” to an empty body; clearing a value sends `null`, which writes NULL.
- **Validation is the database's answer, not the browser's.** Required and max-length are checked
  to save a round trip. Everything else arrives as `errors[]` and is pinned onto the field it names.

One limit inherited from the contract, worth knowing before filing a bug:

- An **optional ref cannot be cleared**. `ResolveRefs` treats `null` as “not sent”, so a ref can be
  pointed elsewhere but not emptied.

#### The address picker — จังหวัด → อำเภอ/เขต → ตำบล/แขวง → รหัสไปรษณีย์

An address is four `nvarchar` columns in PenbunSQL — `province`, `district`, `sub_district`,
`zip_code` — not four foreign keys. So the picker is a typing aid and nothing more: the user
chooses from real lists, and the payload carries the same plain strings a text box would have
sent. PenbunAPI is unchanged and knows nothing about it.

```text
core/address.ts                  the three lists, the matching rules, the cascade
core/schema.ts   Field.address   marks a field as one step of it (presentation only)
tools/gen_thai_address.mjs       merges the sources and splits them per province
tools/address-overrides.json     Bangkok's 180 แขวง, and why the sources are wrong
public/assets/data/th/           77 + 928 + 7,465 rows, 625 KB, committed
```

**Three sources, because none of them is complete.** `playxdev/iHapWeb data/raw` is the base and
the newest (refreshed 2025). The 2021 phpMyAdmin dump in `../docs/post/*.sql` fills 12 rows the
base lost, nine of them in Bangkok, and never overrides it. Both predate the 2560/2564 splits —
บางนา into two แขวง, บางบอน into four, และอีกหลายเขต — and both still list แขวง that were
transferred to another เขต years ago, so Bangkok would ship 170 แขวง where the announcements say
180. `tools/address-overrides.json` carries all 180 with their official codes and replaces
province 1 wholesale; it names its own sources, and marks the twelve zip codes taken from the
เขต rather than from a source row (every Bangkok เขต has exactly one). The generator refuses to
write anything if a province ends up empty, a zip is not five digits, or an id appears twice.

The tables are static files, not an endpoint: `provinces.json` is 4 KB and loads once,
`province/<id>.json` is ~8 KB and arrives when a province is picked — after which the อำเภอ list,
the ตำบล list and every รหัสไปรษณีย์ under it are already in hand. Both are cached per page, so a
second form fetches nothing.

Three behaviours worth knowing:

- **Marking a field is the whole integration.** `{ name: "province", …, address: "province" }` in
  `master/resources.ts` turns the box into a select. All four screens that hold an address —
  ลูกค้า · คู่ค้า · บริษัท · คลังสินค้า — carry the whole cascade, and so does the mock
  “ข้อมูลองค์กร” card on the settings screen. Getting คลังสินค้า there took the other two repos:
  PenbunSQL v10 gives `tb_warehouse` the `sub_district` · `district` · `zip_code` it never had and
  has `vw_company` return the two it had all along, and the PenbunAPI descriptors accept them.
  **This build needs PenbunSQL v10**; against v9 those two screens fail to save with
  `Invalid column name`.
- **The form order is the fill order, not the column order.** จังหวัด → อำเภอ → ตำบล → ไปรษณีย์.
  Declared in column order the first two boxes would sit above the one that unlocks them.
- **A stored address is matched forgivingly, never overwritten.** Rows written before the picker
  hold what somebody typed: “บางรัก” where the canonical name is “เขตบางรัก”, “จ.นนทบุรี” where it
  is “นนทบุรี”. Prefixes and spaces are ignored when matching, and a value that still matches
  nothing is kept as its own option rather than silently reassigned to the top of the list.
- **Only picking a ตำบล writes the รหัสไปรษณีย์**, and it overwrites. The box stays editable —
  a row may legitimately disagree with the tables — and hydrating an existing row never touches it.

The `จังหวัด` filter above the list stays a free-text box with the 77 names as suggestions, for
the same reason: it has to be able to find the rows that spell it some other way.

`customer-route` used to be a second one — no status column and no search, because
`vw_customer_route` selected neither `is_active` nor the audit columns. PenbunSQL v8 gives the
view those columns and the API a `SearchColumns` list, so all eighteen screens behave the same
way now.

**Reading errors:** every response uses one envelope. `core/api.ts` unwraps it and throws
`ApiError` carrying `code`, `httpStatus`, `fieldErrors` and `trace_id`.
Branch on `err.code` only — PenbunAPI rewords `message` without calling it a contract change.
`TOKEN_EXPIRED` means refresh, not sign out; `api.ts` already does that for you.

**Where the tokens live:** `localStorage["penbun.auth"]`, owned solely by `core/tokens.ts`.
A refresh token in localStorage is readable by any script running on this origin. The
alternative — an HttpOnly cookie — needs a same-site backend to set it, which a static
Pages deployment talking to a bearer-token API does not have. The CSP in `public/_headers`
is load-bearing, not decoration.

The client must not calculate stock. All balances are assumed to come from the server-side stock ledger
(`tb_stock_movement`); the client only displays them.

---

### The document engine

PenbunAPI describes each document type as a `document.Spec` and gets nine endpoints from one
engine. `src/ts/docs/` mirrors it the same way the master engine mirrors `crud.Resource`.

```text
docs/schema.ts        DocSpec + the lifecycle predicates   (mirrors internal/domain/document)
docs/resources.ts     one descriptor per document type
docs/repo.ts          the nine requests
docs/view.ts          list + editor markup (markup only)
docs/page.ts          the controller: list and editor behind one URL
```

Four differences from the master engine, all of them the contract's:

- **The list endpoint takes no `q` and no `sort`.** It orders by `doc_date DESC, autoID DESC`, so
  the toolbar searches on `doc_no` and no header is clickable. A header that looks sortable and
  reorders nothing is worse than a plain one.
- **Items are editable only in DRAFT**, and are replaced as a whole set — there is no endpoint
  for one line, because the header totals are recalculated on every write anyway.
- **The screen never adds anything up.** `total_qty` and `total_amount` come back from the
  database on every write and the editor re-renders from that answer. The only arithmetic on the
  page is a per-line preview while the user is still typing.
- **Posted is per spec, not a shared constant.** Three of the four documents end at `POSTED` and
  the delivery note ends at `DELIVERED`, so a shared "posted" badge would be wrong on one screen
  in four.

**No screen offers a reversal.** `PUT /{doc}/{id}/reverse` does not exist (PENBUN-TODO §3.4), and
a posted document cannot be cancelled — the stock ledger is append-only by design. The button
appears when the endpoint does.

## 7. Deploying to Cloudflare Pages

The app is static and has no runtime dependency. Cloudflare does not need Node or `node_modules`.
Node is used only during the build (`tsc` compiles `src/ts` to `public/assets/js`). Deploy only `public/`.

### A. Direct Upload (Recommended)

```bash
npx wrangler login   # first time only
npm run deploy
```

`npm run deploy` runs `tsc`, then `wrangler pages deploy` uploads only `public/`.

### B. Git Integration

| Field | Value |
|---|---|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | `20` (read automatically from `.nvmrc`) |

Cloudflare runs `npm install` and the build in its own sandbox, then serves only `public/`.

### Related Files

- `wrangler.toml` — tells Wrangler which output directory to deploy.
- `public/_headers` — security headers and cache policy.
- `public/404.html` — automatic Pages 404 page.
- Extensionless URLs such as `/dashboard` are mapped to `.html` by Pages.

`connect-src` in `public/_headers` already lists the PenbunAPI origin, and `npm test`
fails if it stops matching `PROD_ORIGIN` in `src/ts/core/config.ts`. Move the API and
both have to change together — local development never notices, because
`tools/serve.mjs` sends no CSP at all.

### Caching and deploys

`npm run build` writes two things: `public/assets/js/` (plain paths, what `tools/serve.mjs`
serves during development) and **`dist/`, which is what gets deployed**. They differ in one way —
dist puts every module under `assets/js/<hash>/` and stamps the HTML to point there.

That is not an optimisation, it is the only reliable way to apply a deploy. Modules are cached
by URL and each one expires on its own clock, so a browser can hold half of one build and half
of another. It does not degrade politely:

```
SyntaxError: The requested module '../master/form.js'
does not provide an export named 'fillRefSelects'
```

A fresh `docs/page.js` had loaded beside a four-hour-old `master/form.js`. With a hashed
directory the whole graph moves together — relative imports resolve inside it — so a browser
either has the build or it does not. The HTML naming the directory is revalidated on every load,
which is the one thing Pages guarantees.

`Cache-Control` cannot be relied on for this. A Cloudflare zone in front of Pages rewrites it:
Browser Cache TTL defaults to 4 hours, and that is what `www.phenbun.com` served while
`penbunweb-1kq.pages.dev` — the same deployment with no zone in front — served what
`public/_headers` asks for. Setting the zone to **Respect Existing Headers** is still worth
doing, but nothing depends on it any more.

**Git Integration needs its own setting.** The Pages dashboard keeps its own build config, so
*Build output directory* has to say `dist` there as well; `wrangler.toml` only governs
`npm run deploy`. Until it does, deployments serve the unhashed `public/`, which works but
brings the old behaviour with it.

---

## 8. Minimum Quality Already Covered

- Responsive down to mobile; the sidebar becomes a drawer and tables scroll horizontally.
- Keyboard support: visible focus for `Tab`, `Ctrl/⌘ + K` focuses global search, and `Esc` closes dropdowns/modals.
- `prefers-reduced-motion` disables transitions.
- ARIA: `aria-current` on menus, `aria-sort` on sortable headers, `role="tablist"`, and a skip link on every page.
- Numeric cells use `tabular-nums` so money columns align.
- Fonts are the only third-party request. Master screens also call PenbunAPI; every other request
  the app makes goes to the API origin listed in `connect-src`.
- `npm test` runs the whole suite with no dependencies: formatting, charts, the API pipeline
  against a stubbed `fetch`, the master registry and request builder, nav↔page consistency, the
  enum fallback rules, and an HTTP smoke test of every page and asset.
- `.github/workflows/ci.yml` runs `npm run typecheck` and `npm test` on every push and pull
  request, on the Node version in `.nvmrc` — the same one Cloudflare Pages builds with.

---

## 9. Not in This Release

- PenbunAPI integration beyond `/auth/*`, the 20 master resources and ใบรับสินค้า — the other
  three document types, stock, consignment, allocation, user and report screens still read
  `mock.ts`.
- The resolved discount on an order line. `UFN_RESOLVE_DISCOUNT` exists and answers, but nothing
  calls it yet: ใบสั่งขาย still takes a percentage typed by hand, with no provenance shown.
- Reversing a posted document. PenbunAPI has no `reverse` endpoint yet, so no screen offers the
  button; a posted document is final in this release.
- Document printing and virtualized tables.
- “Remember this device” on the login form is decorative; the session always persists.
- Password recovery (`ลืมรหัสผ่าน?`) — PenbunAPI has no endpoint for it.
- Real RBAC (waiting for role/permission tables), i18n (currently Thai hardcoded), and document printing.
- User administration — PenbunAPI has no endpoint to list or create one.

See `../PENBUN-TODO.md` for what remains across PenbunSQL, PenbunAPI and PenbunWeb.

---

Penbun System · PenbunWeb beta 1.4.0 · PenbunAPI v4.0.0 · PenbunSQL v9.0.0
