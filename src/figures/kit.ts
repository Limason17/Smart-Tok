// Building blocks for card figures. Every figure is a small SVG string built from these,
// so a new figure is a short description instead of hand-drawn path data.
// Colours come from CSS tokens, so figures follow the theme and the card's area colour.

const COLORS: Record<string, string> = {
  area: 'var(--area-ink)',
  soft: 'var(--area-soft)',
  warm: 'var(--fig-warm)',
  cold: 'var(--fig-cold)',
  sun: 'var(--fig-sun)',
  text: 'var(--text)',
  t2: 'var(--text-2)',
  t3: 'var(--text-3)',
  accent: 'var(--accent)',
  line: 'var(--line)',
  card: 'var(--card)',
  card2: 'var(--card-2)',
};

export const col = (c: string) => COLORS[c] ?? c;
/** Mixes two colours, e.g. mix('warm', 'cold', 60). */
export const mix = (a: string, b: string, pct: number) => `color-mix(in srgb, ${col(a)} ${pct}%, ${col(b)})`;
export const r1 = (n: number) => Math.round(n * 10) / 10;

export const svg = (w: number, h: number, inner: string, label: string) =>
  `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">${inner}</svg>`;

export interface TextOpts {
  /** text-anchor: start (default), middle or end */
  a?: 'middle' | 'end';
  /** class: b = bold, s = small, h = heading, n = no halo */
  k?: string;
  c?: string;
}
export const txt = (x: number, y: number, s: string | number, o: TextOpts = {}) =>
  `<text x="${r1(x)}" y="${r1(y)}"${o.a ? ` text-anchor="${o.a}"` : ''}${o.k ? ` class="${o.k}"` : ''}${o.c ? ` style="fill:${col(o.c)}"` : ''}>${s}</text>`;

export const ln = (x1: number, y1: number, x2: number, y2: number, c = 't3', w = 1, dash = '') =>
  `<line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" stroke="${col(c)}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;

export const pth = (d: string, c: string, w = 2, extra = '') =>
  `<path d="${d}" fill="none" stroke="${col(c)}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra ? ` ${extra}` : ''}/>`;

export const dot = (x: number, y: number, c: string, r = 4) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r}" fill="${col(c)}"/>`;

export const box = (x: number, y: number, w: number, h: number, fill: string, rx = 4, extra = '') =>
  `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="${rx}" fill="${col(fill)}"${extra ? ` ${extra}` : ''}/>`;

/** Path data for y = f(t) between a and b, mapped through the scales X and Y. */
export function plot(f: (t: number) => number, a: number, b: number, X: (t: number) => number, Y: (v: number) => number, n = 90) {
  let d = '';
  for (let i = 0; i <= n; i++) {
    const t = a + ((b - a) * i) / n;
    d += `${i ? 'L' : 'M'}${r1(X(t))} ${r1(Y(f(t)))}`;
  }
  return d;
}

/** Arrowhead at (x, y) pointing in direction deg (0 = right, 90 = down). */
export const chev = (x: number, y: number, deg: number, c: string, s = 6) =>
  `<g transform="translate(${x} ${y}) rotate(${deg})">${pth(`M${-s} ${-s} L0 0 L${-s} ${s}`, c, 2.5)}</g>`;

