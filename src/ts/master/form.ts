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
import { createRow, forgetOptions, options, updateRow, type Option, type Row } from "./repo.js";
import type { MasterResource } from "./schema.js";

import type { Mode } from "../core/fields.js";
import { clearErrors, collectValues, fieldBlock, refBlock, showFieldError } from "../core/fields.js";

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
export async function fillRefSelects(root: HTMLElement): Promise<void> {
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
export function wireRefSearch(root: HTMLElement): void {
  root.querySelectorAll<HTMLInputElement>("input[data-ref][data-resource]").forEach((input) => {
    const name = input.dataset.resource!;
    // Looked up in the document, not in `root`: the document editor clones a
    // line to add one, and the clone does not contain the shared <datalist>.
    const list = document.getElementById(`pb-reflist-${input.dataset.ref}`) as HTMLDataListElement | null;
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

      const { body, problems } = collectValues({ fields: r.fields, refs: r.refs ?? [] }, host, mode, row);
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
