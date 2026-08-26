/**
 * docs/repo.ts — every document request, in one place.
 *
 * The nine endpoints PenbunAPI mounts per document type
 * (`internal/domain/document/handler.go` → Mount):
 *
 *     GET    /{name}                list · filter · page
 *     GET    /{name}/{id}           header + items
 *     POST   /{name}                create as DRAFT, items in the same call
 *     PUT    /{name}/{id}           partial header update   DRAFT only
 *     PUT    /{name}/{id}/items     replace every item      DRAFT only
 *     PUT    /{name}/{id}/confirm   DRAFT → CONFIRMED
 *     PUT    /{name}/{id}/post      the stored procedure    CONFIRMED only
 *     PUT    /{name}/{id}/cancel    → CANCELLED             DRAFT · CONFIRMED
 *     DELETE /{name}/{id}           soft delete → 204       DRAFT only
 *
 * `{id}` is the business ID (`RCV0000123`), never `autoID`.
 *
 * Three differences from the master engine are easy to trip over:
 *
 *   1. The list endpoint accepts no `q` and no `sort`. It orders by
 *      `doc_date DESC, autoID DESC` and that is the only order there is, so
 *      the screen must not offer sortable headers. `doc_no` is a LIKE match
 *      and is the closest thing to a search box.
 *   2. Every write but the delete answers `{ header, items }` rather than a
 *      bare row, so a save refreshes the whole editor from the server —
 *      including `total_qty` and `total_amount`, which the database
 *      recalculates from the lines on every write.
 *   3. There is no endpoint for one item. Items are replaced as a set,
 *      deliberately: the totals have to be recomputed anyway, and replacing
 *      the whole list makes a retry harmless.
 */

import { del, get, post, put, type RequestOptions } from "../core/api.js";
import type { DocSpec } from "./schema.js";

export type Row = Record<string, unknown>;

/** The `data` shape of the list endpoint (httpx.Page). */
export interface DocPage {
  items: Row[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

/** The `data` shape of every other endpoint but DELETE. */
export interface DocDetail {
  header: Row;
  items: Row[];
}

export interface DocQuery {
  page: number;
  limit: number;
  /** Exact match on doc_status. */
  status?: string;
  /** LIKE '%…%' on doc_no. */
  docNo?: string;
  /** Inclusive. The API turns date_to into `< DATEADD(DAY, 1, …)`. */
  dateFrom?: string;
  dateTo?: string;
  /** Keyed by FilterDef.param. Empty strings are dropped. */
  filters?: Record<string, string>;
}

export const PAGE_SIZE = 25;

function queryString(q: DocQuery): string {
  const p = new URLSearchParams();
  p.set("page", String(q.page));
  p.set("limit", String(q.limit));
  if (q.status) p.set("doc_status", q.status);
  if (q.docNo) p.set("doc_no", q.docNo);
  if (q.dateFrom) p.set("date_from", q.dateFrom);
  if (q.dateTo) p.set("date_to", q.dateTo);
  for (const [k, v] of Object.entries(q.filters ?? {})) {
    if (v !== "") p.set(k, v);
  }
  return p.toString();
}

const at = (s: DocSpec, id: string, suffix = ""): string =>
  `/${s.name}/${encodeURIComponent(id)}${suffix}`;

export const listDocs = (s: DocSpec, q: DocQuery, opts?: RequestOptions): Promise<DocPage> =>
  get<DocPage>(`/${s.name}?${queryString(q)}`, opts);

export const getDoc = (s: DocSpec, id: string, opts?: RequestOptions): Promise<DocDetail> =>
  get<DocDetail>(at(s, id), opts);

/** Create a DRAFT. `items` must hold at least one line — the API refuses zero. */
export const createDoc = (s: DocSpec, body: Row & { items: Row[] }): Promise<DocDetail> =>
  post<DocDetail>(`/${s.name}`, body);

/** Partial header update. Fields marked noUpdate are rejected, not ignored. */
export const updateDocHeader = (s: DocSpec, id: string, body: Row): Promise<DocDetail> =>
  put<DocDetail>(at(s, id), body);

export const replaceDocItems = (s: DocSpec, id: string, items: Row[]): Promise<DocDetail> =>
  put<DocDetail>(at(s, id, "/items"), { items });

export const confirmDoc = (s: DocSpec, id: string): Promise<DocDetail> =>
  put<DocDetail>(at(s, id, "/confirm"));

/**
 * Run the posting procedure. This is the call that moves stock.
 *
 * Two conflicts are expected rather than exceptional and the screen has to
 * say which is which: `ALREADY_POSTED` means someone else got there first,
 * `INSUFFICIENT_STOCK` means the document cannot be honoured and — this is
 * the part worth trusting — no stock moved at all.
 */
export const postDoc = (s: DocSpec, id: string): Promise<DocDetail> =>
  put<DocDetail>(at(s, id, "/post"));

export const cancelDoc = (s: DocSpec, id: string): Promise<DocDetail> =>
  put<DocDetail>(at(s, id, "/cancel"));

/** Soft delete. The row stays, flagged is_delete=1 / id_status='DELETED'. */
export const deleteDoc = (s: DocSpec, id: string): Promise<null> => del<null>(at(s, id));
