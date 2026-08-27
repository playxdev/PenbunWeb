/**
 * core/fields.ts — one input control per Field, and one picker per Ref.
 *
 * Pure markup. Nothing here fetches, and nothing here knows whether the row
 * it is rendering came from a master resource or from a document header —
 * both are described by the same `core/schema.ts` types, because PenbunAPI
 * describes both with the same Go package.
 *
 * The rules encoded in the markup, all of them the API's:
 *
 *   noUpdate   the control is disabled on edit rather than hidden. The user
 *              can still read the value; sending it would be rejected
 *              outright ("แก้ไขภายหลังไม่ได้"), not ignored.
 *   enumKey    the <select> offers what the CHECK constraint accepts today,
 *              not what this build was compiled with — see core/enums.ts.
 *   big        a table that can exceed the API's 200-row `limit` cap gets a
 *              search box with suggestions, never a <select> that quietly
 *              stops at row 200.
 *   address    the field is one step of จังหวัด → อำเภอ → ตำบล → ไปรษณีย์.
 *              The control is a <select> that starts out empty and says
 *              "กำลังโหลด…" until `wireAddress` fills it — the same contract
 *              a ref picker has with `fillRefSelects` — and it still writes a
 *              plain string, because that is what the column holds.
 *
 * Reading the controls back is the caller's job: a master form sends only
 * what changed, a document sends a whole item list, and the difference is
 * theirs to keep.
 */

import { esc } from "./format.js";
import { values as enumOptions } from "./enums.js";
import type { Field, Ref } from "./schema.js";

/** A row as it came back from the API. */
export type Row = Record<string, unknown>;

export type Mode = "create" | "edit";

/** RFC3339 in, the `YYYY-MM-DD` an <input type="date"> wants out. */
export const dateInputValue = (raw: unknown): string => {
  if (raw === null || raw === undefined || raw === "") return "";
  return String(raw).slice(0, 10);
};

export const controlId = (name: string): string => `pb-f-${name}`;

/* ----------------------------------------------------------------- build */

export function fieldControl(f: Field, row: Row | undefined, mode: Mode): string {
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

  // The three place names are lists; the ไปรษณีย์ beneath them stays a box,
  // filled in by the picker but never locked — a row can hold a code the
  // tables disagree with, and correcting it by hand must remain possible.
  if (f.address && f.address !== "zip_code") {
    const current = raw === null || raw === undefined ? "" : String(raw);
    return `<select class="pb-select" id="${id}" data-field="${esc(f.name)}"
      data-address="${esc(f.address)}" data-value="${esc(current)}"${disabled}>
      <option value="">กำลังโหลด…</option></select>`;
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

  if (f.secret) {
    // autocomplete="new-password" so the browser offers to generate one
    // rather than filling in the administrator's own saved password.
    return `<input class="pb-input" type="password" id="${id}" data-field="${esc(f.name)}"
      autocomplete="new-password"${f.maxLen ? ` maxlength="${f.maxLen}"` : ""}${disabled}>`;
  }

  const address = f.address ? ` data-address="${esc(f.address)}"` : "";
  return `<input class="pb-input" type="text" id="${id}" data-field="${esc(f.name)}"${address}
    value="${esc(raw ?? "")}"${f.maxLen ? ` maxlength="${f.maxLen}"` : ""} autocomplete="off"${disabled}>`;
}

export function fieldBlock(f: Field, row: Row | undefined, mode: Mode): string {
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

export function refBlock(ref: Ref, row: Row | undefined, mode: Mode): string {
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

/* ------------------------------------------------------------ read back */

/** What a form gave up: a body ready to send, and what the user must fix. */
export interface Collected {
  body: Row;
  problems: Array<{ field: string; message: string }>;
}

/** The writable half of a descriptor — a master resource or a document header. */
export interface Writable {
  fields: readonly Field[];
  refs: readonly Ref[];
}

export function collectValues(
  r: Writable,
  root: HTMLElement,
  mode: Mode,
  row: Row | undefined
): Collected {
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

  for (const ref of r.refs) {
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

/* ---------------------------------------------------------------- errors */

export function clearErrors(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>("[data-error-for]").forEach((el) => {
    el.textContent = "";
    el.classList.add("pb-hide");
  });
  root.querySelectorAll<HTMLElement>("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
}

/** Pin a message onto the input it belongs to; return false if there is none. */
export function showFieldError(root: HTMLElement, field: string, message: string): boolean {
  const slot = root.querySelector<HTMLElement>(`[data-error-for="${CSS.escape(field)}"]`);
  if (!slot) return false;
  slot.textContent = message;
  slot.classList.remove("pb-hide");
  root
    .querySelector(`[data-field="${CSS.escape(field)}"], [data-ref="${CSS.escape(field)}"]`)
    ?.setAttribute("aria-invalid", "true");
  return true;
}
