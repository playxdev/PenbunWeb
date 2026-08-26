#!/usr/bin/env python3
"""Generate the repetitive PenbunWeb pages from one template.

Only look-and-feel pages: every table below is static sample data. Run:
    python3 tools/gen_pages.py

The eighteen master-data screens are NOT here. They read and write real rows
through PenbunAPI, are declared in src/ts/master/resources.ts, and their HTML
is generated from that registry by `npm run gen:master`. Adding a master page
to this file would overwrite a live screen with sample data.
"""
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public"

HEAD = """<!DOCTYPE html>
<html lang="th" data-bs-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>{title} · PenbunWeb</title>
<link rel="icon" href="/assets/image/png/icon/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/image/png/icon/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/assets/image/png/icon/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/image/png/icon/apple-touch-icon.png">
<link rel="manifest" href="/assets/image/png/icon/site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400..700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/assets/css/01-tokens.css">
<link rel="stylesheet" href="/assets/css/02-base.css">
<link rel="stylesheet" href="/assets/css/03-layout.css">
<link rel="stylesheet" href="/assets/css/04-components.css">
<link rel="stylesheet" href="/assets/css/05-pages.css">
<script>
(function () {{
  try {{
    var c = localStorage.getItem("penbun.theme") || "auto";
    var dark = c === "dark" || (c === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    var r = document.documentElement;
    r.classList.add(dark ? "dark" : "light");
    r.setAttribute("data-bs-theme", dark ? "dark" : "light");
    r.style.colorScheme = dark ? "dark" : "light";
  }} catch (e) {{}}
}})();
</script>
</head>
<body>
"""

ENTRY_APP = '<script type="module" src="/assets/js/main.js"></script>\n</body>\n</html>\n'
ENTRY_STANDALONE = '<script type="module" src="/assets/js/standalone.js"></script>\n</body>\n</html>\n'


def badge(text, kind="muted"):
    return f'<span class="pb-badge pb-badge--{kind}">{text}</span>'


def money(v):
    neg = v < 0
    s = f"{abs(v):,.2f}"
    cls = " pb-neg" if neg else ""
    return f'<td data-num class="pb-num{cls}">{"−" if neg else ""}{s}</td>'


def num(v):
    return f'<td data-num class="pb-num">{v:,}</td>'


def main_cell(title, meta, icon="file"):
    return (
        '<td><div class="pb-cell-main"><span class="pb-thumb">'
        f'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">{ICONS[icon]}</svg>'
        f'</span><span class="pb-cell-main__text"><span class="pb-cell-main__title">{title}</span>'
        f'<span class="pb-cell-main__meta">{meta}</span></span></div></td>'
    )


ICONS = {
    "file": '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    "book": '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5z"/>',
    "box": '<path d="M3 8.5 12 4l9 4.5-9 4.5z"/><path d="M3 8.5v7L12 20l9-4.5v-7"/>',
    "store": '<path d="M4 9h16v11H4z"/><path d="M3 9l1.5-5h15L21 9"/>',
    "user": '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    "truck": '<path d="M2 6h11v10H2z"/><path d="M13 9h4l3 3.5V16h-7z"/>',
    "wh": '<path d="M3 21V9l9-5 9 5v12"/><path d="M8 21v-7h8v7"/>',
    "tag": '<path d="M3 12V4h8l9 9-8 8z"/>',
}


