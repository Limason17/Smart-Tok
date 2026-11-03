import { describe, expect, it, vi } from 'vitest';
import { CARDS } from '../content';
import { cardLink, linkedCards } from './links';

describe('card links', () => {
  const [a, b] = CARDS.map((c) => c.id);

  it('builds a link to one or more cards', () => {
    vi.stubGlobal('location', { origin: 'https://limason17.github.io', pathname: '/Smart-Tok/' });
    expect(cardLink([a])).toBe(`https://limason17.github.io/Smart-Tok/#k=${a}`);
    expect(cardLink([a, b])).toBe(`https://limason17.github.io/Smart-Tok/#k=${a},${b}`);
    vi.unstubAllGlobals();
  });

  it('reads only existing cards, once each', () => {
    expect(linkedCards(`#k=${a},gibt-es-nicht,${a},${b}`)).toEqual([a, b]);
    expect(linkedCards('#something-else')).toEqual([]);
    expect(linkedCards('')).toEqual([]);
  });
});
