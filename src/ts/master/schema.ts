/**
 * master/schema.ts — the descriptor vocabulary, mirrored from PenbunAPI.
 *
 * PenbunAPI declares its 18 master resources as descriptors
 * (`internal/schema/field.go` + `internal/crud/resource.go`) and gets five
 * endpoints each from one generic engine. This file is the front-end half of
 * that same idea: a screen is declared, not written, and one engine
 * (`master/page.ts`) turns the declaration into a working list + form.
 *
 * The names here deliberately match the Go side field for field, so a change
 * on the server can be mirrored by editing one descriptor rather than hunting
 * through markup:
 *
 *     schema.Field  → Field        schema.Ref    → Ref
 *     schema.Filter → FilterDef    crud.Resource → MasterResource
 *
 * What is NOT mirrored is validation. The database owns the rules; the API
 * enforces them and answers with `errors[]`. Anything checked here is checked
 * only to save a round trip, never as the authority.
 */

import type { IconName } from "../core/icons.js";

/** Mirrors schema.Kind. Decides both the input control and the cell format. */
export type Kind = "string" | "int" | "decimal" | "bool" | "date";

/** A column the client may write. Mirrors schema.Field. */
export interface Field {
  /** JSON key sent to the API. */
  name: string;
  kind: Kind;
  label: string;
  /** Required on create. Update is always partial. */
  required?: boolean;
  /** Settable on create, rejected afterwards — the input is disabled on edit. */
  noUpdate?: boolean;
  maxLen?: number;
  /** Renders a <select>; the values must match the CHECK constraint. */
  enumValues?: readonly string[];
  /**
   * Key into `GET /meta/enums` (`<table without tb_>_<column>`). When the
   * endpoint answers, its list wins and `enumValues` is only the fallback —
   * see core/enums.ts.
   */
  enumKey?: string;
  /** Thai labels for enumValues, keyed by value. */
  enumLabels?: Readonly<Record<string, string>>;
  min?: number;
  hint?: string;
  /** Render as a textarea rather than a single-line input. */
  multiline?: boolean;
  /** Field spans both form columns. */
  wide?: boolean;
}

/** A foreign key the client sends as a business ID. Mirrors schema.Ref. */
export interface Ref {
  /** JSON key, e.g. "customer_type_id". */
  field: string;
  /** Name of the master resource the options come from. */
  resource: string;
  label: string;
  required?: boolean;
  noUpdate?: boolean;
  /**
   * Tables that outgrow a <select>. The API caps `limit` at 200, so anything
   * that can exceed that gets a search box with suggestions instead of a list
   * that silently stops at row 200.
   */
  big?: boolean;
  hint?: string;
  wide?: boolean;
}

/** A query parameter the list endpoint accepts. Mirrors schema.Filter. */
export interface FilterDef {
  param: string;
  label: string;
  /** Options come from another master resource. */
  resource?: string;
  /** Fixed options — value plus Thai label. */
  options?: ReadonlyArray<{ value: string; label: string }>;
  /**
   * Same contract as Field.enumKey: the live list decides the options and
   * `options` becomes the fallback. Labels come from `enumLabels`, because
   * the endpoint answers with codes only.
   */
  enumKey?: string;
  enumLabels?: Readonly<Record<string, string>>;
  /** No options at all: a free-text box (province, issue_no). */
  free?: boolean;
  /**
   * The source table can exceed the API's 200-row cap, so the control is a
   * search box with suggestions instead of a list that quietly stops short.
   */
  big?: boolean;
}

/** How one cell of the list table is rendered. */
export type CellKind =
  | "text"
  | "code" // monospace — business IDs and SKUs
  | "money"
  | "qty"
  | "date"
  | "bool"
  | "badge"
  | "percent";

export interface Column {
  /** Key in the row the API returned. */
  key: string;
  label: string;
  /** Sort key accepted by the API (`sort=` / `sort=-`). Omit = not sortable. */
  sort?: string;
  kind?: CellKind;
  /** Second line under the value, for the leading identity column. */
  meta?: string;
  /** Badge tone when kind is "badge" or "bool". */
  tone?: "brand" | "pos" | "neg" | "warn" | "muted";
  /**
   * Thai labels for coded values, keyed by the raw value as a string.
   * A bit column arrives as JSON true/false, so a bool column keys its
   * labels on "true" / "false".
   */
  labels?: Readonly<Record<string, string>>;
  /** Text shown when the value is null/empty. Default "—". */
  blank?: string;
}

/** One master-data screen. Mirrors crud.Resource. */
export interface MasterResource {
  /** `data-page` of the HTML file, and the nav id. */
  page: string;
  /** Path segment under /api/v2 — must equal crud.Resource.Name. */
  name: string;
  /** Thai label, singular, used in every message the screen prints. */
  label: string;
  /** Eyebrow above the page title. */
  group: string;
  subtitle: string;
  icon: IconName;
  /** Business ID column — the value that goes in the URL of a write. */
  idKey: string;
  /** Column shown as the row's name, in tables and in ref pickers. */
  titleKey: string;
  /** Second line under titleKey in the ref picker. Defaults to idKey. */
  refMeta?: string;
  /** GET only. `book` is read-only in the CRUD engine but writes to /book. */
  readOnly?: boolean;
  /**
   * The source exposes is_active / update_date. False for vw_customer_route,
   * which returns neither — filtering or showing a status there would ask the
   * database for a column that is not in the view.
   */
  audit?: boolean;
  /** The resource declares SearchColumns; false hides the search box. */
  searchable?: boolean;
  /** Sort key used when the screen opens. Must exist in SortColumns. */
  defaultSort?: string;
  /** Default sort direction. The API defaults to descending. */
  defaultAsc?: boolean;
  columns: Column[];
  filters?: FilterDef[];
  fields: Field[];
  refs?: Ref[];
}

/** Every write for this resource goes through this path. */
export const writePath = (r: MasterResource): string => `/${r.name}`;

/** True when the screen may offer create/edit/delete. */
export const writable = (r: MasterResource): boolean => r.readOnly !== true;