def page(page_id, title, eyebrow, sub, actions, columns, rows, foot="", extra_top=""):
    ths = "".join(
        f'<th{" data-num" if c.get("num") else ""}{" data-sort" if c.get("sort", True) else ""}>{c["label"]}</th>'
        for c in columns
    )
    trs = "".join(f"<tr>{''.join(r)}</tr>" for r in rows)
    action_html = "".join(actions)
    return (
        HEAD.format(title=title)
        + f"""<a class="pb-skip-link" href="#pb-page">ข้ามไปยังเนื้อหาหลัก</a>

<div id="pb-page" data-page="{page_id}">
  <div class="pb-pagehead">
    <div class="pb-pagehead__titles">
      <div class="pb-eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p class="pb-pagehead__sub">{sub}</p>
    </div>
    <div class="pb-pagehead__actions">{action_html}</div>
  </div>
{extra_top}
  <div class="pb-card">
    <div class="pb-toolbar">
      <div class="pb-toolbar__grow">
        <div class="pb-inputgroup">
          <span class="pb-inputgroup__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
          </span>
          <input class="pb-input" type="search" placeholder="ค้นหาในตาราง…" aria-label="ค้นหาในตาราง"
                 data-table-filter="#tbl-{page_id}">
        </div>
      </div>
      <select class="pb-select" aria-label="กรองตามสถานะ" style="width:auto">
        <option>ทุกสถานะ</option><option>ใช้งาน</option><option>พักการใช้งาน</option>
      </select>
      <select class="pb-select" aria-label="กรองตามคลัง" style="width:auto">
        <option>ทุกคลัง</option><option>DC-01 ศูนย์กระจายสินค้า</option><option>WH-02 คลังสาขา</option>
      </select>
      <button class="pb-btn pb-btn--secondary pb-btn--sm" data-stub="ตัวกรองขั้นสูงจะมาในรุ่นถัดไป">ตัวกรอง</button>
    </div>

    <div class="pb-tablewrap">
      <table class="pb-table" id="tbl-{page_id}">
        <thead><tr>{ths}</tr></thead>
        <tbody>{trs}</tbody>
      </table>
    </div>

    <div class="pb-card__foot">
      <span>{foot or f"แสดง {len(rows)} จาก {len(rows)} รายการ"}</span>
      <nav class="pb-pagination" aria-label="แบ่งหน้า">
        <button aria-label="หน้าก่อนหน้า" data-stub="ตัวอย่าง UI">‹</button>
        <button aria-current="true">1</button>
        <button data-stub="ตัวอย่าง UI">2</button>
        <button data-stub="ตัวอย่าง UI">3</button>
        <button aria-label="หน้าถัดไป" data-stub="ตัวอย่าง UI">›</button>
      </nav>
    </div>
  </div>
</div>

"""
        + ENTRY_APP
    )


BTN_PRIMARY = '<button class="pb-btn pb-btn--primary" data-stub="ฟอร์มยังไม่เปิดในรุ่นเบต้า">{}</button>'
BTN_SECOND = '<button class="pb-btn pb-btn--secondary" data-stub="ยังไม่เปิดในรุ่นเบต้า">{}</button>'

PAGES = []

# ----------------------------------------------------------------- products
# -------------------------------------------------------------------- stock
PAGES.append(
    dict(
        page_id="stock",
        file="stock.html",
        title="สต็อกคงเหลือ",
        eyebrow="สินค้าและสต็อก",
        sub="ยอดคงเหลือคำนวณจากบัญชีเดินสินค้า (tb_stock_movement) เท่านั้น",
        actions=[BTN_SECOND.format("ตรวจนับสต็อก"), BTN_PRIMARY.format("ปรับปรุงยอด")],
        columns=[
            {"label": "สินค้า"},
            {"label": "คลัง"},
            {"label": "คงเหลือ", "num": True},
            {"label": "จอง", "num": True},
            {"label": "พร้อมขาย", "num": True},
            {"label": "จุดสั่งซื้อ", "num": True},
            {"label": "สถานะ", "sort": False},
        ],
        rows=[
            [
                main_cell("แบบฝึกหัดคณิตศาสตร์ ป.4", "BK-10241", "book"),
                "<td>DC-01</td>",
                num(96),
                num(40),
                num(56),
                num(500),
                f"<td>{badge('วิกฤต', 'neg')}</td>",
            ],
            [
                main_cell("สมุดเส้นบรรทัด 70 แกรม", "ST-2210", "box"),
                "<td>DC-01</td>",
                num(240),
                num(60),
                num(180),
                num(800),
                f"<td>{badge('ต่ำ', 'warn')}</td>",
            ],
            [
                main_cell("ปากกาหมึกเจล 0.5 มม.", "ST-3388", "box"),
                "<td>DC-01</td>",
                num(312),
                num(24),
                num(288),
                num(600),
                f"<td>{badge('ต่ำ', 'warn')}</td>",
            ],
            [
                main_cell("หนังสืออ่านนอกเวลา ม.ต้น", "BK-77120", "book"),
                "<td>WH-02</td>",
                num(1_180),
                num(120),
                num(1_060),
                num(400),
                f"<td>{badge('ปกติ', 'pos')}</td>",
            ],
            [
                main_cell("กล่องบรรจุหนังสือ ขนาด M", "PK-0042", "box"),
                "<td>WH-02</td>",
                num(58),
                num(0),
                num(58),
                num(300),
                f"<td>{badge('วิกฤต', 'neg')}</td>",
            ],
        ],
    )
)

