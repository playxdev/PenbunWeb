/**
 * master/schema.ts — the descriptor vocabulary, mirrored from PenbunAPI.
 *
 * PenbunAPI declares its 20 master resources as descriptors
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
import type { Field, FilterDef, Ref } from "../core/schema.js";

// Kind, Field, Ref and FilterDef live in core/schema.ts: PenbunAPI keeps them
// in `internal/schema`, shared by the CRUD engine and the document engine, and
// this side needs them in both places for the same reason. They are re-exported
// here so a master descriptor still reads as one import.
export type { Field, FilterDef, Kind, Ref } from "../core/schema.js";

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
