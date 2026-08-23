/**
 * theme.ts — colour scheme controller.
 *
 * Pattern follows cookievirus/darkmode: the choice is written to
 * localStorage, applied to <html> as a class *and* as data-bs-theme
 * (so the markup stays compatible with Bootstrap/Phoenix-style CSS),
 * and re-applied before first paint by the inline boot snippet in
 * every page <head>.
 *
 * Three states: "light" | "dark" | "auto" (follows the OS).
 */

export type ThemeChoice = "light" | "dark" | "auto";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "penbun.theme";
const media = window.matchMedia("(prefers-color-scheme: dark)");

export function getChoice(): ThemeChoice {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === "light" || raw === "dark" || raw === "auto" ? raw : "auto";
}

export function resolve(choice: ThemeChoice = getChoice()): ResolvedTheme {
  if (choice === "auto") return media.matches ? "dark" : "light";
  return choice;
}

export function apply(choice: ThemeChoice): void {
  const resolved = resolve(choice);
  const root = document.documentElement;

  root.classList.toggle("dark", resolved === "dark");
  root.classList.toggle("light", resolved === "light");
  root.setAttribute("data-bs-theme", resolved);
  root.style.colorScheme = resolved;

  document.querySelectorAll<HTMLElement>("[data-theme-value]").forEach((el) => {
    el.setAttribute("aria-pressed", String(el.dataset.themeValue === choice));
  });
  document.querySelectorAll<HTMLElement>("[data-theme-icon]").forEach((el) => {
    el.dataset.themeIcon = resolved;
  });

  window.dispatchEvent(new CustomEvent<ResolvedTheme>("penbun:themechange", { detail: resolved }));
}

export function setChoice(choice: ThemeChoice): void {
  localStorage.setItem(STORAGE_KEY, choice);
  apply(choice);
}

/** Cycle order used by the topbar button: light → dark → auto → light. */
export function cycle(): ThemeChoice {
  const next: Record<ThemeChoice, ThemeChoice> = { light: "dark", dark: "auto", auto: "light" };
  const value = next[getChoice()];
  setChoice(value);
  return value;
}

export function initTheme(): void {
  apply(getChoice());
  media.addEventListener("change", () => {
    if (getChoice() === "auto") apply("auto");
  });
  // Keep tabs in sync.
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) apply(getChoice());
  });
}