# ---------------------------------------------------------------- movements
PAGES.append(
    dict(
        page_id="movements",
        file="movements.html",
        title="ความเคลื่อนไหวสต็อก",
        eyebrow="สินค้าและสต็อก",
        sub="บันทึกเดินสินค้าแบบ append-only ทุกแถวอ้างอิงเอกสารต้นทางเสมอ",
        actions=[BTN_SECOND.format("ส่งออก")],
        columns=[
            {"label": "เวลา"},
            {"label": "สินค้า"},
            {"label": "ประเภท"},
            {"label": "เอกสารอ้างอิง"},
            {"label": "จำนวน", "num": True},
            {"label": "คงเหลือหลังรายการ", "num": True},
        ],
        rows=[
            ["<td class='pb-nowrap'>23 ส.ค. 09:12</td>", main_cell("แบบฝึกหัดคณิตศาสตร์ ป.4", "BK-10241", "book"),
             f"<td>{badge('ขายออก', 'neg')}</td>", "<td class='pb-num'>ORD-2569-0912</td>", '<td data-num class="pb-num pb-neg">−40</td>', num(96)],
            ["<td class='pb-nowrap'>23 ส.ค. 08:40</td>", main_cell("สมุดเส้นบรรทัด 70 แกรม", "ST-2210", "box"),
             f"<td>{badge('รับเข้า', 'pos')}</td>", "<td class='pb-num'>RCV-2569-0182</td>", '<td data-num class="pb-num pb-pos">+1,200</td>', num(240)],
            ["<td class='pb-nowrap'>22 ส.ค. 17:05</td>", main_cell("ปากกาหมึกเจล 0.5 มม.", "ST-3388", "box"),
             f"<td>{badge('จองสินค้า', 'warn')}</td>", "<td class='pb-num'>ORD-2569-0911</td>", '<td data-num class="pb-num">−24</td>', num(312)],
            ["<td class='pb-nowrap'>22 ส.ค. 15:22</td>", main_cell("หนังสืออ่านนอกเวลา ม.ต้น", "BK-77120", "book"),
             f"<td>{badge('รับคืน', 'pos')}</td>", "<td class='pb-num'>RTN-2569-0064</td>", '<td data-num class="pb-num pb-pos">+52</td>', num(1_180)],
            ["<td class='pb-nowrap'>22 ส.ค. 11:48</td>", main_cell("กล่องบรรจุหนังสือ ขนาด M", "PK-0042", "box"),
             f"<td>{badge('โอนออก', 'muted')}</td>", "<td class='pb-num'>TRF-2569-0037</td>", '<td data-num class="pb-num pb-neg">−150</td>', num(58)],
        ],
        foot="แสดง 5 จาก 128,430 รายการ",
    )
)

# --------------------------------------------------------------- warehouses
# ---------------------------------------------------------------- transfers
PAGES.append(
    dict(
        page_id="transfers",
        file="transfers.html",
        title="โอนย้ายระหว่างคลัง",
        eyebrow="สินค้าและสต็อก",
        sub="การเคลื่อนย้ายจากศูนย์กระจายสินค้าไปยังคลังสาขา",
        actions=[BTN_PRIMARY.format("สร้างใบโอน")],
        columns=[
            {"label": "เลขที่ใบโอน"},
            {"label": "จากคลัง"},
            {"label": "ไปคลัง"},
            {"label": "วันที่"},
            {"label": "จำนวนชิ้น", "num": True},
            {"label": "สถานะ", "sort": False},
        ],
        rows=[
            [main_cell("TRF-2569-0037", "ผู้ทำรายการ: สมชาย ก."), "<td>DC-01</td>", "<td>WH-02</td>",
             "<td class='pb-nowrap'>22 ส.ค. 2569</td>", num(150), f"<td>{badge('ผ่านรายการ', 'pos')}</td>"],
            [main_cell("TRF-2569-0036", "ผู้ทำรายการ: อารีย์ ส."), "<td>DC-01</td>", "<td>WH-03</td>",
             "<td class='pb-nowrap'>21 ส.ค. 2569</td>", num(420), f"<td>{badge('กำลังขนส่ง', 'warn')}</td>"],
            [main_cell("TRF-2569-0035", "ผู้ทำรายการ: ธนา พ."), "<td>WH-02</td>", "<td>WH-04</td>",
             "<td class='pb-nowrap'>20 ส.ค. 2569</td>", num(88), f"<td>{badge('ฉบับร่าง', 'muted')}</td>"],
        ],
    )
)

