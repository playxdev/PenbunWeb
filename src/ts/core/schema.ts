/**
 * core/schema.ts — the field vocabulary, mirrored from PenbunAPI.
 *
 * PenbunAPI keeps these in `internal/schema` and both engines read them: the
 * CRUD engine builds the 18 master resources out of them, and the document
 * engine builds a header and its item lines out of the same four types. This
 * file is the front-end half, and it sits in core/ for exactly that reason —
 * a document is not a kind of master resource, and neither should have to
 * import the other to describe a text box.
 *
 *     schema.Field  → Field        schema.Ref    → Ref
 *     schema.Filter → FilterDef    schema.Kind   → Kind
 *
 * What is NOT mirrored is validation. The database owns the rules; the API
 * enforces them and answers with `errors[]`. Anything checked on this side is
 * checked only to save a round trip, never as the authority.
 */

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
