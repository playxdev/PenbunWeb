# PenbunWeb — Design Concept & Prompt

This document has two parts:
**Sections 1–9** describe the design concept used by beta 1.1.0.
**Section 10** is a ready-to-use prompt for generating new screens in the same system.

---

## 1. Thesis

> **“This screen must answer, within three seconds, where the goods are, who has received them, and how much remains.”**

Penbun is not a finance SaaS product or an e-commerce storefront. It is a distribution business whose daily questions are:
whether the distribution center shipped everything, which route has not arrived, and which consignment store has not been reconciled.
The design therefore starts with the **route**, not oversized financial dashboard cards.

The information density and broad structure are inspired by the Phoenix admin template (Prium),
but the color system, typography, and signature element belong to Penbun.

**Real users:** warehouse staff, route supervisors, sales staff, and executives on 13–24 inch office displays,
with some mobile use on warehouse floors. Bright-light contrast and thumb-sized controls matter.

---

## 2. Signature Element — Route Rail

```text
R-01  Northern route – Nonthaburi   ●━━●━━●━━◉──○──○      184K
                                                        3/6 stops
      └ filled dot = delivered   ◉ = in transit   ○ = not reached   ● red = late
      └ orange bar below the rail = proportion loaded onto the vehicle
```

Rules: a full orange bar means the goods were completely loaded; it does **not** mean all deliveries are complete.
The dot positions carry data and are not decoration. If the system stops using routes, remove this element rather than repurposing it.

---

## 3. Color System

Project colors are defined as six tokens and translated into roles before use:

| Token | Light | Dark | Role |
|---|---|---|---|
| `--pb-brand` | `#F97316` | `#F97316` | Primary actions, “in progress”, main chart line |
| `--pb-canvas` | `#F8FAFC` | `#060712` | Outer page background |
| `--pb-surface` | `#FFFFFF` | `#111827` | Cards and tables |
| `--pb-pos` | `#16A34A` | `#22C55E` | Posted, received, increased |
| `--pb-neg` | `#E11414` | `#FF4A4A` | Cancelled, late, below reorder |
| `--pb-text` / `-2` / `-3` | `#111827` / `#475569` / `#94A3B8` | `#E8ECF3` / `#9AA7BD` / `#64748B` | Primary / secondary / label text |

Rules that must not be broken:

1. Orange means “actionable or in progress”, not “good”. Sales growth uses green.
2. A screen has **one** solid orange button: its primary action. Other actions are secondary or ghost buttons.
3. Full `#FF1E1E` is reserved for states requiring immediate attention; do not use it for ordinary delete buttons.
4. Dark mode is not an inverted palette. `#060712` and `#111827` must remain visibly distinct; borders use transparency rather than solid color.
5. Status colors must always be paired with text. Never communicate meaning by color alone.

---

## 4. Typography

| Role | Font | Usage |
|---|---|---|
| UI/body | **Google Sans** | Everything |
| Numbers | Google Sans with `tabular-nums` | Every quantity or money field |
| Codes/documents | **IBM Plex Mono** | Document numbers, SKUs, and error reference codes |

Scale: `11 · 12 · 13 · 14 · 16 · 18 · 22 · 28 · 36 · 48` px.
The application defaults to 14px, tables/sidebar use 13px for density, and KPI values use 36px.

Separate numeric typography prevents money columns from shifting. Every numeric `<td>` must include `data-num`
so it aligns right and uses equal-width numerals.

---

## 5. Layout and Rhythm

- 12-column grid, 16px gaps, full-width content with no max-width.
- All spacing is a multiple of 4 (`--pb-1` through `--pb-12`).
- Radius: cards 14px, buttons/inputs 10px, badges fully rounded, thumbnails 6px.
- Use subtle shadows to establish layers; dark mode uses luminous borders instead of heavy shadows.
- Normal page order: `pagehead → KPI → main content → table → supporting information`.
- Sidebar is 264px, collapses to 72px and remembers the choice. Below 992px it becomes a drawer.
- Footer height matches the sidebar bottom bar through the shared `--pb-bar-h: 64px` token.

---

## 6. Component Inventory

Buttons (primary/secondary/ghost/danger/success, sm/lg/block), icon buttons, cards (head/body/foot), KPI stats and delta chips,
badges, avatars, dropdowns, toasts, modals, tabs, segmented controls, switches, checkboxes, input/select/textarea groups,
toolbars, footer bars, top navigation, collapse toggles, sortable/paginated tables, meters, timelines, alerts, empty states,
skeletons, and keyboard hints.

