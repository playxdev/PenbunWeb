# PenbunWeb — beta 1.0.0

Front end ของ **Penbun System** (ระบบค้าส่ง/จัดจำหน่ายหนังสือและเครื่องเขียน)
เขียนด้วย **Pure HTML + CSS + TypeScript** ไม่มี framework ไม่มี runtime dependency

> **ขอบเขตของรุ่นนี้:** look and feel + UX/UI เท่านั้น
> ทุกตัวเลขในหน้าจอเป็นข้อมูลตัวอย่างจาก `src/ts/data/mock.ts` ยังไม่เชื่อมต่อ PenbunAPI v4
> ปุ่มที่ยังไม่มีการทำงานจะขึ้น toast แจ้ง แทนที่จะเงียบหรือพัง

---

## 1. เริ่มใช้งาน

```bash
npm install          # ติดตั้ง TypeScript อย่างเดียว
npm run dev          # build + เปิด http://localhost:4173
```

คำสั่งอื่น

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run build` | คอมไพล์ `src/ts` → `public/assets/js` |
| `npm run watch` | คอมไพล์แบบต่อเนื่อง |
| `npm run typecheck` | ตรวจ type อย่างเดียว ไม่ emit |
| `npm run serve` | static server (มี fallback ไป `404.html`) |
| `npm run preview` | build แล้วรันผ่าน Wrangler Pages (จำลองสภาพจริงของ Cloudflare) |
| `npm run deploy` | build แล้วอัปโหลด `public/` ขึ้น Cloudflare Pages |
| `python3 tools/gen_pages.py` | สร้างหน้า list/error ใหม่จากเทมเพลตเดียว |

**เข้าสู่ระบบ:** กรอกอะไรก็ได้ หรือกดปุ่ม "เข้าใช้งานแบบสาธิต" แล้วจะเข้าหน้า `dashboard.html`
**ออกจากระบบ:** เมนูผู้ใช้ (มุมขวาบน หรือท้าย sidebar) → ล้าง `localStorage` แล้วกลับไปหน้า login

---

## 2. โครงสร้างโปรเจกต์

```
penbunweb/
├─ public/                     ← เสิร์ฟตรง ๆ ได้ทั้งโฟลเดอร์
│  ├─ index.html               ← login
│  ├─ dashboard.html           ← landing หลังเข้าสู่ระบบ
│  ├─ products.html · stock.html · movements.html · warehouses.html · transfers.html
│  ├─ doc-receive.html · doc-order.html · doc-return.html · doc-vendor-return.html
│  ├─ routes.html · consignment.html · allocation.html
│  ├─ vendors.html · customers.html · discounts.html
│  ├─ users.html · settings.html · profile.html · reports.html
│  ├─ 401.html · 403.html · 404.html · 500.html · 502.html · 503.html
│  ├─ _headers                 ← security headers + cache (Cloudflare Pages)
│  └─ assets/
│     ├─ css/  01-tokens · 02-base · 03-layout · 04-components · 05-pages
│     └─ js/   (ผลลัพธ์จาก tsc — ไม่ commit)
├─ src/ts/
│  ├─ core/    theme · nav · auth · shell · ui · charts · icons · format
│  ├─ data/    mock.ts          ← ข้อมูลตัวอย่างทั้งหมดอยู่ไฟล์เดียว
│  ├─ pages/   dashboard.ts
│  ├─ main.ts        ← entry ของหน้าที่อยู่ใน shell
│  └─ standalone.ts  ← entry ของหน้า login / error
├─ tools/  gen_pages.py · serve.mjs
├─ wrangler.toml   ← config Cloudflare Pages (output dir = public)
├─ .nvmrc          ← pin Node 20 สำหรับ build บน Cloudflare
├─ DESIGN.md   ← concept การออกแบบ + prompt สำหรับสร้างหน้าจอเพิ่ม
└─ tsconfig.json · package.json
```

### หลักการสำคัญ: เมนูมีที่เดียว

หน้าเว็บแต่ละไฟล์เก็บ **เฉพาะเนื้อหาของตัวเอง** ใน `<div id="pb-page" data-page="...">`
`shell.ts` เป็นคนประกอบ sidebar + topbar + footer ครอบให้ตอน runtime โดยอ่านเมนูจาก `src/ts/nav.ts`
→ เพิ่ม/แก้เมนู แก้ที่ `nav.ts` ไฟล์เดียว ไม่ต้องไล่แก้ทุกหน้า

---

## 3. ธีมสว่าง/มืด

ใช้แนวทางเดียวกับ [cookievirus/darkmode](https://github.com/cookievirus/darkmode):

1. เก็บค่าที่ผู้ใช้เลือกไว้ใน `localStorage["penbun.theme"]` = `light` | `dark` | `auto`
2. ใส่ค่าลง `<html>` ทั้งเป็น **class** (`.light` / `.dark`) และ **attribute** (`data-bs-theme`)
   — ทำสองอย่างเพื่อให้ยังเข้ากับ markup แบบ Bootstrap/Phoenix ได้
3. มี inline script สั้น ๆ ใน `<head>` ของทุกหน้า ทำงาน **ก่อน first paint** → ไม่มีอาการจอกระพริบขาว
4. `auto` ฟัง `prefers-color-scheme` แบบ live และซิงก์ข้าม tab ผ่าน `storage` event

ปุ่มบน topbar หมุนตามลำดับ สว่าง → มืด → อัตโนมัติ ส่วน segment ในเมนูผู้ใช้และหน้าตั้งค่าเลือกตรง ๆ ได้

---

## 4. สีหลัก

| บทบาท | ค่า | ใช้เมื่อไหร่ |
|---|---|---|
| Primary / Brand | `rgb(249 115 22)` `#F97316` | ปุ่มหลัก เมนูที่เลือก แถบสายจัดส่ง เส้นกราฟหลัก |
| Dark surface | `rgb(17 24 39)` `#111827` | พื้นการ์ดในโหมดมืด |
| Dark canvas | `rgb(6 7 18)` `#060712` | พื้นหลังสุดในโหมดมืด และแผงซ้ายหน้า login |
| Light canvas | `rgb(248 250 252)` `#F8FAFC` | พื้นหลังสุดในโหมดสว่าง |
| Positive | `rgb(22 163 74)` `#16A34A` | ผ่านรายการ รับเข้า ยอดเพิ่ม |
| Negative | `rgb(255 30 30)` `#FF1E1E` | ยกเลิก ต่ำกว่าจุดสั่ง ยอดลด |

