/**
 * brand.ts — the Penbun logo lockup, shared by the sidebar and any other
 * surface that needs the brand (login aside, error pages use the static twin).
 */

import { esc } from "../core/format.js";

export function brandMarkup(meta = "WEB BETA 1.3.0"): string {
  return `
  <a class="pb-brand" href="/dashboard.html">
    <span class="pb-brand__mark">P</span>
    <span class="pb-brand__text">
      <span class="pb-brand__name">Penbun</span>
      <span class="pb-brand__meta">${esc(meta)}</span>
    </span>
  </a>`;
}
