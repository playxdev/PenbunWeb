/**
 * charts.ts — hand-rolled SVG charts. No Chart.js, no D3, no runtime deps.
 * Everything is theme-aware because colours come from CSS custom properties
 * via classes defined in 05-pages.css.
 */

export interface Series {
  name: string;
  values: number[];
  variant?: "brand" | "pos" | "muted";
}

interface AreaOptions {
  labels: string[];
  series: Series[];
  height?: number;
  width?: number;
  fmt?: (v: number) => string;
}

const VAR: Record<string, string> = {
  brand: "var(--pb-brand)",
  pos: "var(--pb-pos)",
  muted: "var(--pb-border-strong)",
};

/** Catmull-Rom → cubic bezier, so the line reads as a trend, not a zigzag. */
function smoothPath(pts: Array<[number, number]>): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

export function renderArea(host: HTMLElement, opts: AreaOptions): void {
  const w = opts.width ?? 760;
  const h = opts.height ?? 280;
  const pad = { t: 16, r: 12, b: 28, l: 46 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;

  const all = opts.series.flatMap((s) => s.values);
  if (!all.length || !opts.labels.length) {
    host.innerHTML = "";
    return;
  }
  const max = Math.max(...all) * 1.12;
  const min = 0;
  const x = (i: number, n: number) => pad.l + (iw * i) / Math.max(1, n - 1);
  const y = (v: number) => pad.t + ih - ((v - min) / (max - min)) * ih;
  const fmt = opts.fmt ?? ((v: number) => v.toLocaleString("th-TH", { notation: "compact" }));

  const ticks = 4;
  let grid = "";
  for (let i = 0; i <= ticks; i++) {
    const v = min + ((max - min) * i) / ticks;
    const gy = y(v);
    grid += `<line class="pb-chart__grid" x1="${pad.l}" y1="${gy.toFixed(1)}" x2="${w - pad.r}" y2="${gy.toFixed(
      1
    )}" stroke-dasharray="${i === 0 ? "0" : "3 5"}"/>
      <text class="pb-chart__axis" x="${pad.l - 8}" y="${(gy + 3).toFixed(1)}" text-anchor="end">${fmt(v)}</text>`;
  }

  const axis = opts.labels
    .map((l, i) => {
      const step = Math.ceil(opts.labels.length / 12);
      if (i % step !== 0) return "";
      return `<text class="pb-chart__axis" x="${x(i, opts.labels.length).toFixed(1)}" y="${
        h - 8
      }" text-anchor="middle">${l}</text>`;
    })
    .join("");

  const paths = opts.series
    .map((s) => {
      if (!s.values.length) return "";
      const pts = s.values.map((v, i) => [x(i, s.values.length), y(v)] as [number, number]);
      const line = smoothPath(pts);
      const variant = s.variant ?? "brand";
      const area =
        variant === "brand"
          ? `<path d="${line} L ${pts[pts.length - 1][0]} ${pad.t + ih} L ${pts[0][0]} ${
              pad.t + ih
            } Z" fill="url(#pbAreaBrand)"/>`
          : "";
      const last = pts[pts.length - 1];
      return `${area}<path class="pb-chart__line" d="${line}" stroke="${VAR[variant]}" ${
        variant === "muted" ? 'stroke-dasharray="5 5"' : ""
      }/>
      <circle class="pb-chart__dot" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4" stroke="${
        VAR[variant]
      }"/>`;
    })
    .join("");

  host.innerHTML = `
  <svg class="pb-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img"
       aria-label="กราฟแนวโน้ม ${opts.series.map((s) => s.name).join(" และ ")}">
    <defs>
      <linearGradient id="pbAreaBrand" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--pb-brand)" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="var(--pb-brand)" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${grid}${axis}${paths}
  </svg>`;
}

export interface Slice {
  label: string;
  value: number;
  color: string;
}

export function renderDonut(host: HTMLElement, slices: Slice[], centerLabel: string): void {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const r = 54;
  const c = 2 * Math.PI * r;
  const safe = total > 0;
  let offset = 0;

  const rings = !safe
    ? ""
    : slices
        .map((s) => {
          const frac = s.value / total;
          const seg = `<circle cx="74" cy="74" r="${r}" fill="none" stroke="${s.color}" stroke-width="16"
        stroke-dasharray="${(c * frac - 2).toFixed(2)} ${(c * (1 - frac) + 2).toFixed(2)}"
        stroke-dashoffset="${(-c * offset).toFixed(2)}" stroke-linecap="round"
        transform="rotate(-90 74 74)"><title>${s.label}</title></circle>`;
          offset += frac;
          return seg;
        })
        .join("");

  host.innerHTML = `
  <svg class="pb-donut__svg" viewBox="0 0 148 148" role="img" aria-label="${centerLabel}">
    <circle cx="74" cy="74" r="${r}" fill="none" stroke="var(--pb-surface-3)" stroke-width="16"/>
    ${rings}
    <text class="pb-donut__center" x="74" y="72" text-anchor="middle">${total.toLocaleString("th-TH")}</text>
    <text class="pb-donut__center-label" x="74" y="88" text-anchor="middle">${centerLabel.toUpperCase()}</text>
  </svg>`;
}

export function renderSparkline(host: HTMLElement, values: number[], variant: keyof typeof VAR = "brand"): void {
  const w = 120;
  const h = 34;
  if (values.length < 2) {
    host.innerHTML = "";
    return;
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  const pts = values.map(
    (v, i) => [ (w * i) / (values.length - 1), h - 3 - ((v - min) / Math.max(1, max - min)) * (h - 6) ] as [number, number]
  );
  host.innerHTML = `<svg viewBox="0 0 ${w} ${h}" style="width:${w}px;height:${h}px" aria-hidden="true">
    <path class="pb-chart__line" d="${smoothPath(pts)}" stroke="${VAR[variant]}" stroke-width="2"/>
  </svg>`;
}