Charts are hand-written SVG: area, donut, sparkline, and bar-list charts.
Every component uses a `pb-` class prefix. Only `01-tokens.css` may declare hex colors.

---

## 7. Shared Status Vocabulary

| Document status | Badge | Color |
|---|---|---|
| Draft | `pb-badge--muted` | Gray |
| Pending review | `pb-badge--warn` | Orange/amber |
| Posted | `pb-badge--pos` | Green |
| Cancelled | `pb-badge--neg` | Red |

Stock states are exactly **Normal / Low / Critical**. Do not mix in terms such as “empty” or “small”.

Buttons and results use the same vocabulary: clicking **Post** should produce **Posted** or **Posted successfully**.

---

## 8. Voice and Copy

- Thai is the primary product language; team terms such as SKU, DC, and API may remain as technical transliterations.
- Use the user’s words: “route” instead of “route object”, “consignment” instead of “consignment record”.
- Error messages state what happened and what to do next. Do not apologize or use vague language.
- Empty states invite action rather than merely announcing emptiness.
- Labels identify a field; hints explain it. Do not combine both jobs in one line.

---

## 9. Motion and Accessibility

- Transitions: 120ms hover, 200ms general, 320ms meaningful data bars, all using `cubic-bezier(.4,0,.2,1)`.
- Animate only meaningful changes: cards do not float and buttons do not bounce; route bars and toasts may animate.
- `prefers-reduced-motion` disables all motion.
- Focus rings are a visible 2px orange ring. Never remove outlines without a replacement.
- Text contrast is at least 4.5:1 in both themes. Orange on white is bold and at least 13px, or use the warning token.
- Every page has a skip link, `aria-current`, `aria-sort`, and complete keyboard operation.

---

## 10. Design Prompt

### 10.1 Master Prompt — New PenbunWeb Screens

```text
You are the design lead for PenbunWeb, the front end for Penbun System, a wholesale and distribution system for books and stationery.
Users are warehouse staff, route supervisors, sales staff, and executives.

Technology (must not change):
- Pure HTML + CSS + TypeScript only. No React, Tailwind, or UI library.
- No runtime dependency. Charts are hand-written SVG.
- Every class starts with pb- and colors come from 01-tokens.css. Do not write hex in other files.
- Each page keeps only its own content inside <div id="pb-page" data-page="…">; shell.ts adds the sidebar/topbar.
  Never duplicate the menu in page HTML.

Color roles:
- Orange #F97316 = actionable / in progress. One solid orange button per screen.
- Green #16A34A = success, received, increased.
- Red #FF1E1E = cancelled, late, immediate attention.
- Light: canvas #F8FAFC, surface #FFFFFF. Dark: canvas #060712, surface #111827.
- Never use color alone to communicate status.

Typography: Google Sans, tabular-nums for numbers, IBM Plex Mono for document/SKU codes,
14px base and 13px in tables.

Layout: 12-column grid, 16px gaps, full-width content, all spacing in multiples of 4,
14px cards, 10px buttons/inputs, and subtle shadows only.

Language: Thai first. Use the operational terms route, consignment, and allocation history.
Buttons and outcomes use the same words. Errors state the cause and the next action.

Quality: responsive to mobile, clear focus rings, complete aria-current/aria-sort,
prefers-reduced-motion support, and no localStorage for business data
(theme/UI state only, plus the session token owned by core/tokens.ts).

Avoid: multicolor gradients, glassmorphism, table icons larger than 24px, floating cards,
implausible wholesale figures, and more than one solid orange button per screen.
```

### 10.2 Page Prompt — Append to the Master Prompt

```text
Create page: <Thai page name> (data-page="<id>")
The one job this page must accomplish: <the user comes here to…>
Primary action (one orange button): <button label>
Information visible before scrolling: <3–5 items>
Table: columns <…>; sortable columns <…>; numeric cells include data-num
States required: normal / loading (skeleton) / empty (empty state) / error
Highlighted navigation item: <id from nav.ts>
```

### 10.3 Completed Example

```text
Create page: Sales orders (data-page="orders")
The one job this page must accomplish: find orders awaiting review and open one immediately
Primary action: “Create sales order”
Information visible before scrolling: pending-review count, today’s total value, latest 10 orders
Table: document number / customer / route / date / line count / value / status
States required: Draft · Pending review · Posted · Cancelled
Highlighted navigation item: orders
```

---

## 11. Deliberate Omissions

- No crypto/fintech dashboard with giant balances and Send/Receive actions; that is not this business.
- No chart that does not answer a real operational question.
- No page-load animation; users open these screens dozens of times per day.
- No stock illustrations; empty states use actionable text instead.
