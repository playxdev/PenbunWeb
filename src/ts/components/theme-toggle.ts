/**
 * theme-toggle.ts — the theme switch control, shared by the topbar and the
 * standalone pages (login / errors). This file owns both the icon rendering
 * and the wiring, so the light→dark→auto behaviour lives in exactly one place.
 */

import { icon } from "../core/icons.js";
import { cycle, getChoice, resolve, setChoice, type ThemeChoice } from "../core/theme.js";

/** Icon reflecting the current choice: monitor (auto), moon (dark), sun (light). */
export function themeIcon(): string {
  const c = getChoice();
  return c === "auto" ? icon("monitor") : resolve(c) === "dark" ? icon("moon") : icon("sun");
}

/** Markup for the round topbar-style toggle button (used inside the topbar). */
export function themeToggleMarkup(): string {
  return `<button class="pb-iconbtn" data-theme-toggle aria-label="สลับโหมดสีสว่าง/มืด" title="สลับโหมดสี">${themeIcon()}</button>`;
}

/**
 * Wire every theme control found in `scope`:
 *  - `[data-theme-toggle]` cycles light → dark → auto
 *  - `[data-theme-value]`  picks a choice directly (settings page)
 * Every toggle icon re-renders whenever the theme changes from ANY source,
 * including the `storage` event from another tab.
 */
export function wireThemeControls(scope: ParentNode = document): void {
  const refresh = (): void => {
    scope.querySelectorAll<HTMLElement>("[data-theme-toggle]").forEach((b) => {
      b.innerHTML = themeIcon();
    });
  };

  refresh();

  scope.querySelectorAll<HTMLElement>("[data-theme-toggle]").forEach((b) =>
    b.addEventListener("click", () => cycle())
  );
  scope.querySelectorAll<HTMLElement>("[data-theme-value]").forEach((b) =>
    b.addEventListener("click", () => setChoice(b.dataset.themeValue as ThemeChoice))
  );

  window.addEventListener("penbun:themechange", refresh);
  window.addEventListener("storage", (e) => {
    if (e.key === "penbun.theme") refresh();
  });
}
