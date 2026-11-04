// Figure kit: draws common explainer figures from a short JSON spec (content/figures/<name>.json),
// so a new figure is a few lines of data instead of a hand-written drawing, and all figures share one look.
// `npm run figures` writes content/figures/<name>.svg; the validator checks that the SVG is up to date.
// Every label is "Deutsch|English" (without "|" the same text is used for both).
// Hand-drawn SVGs (no .json next to them) stay possible for figures no template fits.

type L = string;

interface Box {
  /** Main label. */
  t: L;
  /** Small second line. */
  s?: L;
  /** A number or value, shown large between t and s. */
  v?: string;
  /** Highlight in the topic colour. */
  acc?: boolean;
  /** Rounded pill instead of a box (a process, not a thing). */
  pill?: boolean;
  /** Monospace (codes, hashes). */
  mono?: boolean;
}

export type FigureSpec =
  | { type: 'flow'; steps: (Box | { pair: [Box, Box]; note?: L })[]; fork?: { label: L; box: Box }[] }
  | { type: 'chain'; rows: { label?: L; items: Box[] }[]; between?: L; footer?: L[] }
  | { type: 'compare'; title?: L; cols: { head: L; items: Box[] }[]; badge?: { col: number; t: L }; footer?: L[] }
  | { type: 'bars'; title?: L; items: { t: L; v: number; show: L; acc?: boolean }[]; footer?: L[] }
  | { type: 'timeline'; items: { d: L; t: L; acc?: boolean }[] }
  | {
      type: 'curve';
      /** Points 0..1 in x (time) and y (up = more). */
      points: [number, number][];
      base?: number;
      baseLabel?: L;
      band?: { from: number; to: number; label: L };
      ticks?: { x: number; t: L }[];
      notes?: { x: number; y: number; t: L; strong?: boolean; anchor?: 'start' | 'middle' | 'end' }[];
      marks?: number[];
    };

const W = 360;
const FS = 12.5;
const FS_S = 10.5;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const split = (l: L): [string, string] => {
  const i = l.indexOf('|');
  return i < 0 ? [l, l] : [l.slice(0, i), l.slice(i + 1)];
};
/** Rough text width for Inter: good enough to wrap and centre labels. */
const width = (s: string, fs: number, bold = false) => s.length * fs * (bold ? 0.57 : 0.52);

/** Splits text into n lines of similar length at word breaks. */
function lines(text: string, n: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (n <= 1 || words.length <= 1) return [text];
  const out: string[] = [];
  let rest = words;
  for (let k = n; k > 1; k--) {
    const target = rest.join(' ').length / k;
    let take = 1;
    while (take < rest.length - (k - 1) && rest.slice(0, take + 1).join(' ').length <= target + 3) take++;
    out.push(rest.slice(0, take).join(' '));
    rest = rest.slice(take);
  }
  out.push(rest.join(' '));
  return out;
}

/** A label that wraps to fit maxW; German and English get the same number of lines. Returns svg and height. */
function label(l: L, x: number, y: number, o: { fs?: number; cls?: string; anchor?: string; maxW?: number; bold?: boolean } = {}) {
  const fs = o.fs ?? FS;
  const [de, en] = split(l);
  const maxW = o.maxW ?? W;
  const need = Math.max(width(de, fs, o.bold), width(en, fs, o.bold));
  const n = Math.min(Math.ceil(need / maxW), de.split(' ').length, en.split(' ').length, 3) || 1;
  const d = lines(de, n);
  const e = lines(en, n);
  const lh = fs * 1.25;
  const cls = [o.cls, fs === FS_S ? 't-s' : ''].filter(Boolean).join(' ');
  const attrs = `x="${x}" text-anchor="${o.anchor ?? 'middle'}"${cls ? ` class="${cls}"` : ''}`;
  const svg = d
    .map((line, i) => `<text ${attrs} y="${(y + i * lh).toFixed(1)}" data-en="${esc(e[i] ?? '')}">${esc(line)}</text>`)
    .join('');
  return { svg, h: (d.length - 1) * lh + fs };
}

const ARROW = `<defs><marker id="a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path class="fg-fill-ink" d="M0,0 L10,5 L0,10 z"/></marker><marker id="b" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path class="fg-fill-acc" d="M0,0 L10,5 L0,10 z"/></marker></defs>`;
const arrow = (d: string, acc = false) => `<path class="${acc ? 'fg-acc' : 'fg-ink'}" d="${d}" marker-end="url(#${acc ? 'b' : 'a'})"/>`;

