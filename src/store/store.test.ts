import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { CARDS } from '../content';
import { addSuggestion, getState, localDate, resetAll, sanitizeText, setAdjust, streak, toggleLike, toggleSave } from './store';

describe('topic suggestions', () => {
  it('strips control characters, links and markup and caps the length', () => {
    expect(sanitizeText('  Stoizismus\u0000‮ <script>  ', 80)).toBe('Stoizismus script');
    expect(sanitizeText('Verhandeln https://evil.example/x www.foo.bar', 80)).toBe('Verhandeln');
    expect(sanitizeText('x'.repeat(200), 80)).toHaveLength(80);
  });

  it('ignores empty suggestions', () => {
    expect(addSuggestion('   ')).toBe(false);
    expect(addSuggestion('Rhetorik', 'mehr Beispiele')).toBe(true);
    expect(getState().suggestions.at(-1)).toMatchObject({ text: 'Rhetorik', note: 'mehr Beispiele' });
  });
});

describe('localDate', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(localDate(new Date(2026, 0, 5, 12).getTime())).toBe('2026-01-05');
  });
});

describe('streak', () => {
  const day = (offset: number) => localDate(new Date(2026, 10, 10 + offset, 12).getTime());
  const now = new Date(2026, 10, 10, 20).getTime();

  it('counts consecutive days ending today', () => {
    expect(streak({ [day(0)]: 3, [day(-1)]: 1, [day(-2)]: 5, [day(-4)]: 2 }, now)).toBe(3);
  });

  it('keeps yesterday\'s streak alive until today is over', () => {
    expect(streak({ [day(-1)]: 1, [day(-2)]: 1 }, now)).toBe(2);
    expect(streak({ [day(-2)]: 1 }, now)).toBe(0);
  });
});

describe('algorithm tweaks', () => {
  it('stores only non-normal values', () => {
    setAdjust('st:zitat', 'more');
    expect(getState().prefs.adjust['st:zitat']).toBe('more');
    setAdjust('st:zitat', 'normal');
    expect('st:zitat' in getState().prefs.adjust).toBe(false);
  });
});

describe('reset everything', () => {
  it('makes a fresh account and can keep saved cards', async () => {
    setAdjust('st:zitat', 'more');
    addSuggestion('Verhandeln');
    const [a, b] = CARDS;
    toggleSave(a.id);
    toggleLike(b.id);
    await resetAll(true);
    const s = getState();
    expect(Object.keys(s.cards)).toEqual([a.id]);
    expect(s.cards[a.id]).toMatchObject({ saved: true, reaction: 0, views: 1 });
    expect(s.prefs.adjust).toEqual({});
    expect(s.suggestions).toEqual([]);
    expect(s.days).toEqual({});
    expect(s.settings.onboarded).toBe(false);
    expect(s.stamps.reset).toBeGreaterThan(0);

    await resetAll(false);
    expect(getState().cards).toEqual({});
  });
});
