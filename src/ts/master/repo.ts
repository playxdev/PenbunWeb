/**
 * master/repo.ts — every master-data request, in one place.
 *
 * The five endpoints PenbunAPI mounts per resource
 * (`internal/crud/engine.go` → Mount):
 *
 *     GET    /{name}          list · search · filter · sort · page
 *     GET    /{name}/{id}     one row by business ID
 *     POST   /{name}          create
 *     PUT    /{name}/{id}     partial update
 *     DELETE /{name}/{id}     soft delete → 204
 *
 * `{id}` is always the business ID (`CUSA000041`), never `autoID` — the
 * resolver layer owns that translation and never exposes it.
 *
 * Sorting: `sort=name` ascending, `sort=-name` descending. Sending no `sort`
 * gives the resource's DefaultSort, descending. The keys are the ones in the
 * Go descriptor's SortColumns; anything else is a 400, so only keys that came
 * from a Column.sort are ever sent.
 */

import { del, get, post, put, type RequestOptions } from "../core/api.js";
import { MASTER_BY_NAME } from "./resources.js";
import type { MasterResource } from "./schema.js";

export type Row = Record<string, unknown>;

/** The `data` shape of every list endpoint (httpx.Page). */
export interface PageResult {
  items: Row[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface ListQuery {
  page: number;
  limit: number;
  /** Free-text search across the resource's SearchColumns. */
  q?: string;
  /** A key from Column.sort. */
  sort?: string;
  asc?: boolean;
  /** undefined = every row, true = active only, false = suspended only. */
  isActive?: boolean;
  /** Keyed by FilterDef.param. Empty strings are dropped. */
  filters?: Record<string, string>;
}

export const PAGE_SIZE = 25;

function queryString(r: MasterResource, q: ListQuery): string {
  const p = new URLSearchParams();
  p.set("page", String(q.page));
  p.set("limit", String(q.limit));
  if (q.q) p.set("q", q.q);
  if (q.sort) p.set("sort", q.asc ? q.sort : `-${q.sort}`);
  // vw_customer_route has no is_active column; filtering on it would ask the
  // database for something the view does not select.
  if (q.isActive !== undefined && r.audit !== false) p.set("is_active", String(q.isActive));
  for (const [k, v] of Object.entries(q.filters ?? {})) {
    if (v !== "") p.set(k, v);
  }
  return p.toString();
}

export function listRows(r: MasterResource, q: ListQuery, opts?: RequestOptions): Promise<PageResult> {
  return get<PageResult>(`/${r.name}?${queryString(r, q)}`, opts);
}

export const getRow = (r: MasterResource, id: string): Promise<Row> =>
  get<Row>(`/${r.name}/${encodeURIComponent(id)}`);

export const createRow = (r: MasterResource, body: Row): Promise<Row> => post<Row>(`/${r.name}`, body);

export const updateRow = (r: MasterResource, id: string, body: Row): Promise<Row> =>
  put<Row>(`/${r.name}/${encodeURIComponent(id)}`, body);

/** Soft delete. The row stays, flagged is_delete=1 / id_status='DELETED'. */
export const deleteRow = (r: MasterResource, id: string): Promise<null> =>
  del<null>(`/${r.name}/${encodeURIComponent(id)}`);

/* ------------------------------------------------------------- ref options */

export interface Option {
  value: string;
  label: string;
  meta: string;
}

/**
 * Cache keyed by `resource|search`.
 *
 * Reference tables change rarely and one form can ask for the same list
 * several times (the filter bar and the modal both want customer types).
 * The cache is per page load — a create in another tab is picked up on the
 * next reload, which is the right trade for a lookup table.
 */
const optionCache = new Map<string, Option[]>();

/** Invalidate one resource's options after a write to it. */
export function forgetOptions(name: string): void {
  for (const key of [...optionCache.keys()]) {
    if (key === name || key.startsWith(`${name}|`)) optionCache.delete(key);
  }
}

/**
 * Options for a <select> or a suggestion list.
 *
 * `search` is passed to the API rather than filtered here: the resource may
 * hold far more rows than one page, and a client-side filter over the first
 * 200 would hide the row the user is typing the name of.
 */
export async function options(name: string, search = ""): Promise<Option[]> {
  const target = MASTER_BY_NAME[name];
  if (!target) return [];

  const key = search ? `${name}|${search}` : name;
  const hit = optionCache.get(key);
  if (hit) return hit;

  const q: ListQuery = { page: 1, limit: search ? 20 : 200 };
  if (search && target.searchable !== false) q.q = search;
  if (target.audit !== false) q.isActive = true;
  if (target.defaultSort) {
    q.sort = target.defaultSort;
    q.asc = target.defaultAsc ?? false;
  }

  const res = await listRows(target, q);
  const metaKey = target.refMeta ?? target.idKey;
  const list = res.items.map((row) => ({
    value: String(row[target.idKey] ?? ""),
    label: String(row[target.titleKey] ?? row[target.idKey] ?? ""),
    meta: String(row[metaKey] ?? ""),
  }));
  optionCache.set(key, list);
  return list;
}