/** A box with its labels, centred on cx. */
function box(b: Box, cx: number, y: number, w: number): { svg: string; h: number } {
  const pad = 9;
  const maxW = w - 2 * pad;
  // lines of the box: title, optional value, optional small text; measured first, then placed
  const parts: { l: L; fs: number; cls: string; bold?: boolean }[] = [{ l: b.t, fs: FS, cls: b.acc ? 't-acc' : 't-strong', bold: true }];
  if (b.v) parts.push({ l: b.v, fs: 15, cls: 't-strong t-l', bold: true });
  if (b.s) parts.push({ l: b.s, fs: FS_S, cls: 't-mute' });
  const sizes = parts.map((p) => label(p.l, cx, 0, { fs: p.fs, maxW, bold: p.bold }).h);
  const inner = sizes.reduce((a, c) => a + c, 0) + 5 * (parts.length - 1);
  const h = Math.max(b.pill ? 34 : 38, pad * 2 + inner);
  let ty = y + (h - inner) / 2;
  let text = '';
  parts.forEach((p, i) => {
    text += label(p.l, cx, ty + p.fs * 0.82, { fs: p.fs, maxW, bold: p.bold, cls: p.cls }).svg;
    ty += sizes[i] + 5;
  });
  const cls = b.acc ? 'fg-fill-soft fg-acc' : 'fg-fill-card';
  const rect = `<rect class="${cls}" x="${cx - w / 2}" y="${y}" width="${w}" height="${h.toFixed(1)}" rx="${b.pill ? h / 2 : 10}"/>`;
  if (b.mono) text = text.replace(/<text /g, '<text font-family="ui-monospace, monospace" ');
  return { svg: rect + text, h };
}

function footer(ls: L[] | undefined, y: number) {
  let out = '';
  for (const l of ls ?? []) {
    const f = label(l, W / 2, y + FS_S, { fs: FS_S, cls: 't-mute', maxW: W - 20 });
    out += f.svg;
    y += f.h + 4;
  }
  return { svg: out, y };
}

function flow(spec: Extract<FigureSpec, { type: 'flow' }>) {
  const cx = W / 2;
  const bw = 230;
  let y = 4;
  let out = '';
  spec.steps.forEach((step, i) => {
    if (i) {
      out += arrow(`M${cx},${y} L${cx},${y + 16}`);
      y += 20;
    }
    if ('pair' in step) {
      const w = (bw - 34) / 2;
      const a = box(step.pair[0], cx - 17 - w / 2, y, w);
      const b = box(step.pair[1], cx + 17 + w / 2, y, w);
      const h = Math.max(a.h, b.h);
      out += a.svg + b.svg;
      out += arrow(`M${cx - 15},${y + h / 2 - 5} L${cx + 13},${y + h / 2 - 5}`, true) + arrow(`M${cx + 15},${y + h / 2 + 5} L${cx - 13},${y + h / 2 + 5}`, true);
      y += h;
      if (step.note) {
        const n = label(step.note, cx, y + 15, { fs: FS_S, cls: 't-mute', maxW: W - 40 });
        out += n.svg;
        y += n.h + 8;
      }
    } else {
      const b = box(step, cx, y, bw);
      out += b.svg;
      y += b.h;
    }
  });
  if (spec.fork?.length) {
    const n = spec.fork.length;
    const fw = (W - 16 - (n - 1) * 12) / n;
    const top = y;
    y += 46;
    let maxH = 0;
    spec.fork.forEach((f, i) => {
      const fx = 8 + fw / 2 + i * (fw + 12);
      out += arrow(`M${cx},${top} C${cx},${top + 22} ${fx},${top + 18} ${fx},${y - 4}`, !!f.box.acc);
      out += label(f.label, fx + (fx < cx ? -10 : 10), top + 34, { fs: FS_S, cls: 't-acc', anchor: fx < cx ? 'end' : 'start' }).svg;
      const b = box(f.box, fx, y, fw);
      out += b.svg;
      maxH = Math.max(maxH, b.h);
    });
    y += maxH;
  }
  return { svg: out, h: y + 4 };
}