# ------------------------------------------------------------------- documents
DOC_PAGES = [
    ("receive", "doc-receive.html", "ใบรับสินค้า", "รับสินค้าเข้าคลังจากผู้ขายหรือสำนักพิมพ์", "RCV", "ผู้ขาย"),
    ("orders", "doc-order.html", "ใบสั่งขาย", "ใบสั่งขายที่ตัดสต็อกและผูกกับสายจัดส่ง", "ORD", "ลูกค้า"),
    ("returns", "doc-return.html", "ใบคืนสินค้า", "สินค้าที่ลูกค้าคืนกลับเข้าคลังพัก", "RTN", "ลูกค้า"),
    ("vendor-returns", "doc-vendor-return.html", "ใบคืนผู้ขาย", "สินค้าที่ส่งคืนผู้ขายหรือสำนักพิมพ์", "VRT", "ผู้ขาย"),
]

DOC_ROWS = [
    ("0182", "สนพ. อมรินทร์พริ้นติ้ง", "23 ส.ค. 2569", 318_600, ("ผ่านรายการ", "pos")),
    ("0181", "บจก. ไทยเปเปอร์", "22 ส.ค. 2569", 92_450, ("ผ่านรายการ", "pos")),
    ("0180", "สนพ. นานมีบุ๊คส์", "22 ส.ค. 2569", 176_200, ("รอตรวจสอบ", "warn")),
    ("0179", "บจก. ควอนตัมเพน", "21 ส.ค. 2569", 44_800, ("ฉบับร่าง", "muted")),
    ("0178", "สนพ. อมรินทร์พริ้นติ้ง", "20 ส.ค. 2569", 208_300, ("ยกเลิก", "neg")),
    ("0177", "บจก. บ็อกซ์มาสเตอร์", "19 ส.ค. 2569", 31_900, ("ผ่านรายการ", "pos")),
]

for pid, fname, title, sub, prefix, party in DOC_PAGES:
    PAGES.append(
        dict(
            page_id=pid,
            file=fname,
            title=title,
            eyebrow="เอกสาร",
            sub=sub,
            actions=[BTN_SECOND.format("พิมพ์"), BTN_PRIMARY.format(f"สร้าง{title}")],
            columns=[
                {"label": "เลขที่เอกสาร"},
                {"label": party},
                {"label": "วันที่"},
                {"label": "จำนวนรายการ", "num": True},
                {"label": "มูลค่า", "num": True},
                {"label": "สถานะ", "sort": False},
            ],
            rows=[
                [
                    main_cell(f"{prefix}-2569-{no}", f"ผู้ทำรายการ: jack"),
                    f"<td>{p}</td>",
                    f"<td class='pb-nowrap'>{d}</td>",
                    num(12),
                    money(v),
                    f"<td>{badge(st[0], st[1])}</td>",
                ]
                for no, p, d, v, st in DOC_ROWS
            ],
            foot="แสดง 6 จาก 1,204 รายการ",
        )
    )

# ------------------------------------------------------------------- routes
# -------------------------------------------------------------- consignment
PAGES.append(
    dict(
        page_id="consignment",
        file="consignment.html",
        title="ฝากขาย",
        eyebrow="การจัดจำหน่าย",
        sub="สินค้าที่วางไว้ที่ร้านค้าและยังไม่เรียกเก็บ ตัดยอดเมื่อร้านแจ้งขายได้",
        actions=[BTN_SECOND.format("ปิดยอดรอบเดือน"), BTN_PRIMARY.format("วางสินค้าฝากขาย")],
        columns=[
            {"label": "ร้านค้า"},
            {"label": "สาย"},
            {"label": "วางไว้", "num": True},
            {"label": "ขายได้", "num": True},
            {"label": "คงค้าง", "num": True},
            {"label": "มูลค่าคงค้าง", "num": True},
            {"label": "รอบล่าสุด", "sort": False},
        ],
        rows=[
            [main_cell("ร้านหนังสือบ้านสวน", "CUS-0104 · บางบัวทอง", "store"), "<td>R-01</td>",
             num(820), num(612), num(208), money(38_400), "<td class='pb-nowrap'>31 ก.ค. 2569</td>"],
            [main_cell("ศึกษาภัณฑ์ นครปฐม", "CUS-0221 · เมืองนครปฐม", "store"), "<td>R-04</td>",
             num(1_450), num(980), num(470), money(96_200), "<td class='pb-nowrap'>31 ก.ค. 2569</td>"],
            [main_cell("ร้านเครื่องเขียนแสงทอง", "CUS-0318 · ศรีราชา", "store"), "<td>R-02</td>",
             num(640), num(505), num(135), money(21_750), "<td class='pb-nowrap'>30 มิ.ย. 2569</td>"],
            [main_cell("สหกรณ์โรงเรียนวัดไผ่", "CUS-0402 · ปากช่อง", "store"), "<td>R-05</td>",
             num(390), num(310), num(80), money(12_480), "<td class='pb-nowrap'>31 ก.ค. 2569</td>"],
        ],
    )
)

