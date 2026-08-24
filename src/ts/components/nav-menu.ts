/**
 * nav-menu.ts — renders the vertical navigation from nav.ts.
 * The menu data itself lives in core/nav.ts; this file only turns it into
 * markup, so both sidebar and any future surface reuse the same source.
 */

import { NAV } from "../core/nav.js";
import { icon } from "../core/icons.js";
import { esc } from "../core/format.js";

export function navMenuMarkup(active: string): string {
  return NAV.map(
    (group) => `
    <div class="pb-nav__group">
      <div class="pb-nav__label">${esc(group.label)}</div>
      ${group.items
        .map((item) => {
          const current = item.id === active;
          const badge = item.count
            ? `<span class="pb-nav__count${item.alert ? " pb-nav__count--alert" : ""}">${item.count}</span>`
            : "";
          return `<a class="pb-nav__link" href="${item.href}"${current ? ' aria-current="page"' : ""} title="${esc(
            item.label
          )}">
            ${icon(item.icon, "pb-nav__icon")}
            <span class="pb-nav__text">${esc(item.label)}</span>${badge}
          </a>`;
        })
        .join("")}
    </div>`
  ).join("");
}
