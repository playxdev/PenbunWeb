/**
 * docs/schema.ts — the document vocabulary, mirrored from PenbunAPI.
 *
 * PenbunAPI describes each of its four document types as a `document.Spec`
 * and gets nine endpoints from one engine (`internal/domain/document`). This
 * file is the front-end half of the same idea, and it deliberately mirrors
 * only the parts a screen can see: the server's Spec also carries table
 * names, the posting procedure and the lock SQL, none of which the client is
 * ever told about.
 *
 *     schema.Field  → Field (shared with the master engine)
 *     schema.Ref    → Ref
 *     schema.Filter → FilterDef
 *     document.Spec → DocSpec
 *
 * The lifecycle is the part worth being pedantic about, because getting it
 * wrong shows up as a button that does nothing, or worse, one that moves
 * stock when the user thought they were still drafting:
 *
 *     ใบรับสินค้า      DRAFT → CONFIRMED → POSTED               → (CANCELLED)
 *     ใบส่งหนังสือ     DRAFT → CONFIRMED → DELIVERED → INVOICED → (CANCELLED)
 *     ใบรับคืน         DRAFT → CONFIRMED → POSTED → CREDITED    → (CANCELLED)
 *     ใบส่งคืนคู่ค้า    DRAFT → CONFIRMED → POSTED → SETTLED     → (CANCELLED)
 *
 * Three of the four end at POSTED and one ends at DELIVERED, so "posted" is
 * per spec, never a shared constant. `postedStatuses` is the full set that
 * counts as posted — INVOICED is past DELIVERED, and a document there is no
 * more editable than one that just landed.
 */

import type { IconName } from "../core/icons.js";
import type { CellSpec, Tone } from "../core/table.js";
import type { Field, FilterDef, Ref } from "../master/schema.js";

/** Statuses every document shares. The rest are per spec. */
export const DRAFT = "DRAFT";
export const CONFIRMED = "CONFIRMED";
export const CANCELLED = "CANCELLED";

/** A column of the list table or the items table. */
export interface DocColumn extends CellSpec {
  key: string;
  label: string;
}

export interface StatusStyle {
  label: string;
  tone: Tone;
}

/** One document type. Mirrors the client-visible half of document.Spec. */
export interface DocSpec {
  /** `data-page` of the HTML file, and the nav id. */
  page: string;
  /** Path segment under /api/v2 — must equal document.Spec.Name. */
  name: string;
  /** Thai label, singular, used in every message the screen prints. */
  label: string;
  group: string;
  subtitle: string;
  icon: IconName;
  /** Business ID column — the value every write puts in the URL. */
  idKey: string;

  /** Status the document lands in when /post succeeds. */
  postedStatus: string;
  /** Every status that means "already posted". Mirrors Spec.PostedStatuses. */
  postedStatuses: readonly string[];
  /** Every status the filter offers, in lifecycle order. */
  statuses: readonly string[];
  statusStyle: Readonly<Record<string, StatusStyle>>;

  /** Wording of the post button — "โพสต์" is wrong on the delivery note. */
  postLabel: string;
  /** What posting will do, said plainly in the confirmation. */
  postWarning: string;

  /** List table. No `sort`: the list endpoint accepts no sort parameter. */
  columns: DocColumn[];
  /** Items table inside the editor. */
  itemColumns: DocColumn[];

  headerRefs: Ref[];
  headerFields: Field[];
  itemRefs: Ref[];
  itemFields: Field[];
  filters?: FilterDef[];
}

/* --------------------------------------------------------------- lifecycle */

export const isDraft = (status: string): boolean => status === DRAFT;

export const isPosted = (s: DocSpec, status: string): boolean => s.postedStatuses.includes(status);

/**
 * What the user may do from here.
 *
 * Every rule below is enforced by the server as well — the screen only
 * decides which buttons exist, so that a user is never offered an action that
 * comes back 422. The guards are, from `internal/domain/document/handler.go`:
 *
 *   edit header · replace items · delete   requireDraft
 *   confirm                                DRAFT only
 *   post                                   CONFIRMED only, ALREADY_POSTED otherwise
 *   cancel                                 DRAFT or CONFIRMED only
 *
 * There is no `reverse`. A posted document can only be undone by a reversing
 * document, and neither the procedure nor `PUT /{doc}/{id}/reverse` exists
 * yet (PENBUN-TODO §2.4 · §3.4). A button here would be a promise the system
 * cannot keep, and the documented workaround — an administrator adjusting
 * stock by hand — leaves no trail back to the document that caused it.
 */
export interface DocActions {
  edit: boolean;
  confirm: boolean;
  post: boolean;
  cancel: boolean;
  remove: boolean;
}

export function actions(status: string): DocActions {
  return {
    edit: status === DRAFT,
    confirm: status === DRAFT,
    post: status === CONFIRMED,
    cancel: status === DRAFT || status === CONFIRMED,
    remove: status === DRAFT,
  };
}

export function statusStyle(s: DocSpec, status: string): StatusStyle {
  return s.statusStyle[status] ?? { label: status || "—", tone: "muted" };
}

/** Every write for this document goes through this path. */
export const docPath = (s: DocSpec): string => `/${s.name}`;
