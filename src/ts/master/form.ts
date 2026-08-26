/**
 * master/form.ts — the create/edit dialog, built from a descriptor.
 *
 * What the API expects, and therefore what this module does:
 *
 *   create   every filled field plus every filled ref. Blanks are omitted so
 *            the column keeps its DEFAULT instead of being overwritten with
 *            an empty string.
 *   update   only what the user actually changed. PenbunAPI answers
 *            "ไม่มีข้อมูลที่ต้องแก้ไข" to an empty body, and rejects any
 *            NoUpdate field outright — so those inputs are disabled and never
 *            reach the payload.
 *   clearing a value sends `null`, which writes NULL. A ref cannot be cleared
 *            this way: ResolveRefs treats null as "not sent" (see the TODO
 *            note in PENBUN-TODO.md), so an optional ref can be pointed
 *            somewhere else but not emptied.
 *
 * Validation here is a courtesy, not a rule. Required and max-length are
 * checked to save a round trip; everything else — enums, ranges, uniqueness,
 * referential integrity — is the database's answer, surfaced through
 * `errors[]` and pinned onto the field it names.
 */

import { ApiError } from "../core/api.js";
import { esc } from "../core/format.js";
import { icon } from "../core/icons.js";
import { toast } from "../core/ui.js";
import { MASTER_BY_NAME } from "./resources.js";
import { values as enumOptions } from "../core/enums.js";
import { createRow, forgetOptions, options, updateRow, type Option, type Row } from "./repo.js";
import type { Field, MasterResource, Ref } from "./schema.js";

type Mode = "create" | "edit";

/** RFC3339 in, the `YYYY-MM-DD` an <input type="date"> wants out. */
const dateInputValue = (raw: unknown): string => {
  if (raw === null || raw === undefined || raw === "") return "";
  return String(raw).slice(0, 10);
};

const controlId = (name: string): string => `pb-f-${name}`;

/* ----------------------------------------------------------------- build */

function fieldControl(f: Field, row: Row | undefined, mode: Mode): string {
  const id = controlId(f.name);
  const locked = mode === "edit" && f.noUpdate;
  const disabled = locked ? " disabled" : "";
  const raw = row?.[f.name];

  if (f.kind === "bool") {
    const on = raw === true || raw === 1 || raw === "1";
    return `<label class="pb-check">
      <input type="checkbox" id="${id}" data-field="${esc(f.name)}"${on ? " checked" : ""}${disabled}>
      <span>${esc(f.label)}</span></label>`;
  }

  if (f.enumValues?.length) {
    const current = raw === null || raw === undefined ? "" : String(raw);
    // The CHECK constraint decides, not this build — see core/enums.ts.
    const accepted = f.enumKey ? enumOptions(f.enumKey, f.enumValues) : f.enumValues;
    const opts = accepted
      .map(
        (v) =>
          `<option value="${esc(v)}"${v === current ? " selected" : ""}>${esc(f.enumLabels?.[v] ?? v)}</option>`
      )
      .join("");
    return `<select class="pb-select" id="${id}" data-field="${esc(f.name)}"${disabled}>
      <option value="">— เลือก —</option>${opts}</select>`;
  }

  if (f.multiline) {
    return `<textarea class="pb-textarea" id="${id}" data-field="${esc(f.name)}" rows="2"${
      f.maxLen ? ` maxlength="${f.maxLen}"` : ""
    }${disabled}>${esc(raw ?? "")}</textarea>`;
  }

  if (f.kind === "int" || f.kind === "decimal") {
    const step = f.kind === "int" ? "1" : "0.01";
    const min = f.min !== undefined ? ` min="${f.min}"` : "";
    const value = raw === null || raw === undefined ? "" : String(raw);
    return `<input class="pb-input" type="number" inputmode="decimal" step="${step}"${min}
      id="${id}" data-field="${esc(f.name)}" value="${esc(value)}"${disabled}>`;
  }

  if (f.kind === "date") {
    return `<input class="pb-input" type="date" id="${id}" data-field="${esc(f.name)}"
      value="${esc(dateInputValue(raw))}"${disabled}>`;
  }

  return `<input class="pb-input" type="text" id="${id}" data-field="${esc(f.name)}"
    value="${esc(raw ?? "")}"${f.maxLen ? ` maxlength="${f.maxLen}"` : ""} autocomplete="off"${disabled}>`;
}