# --------------------------------------------------------------- allocation
PAGES.append(
    dict(
        page_id="allocation",
        file="allocation.html",
        title="ดึงจากประวัติ",
        eyebrow="การจัดจำหน่าย",
        sub="สร้างชุดจัดสินค้าจากประวัติการรับของร้านค้าในรอบก่อนหน้า",
        actions=[BTN_SECOND.format("เลือกรอบอ้างอิง"), BTN_PRIMARY.format("สร้างชุดจัด")],
        columns=[
            {"label": "ร้านค้า"},
            {"label": "สาย"},
            {"label": "รอบอ้างอิง"},
            {"label": "เคยรับ", "num": True},
            {"label": "แนะนำจัด", "num": True},
            {"label": "ปรับแล้ว", "num": True},
        ],
        rows=[
            [main_cell("ร้านหนังสือบ้านสวน", "CUS-0104", "store"), "<td>R-01</td>", "<td>ก.ค. 2569</td>",
             num(820), num(780), num(760)],
            [main_cell("ศึกษาภัณฑ์ นครปฐม", "CUS-0221", "store"), "<td>R-04</td>", "<td>ก.ค. 2569</td>",
             num(1_450), num(1_400), num(1_400)],
            [main_cell("ร้านเครื่องเขียนแสงทอง", "CUS-0318", "store"), "<td>R-02</td>", "<td>มิ.ย. 2569</td>",
             num(640), num(600), num(640)],
            [main_cell("ร้านหนังสือดวงกมล สาขา 3", "CUS-0507", "store"), "<td>R-03</td>", "<td>ก.ค. 2569</td>",
             num(1_120), num(1_050), num(1_050)],
        ],
    )
)

# ------------------------------------------------------------------ vendors
# ---------------------------------------------------------------- customers
# ---------------------------------------------------------------- discounts
# -------------------------------------------------------------------- users
PAGES.append(
    dict(
        page_id="users",
        file="users.html",
        title="ผู้ใช้และสิทธิ์",
        eyebrow="ระบบ",
        sub="โครงสร้าง RBAC ยังเป็นตัวอย่างหน้าตา รอการทำงานจริงในสคีมา v8",
        actions=[BTN_SECOND.format("จัดการบทบาท"), BTN_PRIMARY.format("เชิญผู้ใช้")],
        columns=[
            {"label": "ผู้ใช้"},
            {"label": "บทบาท"},
            {"label": "คลัง/สาขา"},
            {"label": "เข้าใช้ล่าสุด"},
            {"label": "สถานะ", "sort": False},
        ],
        rows=[
            [main_cell("จักรพงษ์ ศรีวิไล", "jack · jack@penbun.local", "user"),
             f"<td>{badge('ผู้ดูแลระบบ', 'brand')}</td>", "<td>ทุกคลัง</td>", "<td class='pb-nowrap'>วันนี้ 08:02</td>",
             f"<td>{badge('ใช้งาน', 'pos')}</td>"],
            [main_cell("สมชาย เกษมสุข", "somchai · somchai@penbun.local", "user"),
             f"<td>{badge('หัวหน้าคลัง', 'muted')}</td>", "<td>DC-01</td>", "<td class='pb-nowrap'>วันนี้ 07:45</td>",
             f"<td>{badge('ใช้งาน', 'pos')}</td>"],
            [main_cell("อารีย์ สุขใจ", "aree · aree@penbun.local", "user"),
             f"<td>{badge('พนักงานคลัง', 'muted')}</td>", "<td>WH-02</td>", "<td class='pb-nowrap'>เมื่อวาน 17:20</td>",
             f"<td>{badge('ใช้งาน', 'pos')}</td>"],
            [main_cell("ธนา พงษ์ไพบูลย์", "thana · thana@penbun.local", "user"),
             f"<td>{badge('ฝ่ายขาย', 'muted')}</td>", "<td>WH-03</td>", "<td class='pb-nowrap'>19 ส.ค. 2569</td>",
             f"<td>{badge('รอยืนยันอีเมล', 'warn')}</td>"],
            [main_cell("ปรียา วงศ์ทอง", "preeya · preeya@penbun.local", "user"),
             f"<td>{badge('ผู้ดูรายงาน', 'muted')}</td>", "<td>ทุกคลัง</td>", "<td class='pb-nowrap'>2 ส.ค. 2569</td>",
             f"<td>{badge('ระงับการใช้งาน', 'neg')}</td>"],
        ],
    )
)

