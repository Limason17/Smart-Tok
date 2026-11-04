import { describe, expect, it } from 'vitest';
import { CARDS } from '../content';
import { CardSchema, type CardInput } from '../content/schema';
import { textToBlocks } from '../ui/CardView';
import { FIGURE_IDS, figureSvg, figuresIn } from '.';

describe('figures', () => {
  it.each(FIGURE_IDS)('%s renders in both languages without broken numbers', (id) => {
    for (const lang of ['de', 'en'] as const) {
      const svg = figureSvg(id, lang);
      expect(svg).toMatch(/^<svg viewBox="0 0 \d+ \d+" role="img" aria-label="[^"]+">/);
      expect(svg).not.toMatch(/NaN|undefined|Infinity/);
    }
  });

  it('gives gradients and clip paths new ids on every render', () => {
    const ids = (s: string) => [...s.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    const a = ids(figureSvg('gps-kreise', 'de'));
    const b = ids(figureSvg('gps-kreise', 'de'));
    expect(a.length).toBeGreaterThan(0);
    expect(a.some((x) => b.includes(x))).toBe(false);
  });

  it('turns a figure line into a figure block', () => {
    expect(textToBlocks('Text.\n\n[[grafik:gegenschall]]\n\nMehr.')).toEqual([
      { k: 'p', text: 'Text.' },
      { k: 'fig', id: 'gegenschall' },
      { k: 'p', text: 'Mehr.' },
    ]);
  });

  it('is used by at least one card each', () => {
    const used = new Set(CARDS.flatMap((c) => [c.de.body, c.de.example, c.de.deep].flatMap(figuresIn)));
    expect(FIGURE_IDS.filter((id) => !used.has(id))).toEqual([]);
  });

  it('rejects unknown figures and figures in only one language', () => {
    const card = (de: string, en: string): CardInput => ({
      id: 'probe',
      area: 'wissen',
      sub: 'allgemein',
      style: 'fakt',
      de: { title: 'Probe', body: de },
      en: { title: 'Probe', body: en },
    });
    expect(CardSchema.safeParse(card('A\n\n[[grafik:gibt-es-nicht]]', 'A\n\n[[grafik:gibt-es-nicht]]')).success).toBe(false);
    expect(CardSchema.safeParse(card('A\n\n[[grafik:gegenschall]]', 'A')).success).toBe(false);
    expect(CardSchema.safeParse(card('A\n\n[[grafik:gegenschall]]', 'A\n\n[[grafik:gegenschall]]')).success).toBe(true);
  });
});