function fieldBlock(f: Field, row: Row | undefined, mode: Mode): string {
  const id = controlId(f.name);
  const req = f.required ? '<span class="pb-label__req" aria-hidden="true">*</span>' : "";
  const label =
    f.kind === "bool" ? "" : `<label class="pb-label" for="${id}">${esc(f.label)}${req}</label>`;
  const locked = mode === "edit" && f.noUpdate;
  const hint = locked ? "แก้ไขภายหลังไม่ได้" : f.hint;
  return `<div class="pb-field${f.wide ? " pb-field--wide" : ""}">
    ${label}${fieldControl(f, row, mode)}
    ${hint ? `<span class="pb-hint">${esc(hint)}</span>` : ""}
    <span class="pb-error pb-hide" data-error-for="${esc(f.name)}"></span>
  </div>`;
}

function refBlock(ref: Ref, row: Row | undefined, mode: Mode): string {
  const id = controlId(ref.field);
  const locked = mode === "edit" && ref.noUpdate;
  const disabled = locked ? " disabled" : "";
  const req = ref.required ? '<span class="pb-label__req" aria-hidden="true">*</span>' : "";
  const current = row?.[ref.field] === null || row?.[ref.field] === undefined ? "" : String(row[ref.field]);
  const hint = locked ? "แก้ไขภายหลังไม่ได้" : ref.hint;

  // A big table gets a search box with suggestions: the API caps `limit` at
  // 200, so a <select> would quietly stop before the row being looked for.
  const control = ref.big
    ? `<input class="pb-input" type="search" id="${id}" data-ref="${esc(ref.field)}"
        data-resource="${esc(ref.resource)}" list="pb-reflist-${esc(ref.field)}"
        value="${esc(current)}" autocomplete="off" placeholder="พิมพ์เพื่อค้นหา แล้วเลือกรหัส"${disabled}>
       <datalist id="pb-reflist-${esc(ref.field)}"></datalist>`
    : `<select class="pb-select" id="${id}" data-ref="${esc(ref.field)}"
        data-resource="${esc(ref.resource)}" data-value="${esc(current)}"${disabled}>
        <option value="">กำลังโหลด…</option></select>`;

  return `<div class="pb-field${ref.wide ? " pb-field--wide" : ""}">
    <label class="pb-label" for="${id}">${esc(ref.label)}${req}</label>
    ${control}
    ${hint ? `<span class="pb-hint">${esc(hint)}</span>` : ""}
    <span class="pb-error pb-hide" data-error-for="${esc(ref.field)}"></span>
  </div>`;
}

/* -------------------------------------------------------------- populate */

const optionMarkup = (list: Option[], current: string): string =>
  list
    .map((o) => {
      const label = o.meta && o.meta !== o.value ? `${o.label} · ${o.meta}` : o.label;
      return `<option value="${esc(o.value)}"${o.value === current ? " selected" : ""}>${esc(label)}</option>`;
    })
    .join("");

/**
 * Fill every <select> that draws on another resource.
 *
 * A ref list that fails to load must not look like an empty table: the select
 * says so and stays usable, because the row being edited already holds a
 * valid value that the user should be able to keep.
 */
async function fillRefSelects(root: HTMLElement): Promise<void> {
  const selects = [...root.querySelectorAll<HTMLSelectElement>("select[data-resource]")];
  await Promise.all(
    selects.map(async (sel) => {
      const name = sel.dataset.resource;
      if (!name) return;
      const current = sel.dataset.value ?? sel.value ?? "";
      const target = MASTER_BY_NAME[name];
      const placeholder = `— เลือก${target ? target.label : ""} —`;
      try {
        const list = await options(name);
        sel.innerHTML = `<option value="">${esc(placeholder)}</option>${optionMarkup(list, current)}`;
        // The stored value may point at a suspended row that the active-only
        // option list left out. Keep it rather than silently reassigning it.
        if (current && !list.some((o) => o.value === current)) {
          sel.insertAdjacentHTML("beforeend", `<option value="${esc(current)}" selected>${esc(current)}</option>`);
        }
        sel.value = current;
      } catch {
        sel.innerHTML = `<option value="${esc(current)}">${esc(current || "โหลดตัวเลือกไม่สำเร็จ")}</option>`;
      }
    })
  );
}