# ------------------------------------------------------------------ reports
PAGES.append(
    dict(
        page_id="reports",
        file="reports.html",
        title="รายงาน",
        eyebrow="ภาพรวม",
        sub="รายงานมาตรฐานที่อ่านจาก View ฝั่งอ่านของ PenbunSQL",
        actions=[BTN_SECOND.format("ตั้งเวลาส่งรายงาน")],
        columns=[
            {"label": "รายงาน"},
            {"label": "หมวด"},
            {"label": "ช่วงข้อมูล"},
            {"label": "อัปเดตล่าสุด"},
            {"label": "รูปแบบ", "sort": False},
        ],
        rows=[
            [main_cell("ยอดขายรายสาย", "สรุปยอดขายและจุดส่งของแต่ละสาย"), "<td>การขาย</td>", "<td>รายเดือน</td>",
             "<td class='pb-nowrap'>วันนี้ 06:00</td>", f"<td>{badge('XLSX', 'muted')} {badge('PDF', 'muted')}</td>"],
            [main_cell("สรุปฝากขายค้างเรียกเก็บ", "แยกตามร้านค้าและอายุหนี้"), "<td>ฝากขาย</td>", "<td>รายเดือน</td>",
             "<td class='pb-nowrap'>วันนี้ 06:00</td>", f"<td>{badge('XLSX', 'muted')}</td>"],
            [main_cell("สินค้าเคลื่อนไหวช้า", "ไม่มีการเคลื่อนไหวเกิน 90 วัน"), "<td>สต็อก</td>", "<td>รายไตรมาส</td>",
             "<td class='pb-nowrap'>1 ส.ค. 2569</td>", f"<td>{badge('XLSX', 'muted')} {badge('CSV', 'muted')}</td>"],
            [main_cell("ยอดซื้อรายสำนักพิมพ์", "เทียบเป้าและส่วนลดที่ได้รับ"), "<td>จัดซื้อ</td>", "<td>รายปี</td>",
             "<td class='pb-nowrap'>1 ส.ค. 2569</td>", f"<td>{badge('PDF', 'muted')}</td>"],
            [main_cell("บัญชีเดินสินค้า", "รายการเคลื่อนไหวทุกบรรทัดพร้อมเอกสารอ้างอิง"), "<td>ตรวจสอบ</td>",
             "<td>ตามช่วงที่เลือก</td>", "<td class='pb-nowrap'>เรียลไทม์</td>", f"<td>{badge('CSV', 'muted')}</td>"],
        ],
    )
)

for p in PAGES:
    (OUT / p["file"]).write_text(page(
        p["page_id"], p["title"], p["eyebrow"], p["sub"], p["actions"],
        p["columns"], p["rows"], p.get("foot", ""), p.get("extra_top", ""),
    ), encoding="utf-8")
    print("wrote", p["file"])