/** Straight arrow from (x1, y1) to (x2, y2). */
export const arrow = (x1: number, y1: number, x2: number, y2: number, c = 't3', w = 2) =>
  ln(x1, y1, x2, y2, c, w) + chev(x2, y2, (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI, c, 5);

/** Wavy heat arrow starting at (x, y), pointing right (dir 1) or left (dir -1). */
export const heat = (x: number, y: number, dir: 1 | -1, c = 'warm') =>
  pth(`M${x} ${y} q${4 * dir} -4 ${8 * dir} 0 t${8 * dir} 0 t${8 * dir} 0 m${-4 * dir} -4 l${4 * dir} 4 l${-4 * dir} 4`, c, 1.8);

export const satellite = (x: number, y: number, c: string, label: string, delay = 0) =>
  `<circle class="fig-pulse" style="animation-delay:${delay}s" cx="${x}" cy="${y}" r="10" fill="none" stroke="${col(c)}" stroke-width="1.5"/>` +
  `<g transform="translate(${x} ${y}) rotate(-20)">${box(-5, -5, 10, 10, c, 2)}${box(-17, -3.5, 10, 7, c, 1, 'opacity=".55"')}${box(7, -3.5, 10, 7, c, 1, 'opacity=".55"')}</g>` +
  txt(x, y - 15, label, { a: 'middle', c, k: 'b' });

export const person = (x: number, y: number, c = 'text') => dot(x, y - 12, c, 3) + pth(`M${x} ${y - 8} V${y}`, c, 2.2);

export const padlock = (x: number, y: number, c: string, open = false) =>
  pth(open ? `M${x - 7} ${y - 6} V${y - 14} A7 7 0 0 1 ${x + 7} ${y - 14} V${y - 11}` : `M${x - 7} ${y} V${y - 8} A7 7 0 0 1 ${x + 7} ${y - 8} V${y}`, c, 3) +
  box(x - 11, y - 1, 22, 17, c, 3) +
  dot(x, y + 7, 'card', 2.2);

export const key = (x: number, y: number, c: string) =>
  `<circle cx="${x - 10}" cy="${y}" r="7" fill="none" stroke="${col(c)}" stroke-width="3"/>` + pth(`M${x - 3} ${y} H${x + 16} M${x + 10} ${y} v6 M${x + 15} ${y} v5`, c, 3);

export interface Series {
  f: (t: number) => number;
  c?: string;
  w?: number;
  /** Shades the area under the line. */
  fill?: boolean;
  /** Label at the end of the line. */
  end?: string;
  /** Label along the line at t, shifted by dy. */
  tag?: { t: number; dy: number; text: string };
}

export interface ChartOpts {
  w?: number;
  h?: number;
  /** Margins: left, right, top, bottom. */
  l?: number;
  r?: number;
  t?: number;
  b?: number;
  x: [number, number];
  y: [number, number];
  /** Axis labels; an object colours one. */
  xt?: (number | { v: number; c: string })[];
  yt?: number[];
  xl?: string;
  yl?: string;
  /** Dashed reference lines. */
  hl?: { v: number; label?: string }[];
  series: Series[];
  marks?: { x: number; y: number; c: string; label?: string; dy?: number; drop?: boolean; dash?: string }[];
  extra?: (s: { X: (v: number) => number; Y: (v: number) => number; L: number; R: number; T: number; B: number }) => string;
  aria: string;
}

/** Line chart. Lines come from formulas; ticks, marks and labels share one scale. No grid, labels sit on the lines. */
export function chart(o: ChartOpts) {
  const W = o.w ?? 320;
  const H = o.h ?? 200;
  const L = o.l ?? 40;
  const R = W - (o.r ?? 46);
  const T = o.t ?? 24;
  const B = H - (o.b ?? 36);
  const X = (v: number) => L + ((v - o.x[0]) / (o.x[1] - o.x[0])) * (R - L);
  const Y = (v: number) => B - ((v - o.y[0]) / (o.y[1] - o.y[0])) * (B - T);
  let g = '';
  for (const v of o.yt ?? []) g += txt(L - 6, Y(v) + 4, v, { a: 'end' });
  g += ln(L, B, R, B, 't3');
  for (const t of o.xt ?? []) {
    const { v, c } = typeof t === 'number' ? { v: t, c: undefined } : t;
    g += txt(X(v), B + 15, v, { a: 'middle', c, k: c ? 'b' : undefined });
  }
  if (o.xl) g += txt((L + R) / 2, B + 29, o.xl, { a: 'middle', k: 's' });
  if (o.yl) g += txt(L, T - 11, o.yl, { k: 's' });
  for (const h of o.hl ?? []) g += ln(L, Y(h.v), R, Y(h.v), 't3', 1, '3 4') + (h.label ? txt(L + 4, Y(h.v) - 5, h.label, { k: 's' }) : '');
  for (const s of o.series) {
    const c = s.c ?? 'area';
    const d = plot(s.f, o.x[0], o.x[1], X, Y);
    if (s.fill) g += `<path d="${d} L${R} ${B} L${L} ${B}Z" fill="${col(c)}" opacity=".12"/>`;
    g += pth(d, c, s.w ?? 2.6);
    if (s.end) {
      const v = s.f(o.x[1]);
      g += dot(R, Y(v), c, 3.5) + txt(R + 7, Y(v) + 4, s.end, { c, k: 'b' });
    }
    if (s.tag) g += txt(X(s.tag.t), Y(s.f(s.tag.t)) + s.tag.dy, s.tag.text, { c, k: 'b' });
  }
  for (const m of o.marks ?? []) {
    const x = X(m.x);
    const y = Y(m.y);
    if (m.drop) g += ln(x, B, x, y, m.c, 1.5, m.dash ?? '');
    g += dot(x, y, m.c) + (m.label ? txt(x, y + (m.dy ?? -10), m.label, { a: 'middle', c: m.c, k: 'b' }) : '');
  }
  if (o.extra) g += o.extra({ X, Y, L, R, T, B });
  return svg(W, H, g, o.aria);
}