function chain(spec: Extract<FigureSpec, { type: 'chain' }>) {
  let y = 2;
  let out = '';
  spec.rows.forEach((row, ri) => {
    if (ri && spec.between) {
      const b = box({ t: spec.between, acc: true, pill: true }, W / 2, y + 4, 230);
      out += b.svg;
      y += b.h + 14;
    }
    if (row.label) {
      out += label(row.label, 4, y + FS_S, { fs: FS_S, cls: 't-acc', anchor: 'start' }).svg;
      y += FS_S + 8;
    }
    const n = row.items.length;
    const gap = 26;
    const w = (W - 8 - gap * (n - 1)) / n;
    const cx = (i: number) => 4 + w / 2 + i * (w + gap);
    const h = Math.max(...row.items.map((it, i) => box(it, cx(i), y, w).h));
    // shorter boxes sit centred on the arrow line
    const boxes = row.items.map((it, i) => box(it, cx(i), y + (h - box(it, cx(i), y, w).h) / 2, w));
    boxes.forEach((b, i) => {
      out += b.svg;
      if (i < n - 1) out += arrow(`M${4 + (i + 1) * w + i * gap + 3},${y + h / 2} L${4 + (i + 1) * (w + gap) - 4},${y + h / 2}`);
    });
    y += h + 12;
  });
  const f = footer(spec.footer, y + 4);
  return { svg: out + f.svg, h: f.y };
}

function compare(spec: Extract<FigureSpec, { type: 'compare' }>) {
  let y = 2;
  let out = '';
  if (spec.title) {
    out += label(spec.title, W / 2, y + FS, { cls: 't-strong', bold: true }).svg;
    y += FS + 10;
  }
  const n = spec.cols.length;
  const cw = (W - 8) / n;
  out += `<line class="fg-ink" x1="4" y1="${y}" x2="${W - 4}" y2="${y}"/>`;
  const top = y;
  y += 8;
  let colEnd = y;
  spec.cols.forEach((c, i) => {
    const cx = 4 + cw * (i + 0.5);
    let cy = y;
    const hd = label(c.head, cx, cy + FS_S, { fs: FS_S, cls: 't-mute', maxW: cw - 16 });
    out += hd.svg;
    cy += hd.h + 10;
    for (const it of c.items) {
      const b = box(it, cx, cy, cw - 16);
      out += b.svg;
      cy += b.h + 8;
    }
    if (spec.badge?.col === i) {
      const b = box({ t: spec.badge.t, acc: true, pill: true }, cx, cy + 2, Math.min(cw - 40, 120));
      out += b.svg.replace(/t-acc/g, 't-acc t-s');
      cy += b.h + 4;
    }
    colEnd = Math.max(colEnd, cy);
  });
  for (let i = 1; i < n; i++) out += `<line class="fg-ink" x1="${4 + cw * i}" y1="${top}" x2="${4 + cw * i}" y2="${colEnd}"/>`;
  const f = footer(spec.footer, colEnd + 10);
  return { svg: out + f.svg, h: f.y };
}

function bars(spec: Extract<FigureSpec, { type: 'bars' }>) {
  let y = 2;
  let out = '';
  if (spec.title) {
    out += label(spec.title, 4, y + FS, { cls: 't-strong', anchor: 'start', bold: true }).svg;
    y += FS + 12;
  }
  const max = Math.max(...spec.items.map((i) => i.v));
  for (const it of spec.items) {
    out += label(it.t, 4, y + FS_S, { fs: FS_S, anchor: 'start', maxW: W - 8 }).svg;
    y += FS_S + 5;
    const w = Math.max(4, ((W - 80) * it.v) / max);
    out += `<rect class="${it.acc ? 'fg-fill-acc' : 'fg-fill-ink'}" x="4" y="${y}" width="${w.toFixed(1)}" height="14" rx="4"${it.acc ? '' : ' opacity="0.55"'}/>`;
    const [sd, se] = split(it.show);
    out += `<text x="${(w + 10).toFixed(1)}" y="${y + 11}" class="${it.acc ? 't-acc' : 't-strong'} t-s" data-en="${esc(se)}">${esc(sd)}</text>`;
    y += 26;
  }
  const f = footer(spec.footer, y);
  return { svg: out + f.svg, h: f.y };
}