# =============================================================== error pages
ERRORS = [
    dict(code="401", file="401.html", variant="forbidden", title="ต้องเข้าสู่ระบบก่อน",
         text="เซสชันหมดอายุหรือยังไม่ได้เข้าสู่ระบบ กรุณาเข้าสู่ระบบอีกครั้งเพื่อใช้งานต่อ",
         actions='<a class="pb-btn pb-btn--primary" href="/index.html?force=1">ไปหน้าเข้าสู่ระบบ</a>'),
    dict(code="403", file="403.html", variant="forbidden", title="ไม่มีสิทธิ์เข้าถึงหน้านี้",
         text="บัญชีของคุณไม่มีสิทธิ์ในส่วนนี้ หากต้องการใช้งาน ให้ผู้ดูแลระบบเพิ่มสิทธิ์ให้บทบาทของคุณ",
         actions='<a class="pb-btn pb-btn--primary" href="/dashboard.html">กลับสู่แดชบอร์ด</a>'
                 '<button class="pb-btn pb-btn--secondary" data-signout>เข้าสู่ระบบด้วยบัญชีอื่น</button>'),
    dict(code="404", file="404.html", variant="", title="ไม่พบหน้าที่เรียก",
         text="ลิงก์อาจถูกย้ายหรือพิมพ์ผิด ลองค้นหาจากเมนูหลัก หรือกลับไปหน้าแดชบอร์ด",
         actions='<a class="pb-btn pb-btn--primary" href="/dashboard.html">กลับสู่แดชบอร์ด</a>'
                 '<button class="pb-btn pb-btn--secondary" data-go-back>ย้อนกลับ</button>'),
    dict(code="500", file="500.html", variant="server", title="ระบบทำงานผิดพลาด",
         text="PenbunAPI ตอบกลับด้วยข้อผิดพลาดภายใน ทีมงานได้รับบันทึกเหตุการณ์นี้แล้ว",
         actions='<button class="pb-btn pb-btn--primary" data-retry>ลองอีกครั้ง</button>'
                 '<a class="pb-btn pb-btn--secondary" href="/dashboard.html">กลับสู่แดชบอร์ด</a>'),
    dict(code="502", file="502.html", variant="server", title="เชื่อมต่อ PenbunAPI ไม่ได้",
         text="เกตเวย์ไม่ได้รับการตอบกลับจากเซิร์ฟเวอร์ปลายทาง ระบบจะพยายามเชื่อมต่อใหม่โดยอัตโนมัติ",
         actions='<button class="pb-btn pb-btn--primary" data-retry>ลองอีกครั้ง</button>'
                 '<a class="pb-btn pb-btn--secondary" href="/dashboard.html">กลับสู่แดชบอร์ด</a>'),
    dict(code="503", file="503.html", variant="server", title="ปิดปรับปรุงระบบชั่วคราว",
         text="อยู่ระหว่างอัปเดตฐานข้อมูล PenbunSQL คาดว่าจะกลับมาใช้งานได้ภายใน 15 นาที",
         actions='<button class="pb-btn pb-btn--primary" data-retry>ตรวจสอบสถานะอีกครั้ง</button>'),
]

ERR_TPL = """<a class="pb-skip-link" href="#pb-err">ข้ามไปยังเนื้อหาหลัก</a>
<main class="pb-errpage {variant_cls}" id="pb-err">
  <div class="pb-auth__topline">
    <button class="pb-iconbtn" data-theme-toggle aria-label="สลับโหมดสีสว่าง/มืด" title="สลับโหมดสี"></button>
  </div>

  <div class="pb-errpage__inner">
    <a class="pb-brand" href="/dashboard.html" style="justify-content:center;border:0;height:auto;margin-bottom:var(--pb-6)">
      <span class="pb-brand__mark">P</span>
      <span class="pb-brand__text"><span class="pb-brand__name">PenbunWeb</span>
      <span class="pb-brand__meta">BETA 1.4.0</span></span>
    </a>

    <div class="pb-errpage__code">{code}</div>
    <h1 class="pb-errpage__title">{title}</h1>
    <p class="pb-errpage__text">{text}</p>

    <div class="pb-errpage__actions">{actions}</div>

    <div class="pb-errpage__ref">
      รหัสอ้างอิง: <button class="pb-btn pb-btn--ghost pb-btn--sm" data-copy-ref="PBW-{code}-8F3A21"
        style="font-family:var(--pb-font-mono)">PBW-{code}-8F3A21 · คัดลอก</button>
    </div>
  </div>
</main>

"""

for e in ERRORS:
    variant_cls = f"pb-errpage--{e['variant']}" if e["variant"] else ""
    html = HEAD.format(title=f"{e['code']} {e['title']}") + ERR_TPL.format(
        variant_cls=variant_cls, code=e["code"], title=e["title"], text=e["text"], actions=e["actions"]
    ) + ENTRY_STANDALONE
    (OUT / e["file"]).write_text(html, encoding="utf-8")
    print("wrote", e["file"])
