import { describe, expect, it } from 'vitest';
import { textToBlocks } from '../ui/CardView';
import { localiseSvg, parseFigure } from './figure-mark';

describe('figures', () => {
  it('reads the figure mark with options and caption', () => {
    expect(parseFigure('[[fig:gps-abstaende]]')).toEqual({ name: 'gps-abstaende', full: false, caption: undefined });
    expect(parseFigure('[[fig:kreislauf|full|Der Kreislauf]]')).toEqual({ name: 'kreislauf', full: true, caption: 'Der Kreislauf' });
    expect(parseFigure('Text mit [[fig:x]] drin')).toBeNull();
  });

  it('puts a full diagram on a page of its own', () => {
    const kinds = textToBlocks('Vorher.\n\n[[fig:a|full]]\n\nNachher.\n\n[[fig:b]]').map((b) => b.k);
    expect(kinds).toEqual(['p', 'break', 'diagram', 'break', 'p', 'diagram']);
  });

  it('swaps labels to English from data-en', () => {
    const svg = '<svg viewBox="0 0 10 10"><text x="1" data-en="your phone">dein Handy</text><text>24 h</text></svg>';
    expect(localiseSvg(svg, 'en')).toBe('<svg viewBox="0 0 10 10"><text x="1">your phone</text><text>24 h</text></svg>');
    expect(localiseSvg(svg, 'de')).toBe(svg);
  });
});
