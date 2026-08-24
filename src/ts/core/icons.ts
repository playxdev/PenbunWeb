/**
 * icons.ts — the whole icon set, inline. No sprite request, no icon font.
 * 24x24 grid, 1.75 stroke, currentColor.
 */

const P: Record<string, string> = {
  dashboard:
    '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20v5H6.5A2.5 2.5 0 0 1 4 19.5z"/>',
  boxes:
    '<path d="M3 8.5 12 4l9 4.5-9 4.5z"/><path d="M3 8.5v7L12 20l9-4.5v-7"/><path d="M12 13v7"/>',
  ledger:
    '<path d="M4 4h13l3 3v13H4z"/><path d="M8 9h8"/><path d="M8 13h8"/><path d="M8 17h5"/>',
  truck:
    '<path d="M2 6h11v10H2z"/><path d="M13 9h4l3 3.5V16h-7z"/><circle cx="6.5" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  handshake:
    '<path d="M12 7 9.5 9.5a2 2 0 0 0 0 3l1 1a2 2 0 0 0 3 0L16 11"/><path d="M3 8h4l3 3"/><path d="M21 8h-4l-5-2-3 1"/><path d="M14 12l3 3"/>',
  users:
    '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.5a3 3 0 0 1 0 5.8"/><path d="M18 20a5.5 5.5 0 0 0-3-4.9"/>',
  store:
    '<path d="M4 9h16v11H4z"/><path d="M3 9l1.5-5h15L21 9"/><path d="M9 20v-6h6v6"/>',
  chart:
    '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15l4-5 3 3 4-6"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 14a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7l-.1-.1a2 2 0 1 1 2.8-2.8L7.4 4A1.6 1.6 0 0 0 10 3V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.1 2.1"/>',
  shield:
    '<path d="M12 3l7 3v6c0 4.2-2.9 7.7-7 9-4.1-1.3-7-4.8-7-9V6z"/><path d="M9.5 12l1.8 1.8 3.4-3.6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  bell: '<path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  menu: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
  panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.9 4.9l1.4 1.4"/><path d="M17.7 17.7l1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M4.9 19.1l1.4-1.4"/><path d="M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8"/><path d="M12 16v4"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  download: '<path d="M12 4v11"/><path d="M8 11l4 4 4-4"/><path d="M5 19h14"/>',
  filter: '<path d="M4 5h16l-6 7v6l-4 2v-8z"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  chevronRight: '<path d="M9 6l6 6-6 6"/>',
  arrowUp: '<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/>',
  arrowDown: '<path d="M12 5v14"/><path d="M6 13l6 6 6-6"/>',
  arrowRight: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/>',
  logout: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  x: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
  alert: '<path d="M12 3l9.5 17H2.5z"/><path d="M12 10v4"/><path d="M12 17.5v.2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8v.2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  inbox: '<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/>',
  refresh: '<path d="M20 11A8 8 0 0 0 6 6.5L4 8.5"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14 4.5l2-2"/><path d="M20 20v-5h-5"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  tag: '<path d="M3 12V4h8l9 9-8 8z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
  warehouse: '<path d="M3 21V9l9-5 9 5v12"/><path d="M8 21v-7h8v7"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="17" cy="14.5" r="1.2"/>',
  history: '<path d="M4 11a8 8 0 1 1 2.5 6"/><path d="M4 5v5h5"/><path d="M12 8v4.5l3 1.8"/>',
  swap: '<path d="M7 7h11l-3-3"/><path d="M17 17H6l3 3"/>',
  home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10.5V20h12v-9.5"/>',
  apps: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.4 9a2.6 2.6 0 0 1 5.2.4c0 1.7-2.6 2.3-2.6 3.8"/><path d="M12 17v.2"/>',
};

export type IconName = keyof typeof P | string;

export function icon(name: IconName, cls = ""): string {
  const d = P[name] ?? P.info;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${
    cls ? ` class="${cls}"` : ""
  }>${d}</svg>`;
}

export const iconNames = Object.keys(P);