/** Type-ahead suggestions for the big tables. */
function wireRefSearch(root: HTMLElement): void {
  root.querySelectorAll<HTMLInputElement>("input[data-ref][data-resource]").forEach((input) => {
    const name = input.dataset.resource!;
    const list = root.querySelector<HTMLDataListElement>(`#pb-reflist-${input.dataset.ref}`);
    if (!list) return;
    let timer = 0;
    const load = (term: string): void => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void options(name, term)
          .then((found) => {
            list.innerHTML = found
              .map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`)
              .join("");
          })
          .catch(() => undefined);
      }, 250);
    };
    input.addEventListener("input", () => load(input.value.trim()));
    load("");
  });
}

/* ------------------------------------------------------------ read + send */

interface Collected {
  body: Row;
  problems: Array<{ field: string; message: string }>;
}

function collect(r: MasterResource, root: HTMLElement, mode: Mode, row: Row | undefined): Collected {
  const body: Row = {};
  const problems: Collected["problems"] = [];
  const creating = mode === "create";

  for (const f of r.fields) {
    if (!creating && f.noUpdate) continue;
    const el = root.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      `[data-field="${CSS.escape(f.name)}"]`
    );
    if (!el) continue;

    if (f.kind === "bool") {
      const on = (el as HTMLInputElement).checked;
      const was = row?.[f.name] === true || row?.[f.name] === 1;
      if (creating || on !== was) body[f.name] = on;
      continue;
    }

    const text = el.value.trim();
    const before =
      f.kind === "date" ? dateInputValue(row?.[f.name]) : row?.[f.name] == null ? "" : String(row[f.name]);
    if (!creating && text === before) continue;

    if (text === "") {
      if (f.required) {
        problems.push({ field: f.name, message: `ต้องระบุ${f.label}` });
        continue;
      }
      if (!creating) body[f.name] = null; // clearing a value writes NULL
      continue;
    }

    if (f.maxLen && [...text].length > f.maxLen) {
      problems.push({ field: f.name, message: `${f.label} ยาวเกิน ${f.maxLen} ตัวอักษร` });
      continue;
    }

    if (f.kind === "int" || f.kind === "decimal") {
      const n = Number(text);
      if (!Number.isFinite(n)) {
        problems.push({ field: f.name, message: `${f.label} ต้องเป็นตัวเลข` });
        continue;
      }
      body[f.name] = f.kind === "int" ? Math.trunc(n) : n;
      continue;
    }

    body[f.name] = text;
  }

  for (const ref of r.refs ?? []) {
    if (!creating && ref.noUpdate) continue;
    const el = root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-ref="${CSS.escape(ref.field)}"]`);
    if (!el) continue;
    const value = el.value.trim();
    const before = row?.[ref.field] == null ? "" : String(row[ref.field]);
    if (value === "") {
      if (ref.required) problems.push({ field: ref.field, message: `ต้องระบุ${ref.label}` });
      continue; // ResolveRefs cannot clear a ref, so an empty box means "leave it"
    }
    if (!creating && value === before) continue;
    body[ref.field] = value;
  }

  return { body, problems };
}

function clearErrors(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>("[data-error-for]").forEach((el) => {
    el.textContent = "";
    el.classList.add("pb-hide");
  });
  root.querySelectorAll<HTMLElement>("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
}

/** Pin a message onto the input it belongs to; return false if there is none. */
function showFieldError(root: HTMLElement, field: string, message: string): boolean {
  const slot = root.querySelector<HTMLElement>(`[data-error-for="${CSS.escape(field)}"]`);
  if (!slot) return false;
  slot.textContent = message;
  slot.classList.remove("pb-hide");
  root
    .querySelector(`[data-field="${CSS.escape(field)}"], [data-ref="${CSS.escape(field)}"]`)
    ?.setAttribute("aria-invalid", "true");
  return true;
}

/* ------------------------------------------------------------------ open */

/**
 * Show the dialog. Resolves with the saved row, or null when dismissed.
 * The caller reloads the list; this module never touches the table.
 */
export function openMasterForm(r: MasterResource, mode: Mode, row?: Row): Promise<Row | null> {
  const id = row ? String(row[r.idKey] ?? "") : "";
  const title = mode === "create" ? `เพิ่ม${r.label}` : `แก้ไข${r.label}`;

  const refs = (r.refs ?? []).map((ref) => refBlock(ref, row, mode)).join("");
  const fields = r.fields.map((f) => fieldBlock(f, row, mode)).join("");

  const host = document.createElement("div");
  host.className = "pb-modal";
  host.innerHTML = `<div class="pb-modal__panel pb-modal__panel--lg" role="dialog" aria-modal="true"
      aria-labelledby="pb-form-title">
    <form novalidate>
      <div class="pb-modal__head">
        <div>
          <h2 class="pb-modal__title" id="pb-form-title">${esc(title)}</h2>
          ${id ? `<div class="pb-modal__sub"><span class="pb-mono">${esc(id)}</span></div>` : ""}
        </div>
        <button class="pb-iconbtn pb-iconbtn--sm" type="button" data-close aria-label="ปิด">${icon("x")}</button>
      </div>
      <div class="pb-modal__body"><div class="pb-formgrid">${refs}${fields}</div></div>
      <div class="pb-modal__foot">
        <span class="pb-error pb-hide" data-form-error></span>
        <button class="pb-btn pb-btn--secondary" type="button" data-close>ยกเลิก</button>
        <button class="pb-btn pb-btn--primary" type="submit">บันทึก</button>
      </div>
    </form>
  </div>`;

  document.body.appendChild(host);
  void fillRefSelects(host);
  wireRefSearch(host);
  requestAnimationFrame(() => {
    host.classList.add("is-open");
    host.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled]), textarea:not([disabled])")?.focus();
  });

  return new Promise<Row | null>((resolve) => {
    const form = host.querySelector("form")!;
    const submit = host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const formError = host.querySelector<HTMLElement>("[data-form-error]")!;

    const close = (result: Row | null): void => {
      document.removeEventListener("keydown", onKey);
      host.remove();
      resolve(result);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") close(null);
    };
    document.addEventListener("keydown", onKey);

    host.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => close(null)));
    host.addEventListener("click", (e) => {
      if (e.target === host) close(null);
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      clearErrors(host);
      formError.classList.add("pb-hide");

      const { body, problems } = collect(r, host, mode, row);
      if (problems.length > 0) {
        problems.forEach((p) => showFieldError(host, p.field, p.message));
        formError.textContent = "กรอกข้อมูลที่จำเป็นให้ครบก่อนบันทึก";
        formError.classList.remove("pb-hide");
        return;
      }
      if (mode === "edit" && Object.keys(body).length === 0) {
        formError.textContent = "ไม่มีข้อมูลที่ต้องแก้ไข";
        formError.classList.remove("pb-hide");
        return;
      }

      submit.disabled = true;
      submit.textContent = "กำลังบันทึก…";

      const done = (saved: Row): void => {
        // A write can change what other screens offer in their pickers.
        forgetOptions(r.name);
        toast(mode === "create" ? `เพิ่ม${r.label}เรียบร้อย` : `แก้ไข${r.label}เรียบร้อย`, "", "pos");
        close(saved);
      };

      const fail = (err: unknown): void => {
        submit.disabled = false;
        submit.textContent = "บันทึก";
        if (!(err instanceof ApiError)) {
          formError.textContent = "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
          formError.classList.remove("pb-hide");
          return;
        }
        // errors[] names the field; anything without a home goes to the foot
        // so a validation failure is never silent.
        const orphans = err.fieldErrors.filter((fe) => !showFieldError(host, fe.field, err.message));
        formError.textContent =
          err.fieldErrors.length === 0 || orphans.length > 0
            ? err.message
            : "ตรวจสอบข้อมูลที่ทำเครื่องหมายไว้แล้วบันทึกอีกครั้ง";
        formError.classList.remove("pb-hide");
      };

      const req = mode === "create" ? createRow(r, body) : updateRow(r, id, body);
      req.then(done).catch(fail);
    });
  });
}