สีทั้งหมดถูกประกาศครั้งเดียวใน `01-tokens.css` ส่วนไฟล์อื่นเรียกผ่านตัวแปรเท่านั้น
(`var(--pb-brand)`, `var(--pb-surface)`, `var(--pb-pos)` …) — **ห้ามเขียน hex ในไฟล์ CSS อื่น**
รายละเอียดเหตุผลเชิงออกแบบอยู่ใน `DESIGN.md`

---

## 5. หน้าจอที่มีในรุ่นนี้

**เข้าสู่ระบบ** – แยกซ้าย/ขวา ซ้ายเป็นภาพจำของระบบ ขวาเป็นฟอร์ม รองรับธีมทั้งสองโหมด

**แดชบอร์ด** – KPI 4 ใบ, **แผงสายจัดส่ง** (signature element), กราฟแนวโน้มยอดขาย, สัดส่วนสต็อกแบบ donut, เอกสารล่าสุด, ความเคลื่อนไหววันนี้, สินค้าขายดี, สินค้าต่ำกว่าจุดสั่งซื้อ

**หน้ารายการ (17 หน้า)** – toolbar ค้นหา/กรอง + ตารางเรียงคอลัมน์ได้ + แบ่งหน้า
ครอบคลุมสินค้า สต็อก บัญชีเดินสินค้า คลัง โอนย้าย เอกสาร 4 ประเภท สาย ฝากขาย ดึงจากประวัติ ผู้ขาย ลูกค้า ส่วนลด ผู้ใช้ รายงาน

**ตั้งค่า / โปรไฟล์** – ฟอร์ม, tabs, ตารางสิทธิ์ (โครง RBAC), อุปกรณ์ที่ใช้งาน

**หน้า Error** – `401` `403` `404` `500` `502` `503` พร้อมรหัสอ้างอิงและปุ่มที่ทำงานได้จริง (ย้อนกลับ / ลองใหม่ / คัดลอกรหัส)

---

## 6. ต่อ API จริงอย่างไร

ตอนนี้ทุกอย่างถูกกันไว้เป็นชั้นบาง ๆ แล้ว

| สิ่งที่ต้องเปลี่ยน | ไฟล์ | เปลี่ยนเป็น |
|---|---|---|
| การเข้าสู่ระบบ | `src/ts/core/auth.ts` → `signIn()` | `POST /api/v4/auth/login` แล้วเก็บ JWT |
| การกันหน้า | `requireSession()` | ตรวจอายุ token + refresh |
| ข้อมูลทุกหน้า | `src/ts/data/mock.ts` | `fetch()` จาก endpoint ที่ตรงกัน แล้วคง type เดิมไว้ |
| เมนูตามสิทธิ์ | `src/ts/core/nav.ts` | กรอง `NAV` ด้วย permission ที่ได้จาก RBAC (PenbunSQL v8) |
| เลข version | `settings.html` ส่วน "เกี่ยวกับระบบ" | `GET /api/v4/system/version` |

