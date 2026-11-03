import { describe, expect, it } from 'vitest';
import { CARDS } from '../content';
import { cardBlocks, paginate, shorten, textToBlocks, type Block } from './CardView';

const p = (text = 'x'): Block => ({ k: 'p', text });
const size = (h: number, mt = 10) => ({ h, mt });

describe('paginate', () => {
  it('fills a page until the next block no longer fits', () => {
    const blocks = [p(), p(), p(), p()];
    // 100 + (10+100) = 210 fits in 250, the third block would need 320
    expect(paginate(blocks, blocks.map(() => size(100)), 250)).toEqual([[0, 1], [2, 3]]);
  });

  it('keeps a heading on the same page as the block after it', () => {
    const blocks: Block[] = [p(), { k: 'title', text: 'Abschnitt', sub: true }, p()];
    const pages = paginate(blocks, [size(150), size(30), size(100)], 250);
    expect(pages).toEqual([[0], [1, 2]]);
  });

  it('starts a new page at a break', () => {
    const blocks: Block[] = [p(), { k: 'break' }, p()];
    expect(paginate(blocks, blocks.map(() => size(10)), 500)).toEqual([[0], [2]]);
  });

  it('puts an oversized block on its own page instead of looping', () => {
    const blocks = [p(), p(), p()];
    expect(paginate(blocks, [size(50), size(900), size(50)], 300)).toEqual([[0], [1], [2]]);
  });

  it('always returns at least one page', () => {
    expect(paginate([], [], 300)).toEqual([[]]);
  });
});

describe('cardBlocks', () => {
  it('ends with the closing section, followed directly by the closer look', () => {
    const card = CARDS.find((c) => c.de.act && c.de.deep && c.actKind)!;
    const blocks = cardBlocks(card, 'de');
    const act = blocks.findIndex((b) => b.k === 'act');
    expect(act).toBeGreaterThan(0);
    expect(blocks[act]).toMatchObject({ kind: card.actKind });
    expect(blocks[act + 1]).toMatchObject({ k: 'title', deep: true });
    expect(blocks.some((b) => b.k === 'break')).toBe(card.de.body.includes('---'));
  });

  it('turns "---" in the body into a page break', () => {
    const card = { ...CARDS[0], de: { ...CARDS[0].de, body: 'Eins.\n\n---\n\nZwei.' } };
    const kinds = cardBlocks(card, 'de').map((b) => b.k);
    expect(kinds.slice(0, 4)).toEqual(['title', 'p', 'break', 'p']);
  });

  it('gives news cards no closing task', () => {
    for (const card of CARDS.filter((c) => c.area === 'aktuelles')) {
      expect(cardBlocks(card, 'de').some((b) => b.k === 'act')).toBe(false);
    }
  });
});

describe('textToBlocks', () => {
  it('reads key sentences, bullet lists and subheadings', () => {
    const blocks = textToBlocks('Einleitung.\n\n## Teil\n\n- eins\n- zwei\n\n> Merk dir das.');
    expect(blocks).toEqual([
      { k: 'p', text: 'Einleitung.' },
      { k: 'title', text: 'Teil', sub: true },
      { k: 'li', text: 'eins' },
      { k: 'li', text: 'zwei' },
      { k: 'key', text: 'Merk dir das.' },
    ]);
  });

  it('splits long paragraphs at sentence ends', () => {
    const sentence = 'Das ist ein ganz normaler Satz mit genau zwölf Wörtern drin, oder fast.';
    const long = Array(5).fill(sentence).join(' ');
    const parts = shorten(long);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join(' ')).toBe(long);
    expect(shorten(sentence)).toEqual([sentence]);
  });
});
