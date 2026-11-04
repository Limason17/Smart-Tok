import { describe, expect, it } from 'vitest';
import { renderFigure, type FigureSpec } from './figure-kit';

const specs: FigureSpec[] = [
  { type: 'flow', steps: [{ t: 'Idee|Idea', s: 'klein|small' }, { pair: [{ t: 'A' }, { t: 'B' }], note: 'hin und her|back and forth' }], fork: [{ label: 'ja|yes', box: { t: 'Gut|Good', acc: true } }, { label: 'nein|no', box: { t: 'Weg|Gone' } }] },
  { type: 'chain', rows: [{ label: 'EINS|ONE', items: [{ t: 'Text|Text' }, { t: 'Formel|Formula', pill: true }] }], footer: ['Fuss|Foot'] },
  { type: 'compare', cols: [{ head: 'Links|Left', items: [{ t: 'Kredit|Loan', v: '10' }] }, { head: 'Rechts|Right', items: [] }], badge: { col: 1, t: 'neu|new' } },
  { type: 'bars', items: [{ t: 'Gross|Big', v: 10, show: '10' }, { t: 'Klein|Small', v: 2, show: '2', acc: true }] },
  { type: 'timeline', items: [{ d: '1871', t: 'Beschrieben|Described' }] },
  { type: 'curve', points: [[0, 0.2], [0.5, 0.9], [1, 0.2]], base: 0.2, band: { from: 0.1, to: 0.8, label: 'Pause|Break' }, ticks: [{ x: 0.5, t: 'Mitte|Middle' }] },
];

describe('figure kit', () => {
  it.each(specs.map((s) => [s.type, s] as const))('draws %s with an English version of every label', (_, spec) => {
    const svg = renderFigure(spec, 'test.json');
    expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 360 \d+"/);
    for (const m of svg.matchAll(/<text\b([^>]*)>([^<]*)</g)) if (/\p{L}{2,}/u.test(m[2])) expect(m[1]).toContain('data-en="');
    expect(svg).not.toContain('NaN');
  });
});