ข้อควรระวังที่ยกมาจากฝั่ง SQL/API: หน้าจอนี้ **ไม่คำนวณสต็อกเอง** ทุกยอดคงเหลือถือว่ามาจาก
บัญชีเดินสินค้า (`tb_stock_movement`) ฝั่งเซิร์ฟเวอร์ ฝั่ง client มีหน้าที่แสดงผลอย่างเดียว

---

## 7. Deploy ไป Cloudflare Pages

แอปเป็น static ล้วน ไม่มี runtime dependency — ฝั่ง Cloudflare **ไม่ต้องมี Node หรือ `node_modules`**
Node ถูกใช้แค่ตอน build (`tsc` คอมไพล์ `src/ts` → `public/assets/js`) บนเครื่องเราเท่านั้น
สิ่งที่ deploy มีแค่โฟลเดอร์ `public/` (HTML + CSS + JS)

มี 2 วิธี

### A. Direct upload (แนะนำ — เบาที่สุด)

```bash
npx wrangler login   # ครั้งแรกเท่านั้น
npm run deploy
```

`npm run deploy` รัน `tsc` แล้ว `wrangler pages deploy` อัปโหลดเฉพาะ `public/` ขึ้นไป ไม่มี build บน Cloudflare
`wrangler` เรียกผ่าน `npx` — ไม่ติดตั้งลง `node_modules` ของโปรเจกต์ จึงไม่เพิ่มน้ำหนักให้ repo

### B. Git integration (deploy อัตโนมัติทุก push)

ต่อ GitHub/GitLab ใน dashboard แล้วตั้ง build:

| ช่อง | ค่า |
|---|---|
| Build command | `npm run build` |
| Build output directory | `public` |
| Node version | `20` (อ่านจาก `.nvmrc` อัตโนมัติ) |

Cloudflare จะ `npm install` + build ใน sandbox ของตัวเอง แล้วเสิร์ฟเฉพาะ `public/`
`node_modules` ไม่ถูก deploy ไม่ว่าวิธีไหน

### ไฟล์ที่เกี่ยวข้อง

- `wrangler.toml` — บอก output dir ให้ `wrangler pages deploy` รู้ว่าอัปโหลดโฟลเดอร์ไหน
- `public/_headers` — security headers (CSP, nosniff, frame deny) + cache (`html` ไม่ cache, `/assets` 1 ชม.)
- `public/404.html` — Pages ใช้เป็นหน้า 404 อัตโนมัติ (ไฟล์นี้มีอยู่แล้ว)
- URL ที่ไม่ใส่ `.html` (เช่น `/dashboard`) เข้าได้ — Pages จับคู่ `.html` ให้เอง

**เมื่อต่อ PenbunAPI จริง:** แก้ `connect-src 'self'` ใน `public/_headers` ให้รวม origin ของ API เช่น
`connect-src 'self' https://api.penbun.example`

---

## 8. คุณภาพขั้นต่ำที่รุ่นนี้ทำไว้แล้ว

- Responsive ถึงมือถือ (sidebar กลายเป็น drawer + scrim, ตาราง scroll แนวนอน)
- Keyboard: `Tab` เห็น focus ชัดทุกจุด, `Ctrl/⌘ + K` โฟกัสช่องค้นหา, `Esc` ปิด dropdown/modal
- `prefers-reduced-motion` ปิดทรานซิชันทั้งหมด
- ARIA: `aria-current` บนเมนู, `aria-sort` บนหัวตาราง, `role="tablist"`, skip link ทุกหน้า
- ตัวเลขทุกช่องใช้ `tabular-nums` → คอลัมน์เงินตรงกันเสมอ
- ไม่มี network request ตอน runtime ยกเว้นฟอนต์ (ถ้าใช้ offline ให้ self-host แล้วตัด `<link>` ออก)

---

## 9. ยังไม่ทำในรุ่นนี้

- เชื่อมต่อ PenbunAPI ทั้งหมด · ฟอร์มสร้าง/แก้ไขเอกสาร · ตารางแบบ virtualized
- RBAC จริง (รอ PenbunSQL v8) · i18n (ตอนนี้ hardcode ภาษาไทย) · การพิมพ์เอกสาร
- unit test ฝั่ง UI

---

Penbun System · PenbunWeb beta 1.0.0 · PenbunAPI v4.0.0 · PenbunSQL v7.0.0