function timeline(spec: Extract<FigureSpec, { type: 'timeline' }>) {
  let y = 6;
  let out = '';
  const x = 74;
  const rows: string[] = [];
  for (const it of spec.items) {
    const d = label(it.d, x - 14, y + FS, { anchor: 'end', cls: it.acc ? 't-acc' : 't-strong', bold: true, maxW: 60 });
    const t = label(it.t, x + 16, y + FS, { anchor: 'start', maxW: W - x - 24, cls: it.acc ? 't-strong' : '' });
    rows.push(`<circle class="${it.acc ? 'fg-fill-acc' : 'fg-fill-bg fg-acc'}" cx="${x}" cy="${y + FS * 0.62}" r="5"/>` + d.svg + t.svg);
    y += Math.max(d.h, t.h) + 16;
  }
  out += `<line class="fg-line" x1="${x}" y1="10" x2="${x}" y2="${y - 20}"/>` + rows.join('');
  return { svg: out, h: y - 8 };
}

function curve(spec: Extract<FigureSpec, { type: 'curve' }>) {
  const L0 = 8;
  const R = W - 8;
  const T = 52;
  const B = 170;
  const px = (x: number) => L0 + x * (R - L0);
  const py = (v: number) => B - v * (B - T);
  let out = '';
  if (spec.band) {
    out += `<rect class="fg-fill-soft" x="${px(spec.band.from)}" y="2" width="${px(spec.band.to) - px(spec.band.from)}" height="${B - 2}" rx="8"/>`;
    out += label(spec.band.label, (px(spec.band.from) + px(spec.band.to)) / 2, 17, { fs: FS_S, cls: 't-acc', maxW: px(spec.band.to) - px(spec.band.from) - 12 }).svg;
  }
  out += `<line class="fg-line" x1="${L0}" y1="${B}" x2="${R}" y2="${B}"/>`;
  if (spec.base !== undefined) {
    out += `<line class="fg-line fg-dash" x1="${L0}" y1="${py(spec.base)}" x2="${R}" y2="${py(spec.base)}"/>`;
    if (spec.baseLabel) out += label(spec.baseLabel, R, py(spec.base) - 6, { fs: FS_S, cls: 't-mute', anchor: 'end' }).svg;
  }
  // smooth line through the points (Catmull-Rom as cubic Béziers)
  const p = spec.points.map(([x, v]) => [px(x), py(v)]);
  let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const [a, b, c, e] = [p[i - 1] ?? p[i], p[i], p[i + 1], p[i + 2] ?? p[i + 1]];
    const c1 = [b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6];
    const c2 = [c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6];
    d += ` C${c1.map((v) => v.toFixed(1)).join(',')} ${c2.map((v) => v.toFixed(1)).join(',')} ${c[0].toFixed(1)},${c[1].toFixed(1)}`;
  }
  out += `<path class="fg-acc" stroke-width="2.5" stroke-linecap="round" d="${d}"/>`;
  for (const i of spec.marks ?? []) out += `<circle class="fg-fill-acc" cx="${p[i][0].toFixed(1)}" cy="${p[i][1].toFixed(1)}" r="5"/>`;
  let h = B + 8;
  for (const t of spec.ticks ?? []) {
    const x = px(t.x);
    out += `<line class="fg-line" x1="${x}" y1="${B - 4}" x2="${x}" y2="${B + 4}"/>`;
    const anchor = t.x <= 0.02 ? 'start' : t.x >= 0.98 ? 'end' : 'middle';
    const lb = label(t.t, x, B + 18, { fs: FS_S, anchor, maxW: 90 });
    out += lb.svg;
    h = Math.max(h, B + 18 + lb.h);
  }
  for (const n of spec.notes ?? []) {
    out += label(n.t, px(n.x), py(n.y), { fs: n.strong ? FS : FS_S, cls: n.strong ? 't-strong' : 't-mute', anchor: n.anchor ?? 'middle', bold: n.strong, maxW: 150 }).svg;
  }
  return { svg: out, h: h + 4 };
}

export function renderFigure(spec: FigureSpec, source: string): string {
  const r =
    spec.type === 'flow' ? flow(spec)
    : spec.type === 'chain' ? chain(spec)
    : spec.type === 'compare' ? compare(spec)
    : spec.type === 'bars' ? bars(spec)
    : spec.type === 'timeline' ? timeline(spec)
    : curve(spec);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Math.ceil(r.h)}" aria-hidden="true">\n<!-- generated from ${source} by npm run figures; edit the JSON, not this file -->\n${ARROW}\n${r.svg}\n</svg>\n`;
}
