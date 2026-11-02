import { describe, expect, it } from 'vitest';
import { deriveCard, type Card } from '../content/card';
import {
  afterView,
  applySignal,
  areaShares,
  DEFAULT_PREFS,
  emptyAlgo,
  ensureSession,
  featureMultiplier,
  foldSession,
  freshness,
  nextReviewDue,
  pickNext,
  reviewDue,
  sessionMultiplier,
  signalValue,
  TUNING,
  type Prefs,
  type SeenInfo,
} from './engine';

const text = (title: string, words = 40) => ({ title, body: Array.from({ length: words }, () => 'wort').join(' ') });

function card(id: string, area: string, sub: string, extra: Partial<Card> = {}): Card {
  return deriveCard({ id, area, sub, style: 'tipp', level: 1, de: text(id), en: text(id), ...extra });
}

/** Deterministic RNG for repeatable tests. */
function rng(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const T0 = Date.UTC(2026, 10, 2, 12);

const deck: Card[] = [];
for (let i = 0; i < 20; i++) {
  deck.push(card(`inv-${i}`, 'geld', 'investment'));
  deck.push(card(`sales-${i}`, 'geld', 'sales'));
  deck.push(card(`mind-${i}`, 'mindset', 'fokus'));
  deck.push(card(`faith-${i}`, 'glaube', 'gebet'));
}

function sample(prefs: Prefs, algo = emptyAlgo(T0), n = 3000, seen: Record<string, SeenInfo> = {}) {
  const r = rng();
  const counts: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const p = pickNext({ cards: deck, seen, prefs, algo, recent: [], now: T0, rng: r })!;
    const key = `${p.card.area}/${p.card.sub}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

describe('signals', () => {
  it('weights like, save and dislike as planned', () => {
    const c = card('x', 'geld', 'investment');
    expect(signalValue({ type: 'save', on: true }, c)).toBe(3);
    expect(signalValue({ type: 'like', on: true }, c)).toBe(2);
    expect(signalValue({ type: 'dislike', on: true }, c)).toBe(-3);
    expect(signalValue({ type: 'more' }, c)).toBe(1);
  });

  it('treats dwell only as a small bonus, normalised by card length', () => {
    const short = card('s', 'geld', 'investment', { de: text('s', 10), en: text('s', 10) });
    const long = card('l', 'geld', 'investment', { de: text('l', 300), en: text('l', 300) });
    // 20 s is a long stay on a short card, but quick on a long one.
    expect(signalValue({ type: 'dwell', seconds: 20 }, short)).toBe(0.5);
    expect(signalValue({ type: 'dwell', seconds: 20 }, long)).toBe(0);
    expect(signalValue({ type: 'dwell', seconds: 2 }, long)).toBe(-0.5);
    // An idle phone left on a card earns nothing.
    expect(signalValue({ type: 'dwell', seconds: 3600 }, short)).toBe(0);
  });
});

describe('two layers', () => {
  it('session reacts fast but is capped at x2 / x0.5', () => {
    let algo = emptyAlgo(T0);
    const inv = deck[0];
    for (let i = 0; i < 6; i++) algo = applySignal(algo, inv, { type: 'save', on: true }, T0 + i * 1000);
    expect(sessionMultiplier(algo, 's:geld/investment')).toBe(TUNING.sessionMax);
    for (let i = 0; i < 12; i++) algo = applySignal(algo, deck[1], { type: 'dislike', on: true }, T0 + 9000 + i);
    expect(sessionMultiplier(algo, 's:geld/sales')).toBe(TUNING.sessionMin);
  });

  it('a session ends after 30 idle minutes and feeds lightly into the long-term profile', () => {
    let algo = emptyAlgo(T0);
    algo = applySignal(algo, deck[0], { type: 'like', on: true }, T0);
    algo = applySignal(algo, deck[0], { type: 'like', on: true }, T0 + 1000);
    const sessionScore = algo.session!.scores['s:geld/investment'];
    expect(algo.long['s:geld/investment']).toBeUndefined();

    algo = ensureSession(algo, T0 + 29 * 60_000);
    expect(algo.session!.scores['s:geld/investment']).toBe(sessionScore);

    algo = ensureSession(algo, T0 + 1000 + 31 * 60_000);
    expect(algo.session!.scores).toEqual({});
    expect(algo.long['s:geld/investment']).toBeCloseTo(sessionScore * TUNING.sessionCarry, 1);
  });

  it('old long-term signals fade slowly', () => {
    const algo = { long: { 'a:geld': 5 }, longUpdatedAt: T0, session: null };
    const later = foldSession(algo, T0 + 30 * 86_400_000);
    expect(later.long['a:geld']).toBeLessThan(5);
    expect(later.long['a:geld']).toBeGreaterThan(2);
  });
});

describe('pickNext', () => {
  it('random mode spreads evenly over enabled areas', () => {
    const counts = sample(DEFAULT_PREFS);
    const geld = (counts['geld/investment'] ?? 0) + (counts['geld/sales'] ?? 0);
    expect(geld / 3000).toBeGreaterThan(0.28);
    expect(geld / 3000).toBeLessThan(0.39);
  });

  it('never shows switched-off areas or subtopics', () => {
    const counts = sample({ ...DEFAULT_PREFS, disabledAreas: ['glaube'], disabledSubs: ['geld/sales'] }, undefined, 500);
    expect(counts['glaube/gebet']).toBeUndefined();
    expect(counts['geld/sales']).toBeUndefined();
  });

  it('liking investment and swiping away sales shifts the subtopics, not the area', () => {
    let algo = emptyAlgo(T0);
    for (let i = 0; i < 5; i++) {
      algo = applySignal(algo, deck[0], { type: 'like', on: true }, T0);
      algo = applySignal(algo, deck[1], { type: 'dislike', on: true }, T0);
    }
    algo = foldSession(algo, T0);
    const counts = sample(DEFAULT_PREFS, algo);
    expect(counts['geld/investment']).toBeGreaterThan(counts['geld/sales'] * 1.5);
    const geld = counts['geld/investment'] + counts['geld/sales'];
    // Area share stays roughly where it was (the likes and dislikes cancel out at area level).
    expect(geld / 3000).toBeGreaterThan(0.2);
  });

  it('keeps an exploration share so the feed never collapses into one topic', () => {
    const algo = emptyAlgo(T0);
    algo.long = { 'a:geld': 8, 'a:mindset': -8, 'a:glaube': -8 };
    const counts = sample(DEFAULT_PREFS, algo);
    expect((counts['mindset/fokus'] ?? 0) / 3000).toBeGreaterThan(0.06);
  });

  it('custom weighting changes how often an area appears', () => {
    const counts = sample({ ...DEFAULT_PREFS, mix: 'custom', areaWeight: { mindset: 'more', glaube: 'less' } });
    expect(counts['mindset/fokus']).toBeGreaterThan(counts['glaube/gebet'] * 2.5);
  });

  it('user tweaks multiply the learned weights and hidden subtopics disappear', () => {
    const prefs: Prefs = { ...DEFAULT_PREFS, adjust: { 's:geld/sales': 'hidden', 'st:tipp': 'more' } };
    expect(featureMultiplier(emptyAlgo(T0), prefs, 'st:tipp')).toBeCloseTo(1.6);
    const counts = sample(prefs, undefined, 500);
    expect(counts['geld/sales']).toBeUndefined();
  });

  it('shows unread cards first, then keeps going endlessly with review cards', () => {
    const small = [card('a', 'geld', 'investment'), card('b', 'geld', 'investment'), card('c', 'geld', 'investment')];
    const seen: Record<string, SeenInfo> = {
      a: { lastSeen: T0 - 3 * 86_400_000, views: 1, reaction: 0, saved: true },
      b: { lastSeen: T0 - 86_400_000, views: 1, reaction: -1, saved: false },
    };
    const first = pickNext({ cards: small, seen, prefs: DEFAULT_PREFS, algo: emptyAlgo(T0), recent: [], now: T0, rng: rng() })!;
    expect(first.card.id).toBe('c');
    expect(first.review).toBe(false);
    seen.c = { lastSeen: T0, views: 1, reaction: 0, saved: false };
    const next = pickNext({ cards: small, seen, prefs: DEFAULT_PREFS, algo: emptyAlgo(T0), recent: ['c'], now: T0, rng: rng() })!;
    expect(next.review).toBe(true);
    // Disliked cards do not come back.
    expect(next.card.id).toBe('a');
  });

  it('returns null when every topic is switched off', () => {
    const prefs = { ...DEFAULT_PREFS, disabledAreas: ['geld', 'mindset', 'glaube'] };
    expect(pickNext({ cards: deck, seen: {}, prefs, algo: emptyAlgo(T0), recent: [], now: T0 })).toBeNull();
  });
});

describe('area shares', () => {
  it('match what the picker actually does', () => {
    let algo = ensureSession(emptyAlgo(T0), T0);
    for (let i = 0; i < 3; i++) algo = applySignal(algo, deck[0], { type: 'save', on: true }, T0);
    const shares = areaShares(deck, DEFAULT_PREFS, algo, T0);
    expect(Object.values(shares).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(shares.geld).toBeGreaterThan(shares.mindset);
    const counts = sample(DEFAULT_PREFS, algo, 4000);
    const geld = ((counts['geld/investment'] ?? 0) + (counts['geld/sales'] ?? 0)) / 4000;
    expect(Math.abs(geld - shares.geld)).toBeLessThan(0.04);
  });

  it('leave out switched-off areas and respect hidden card styles', () => {
    const prefs: Prefs = { ...DEFAULT_PREFS, disabledAreas: ['glaube'] };
    expect(areaShares(deck, prefs, emptyAlgo(T0), T0).glaube).toBeUndefined();
    const hidden: Prefs = { ...DEFAULT_PREFS, adjust: { 'st:tipp': 'hidden' } };
    expect(pickNext({ cards: deck, seen: {}, prefs: hidden, algo: emptyAlgo(T0), recent: [], now: T0 })).toBeNull();
  });
});

describe('news freshness', () => {
  it('fades news and removes it at expiry', () => {
    const news = { publishedAt: '2026-11-01T00:00:00Z', expiresAt: '2026-11-08T00:00:00Z' };
    expect(freshness(news, Date.parse('2026-11-01T01:00:00Z'))).toBeGreaterThan(0.95);
    expect(freshness(news, Date.parse('2026-11-06T00:00:00Z'))).toBeLessThan(0.5);
    expect(freshness(news, Date.parse('2026-11-08T00:00:01Z'))).toBe(0);
    expect(freshness({}, T0)).toBe(1);
  });
});

describe('spaced review of saved cards', () => {
  const DAY = 86_400_000;

  it('schedules reviews 1, 3, 7 and 21 days apart, then stops', () => {
    let r = { saved: true, savedAt: T0, lastSeen: T0, reviewStep: 0, reviewDue: nextReviewDue(0, T0) };
    expect(r.reviewDue).toBe(T0 + DAY);
    // A view before the card is due changes nothing.
    expect(afterView(r, T0 + DAY / 2)).toEqual({ reviewStep: 0, reviewDue: T0 + DAY });
    let t = T0;
    for (const gap of [1, 3, 7, 21]) {
      t += gap * DAY;
      r = { ...r, ...afterView(r, t), lastSeen: t } as typeof r;
    }
    expect(r.reviewStep).toBe(4);
    expect(r.reviewDue).toBeUndefined();
    expect(reviewDue(r)).toBeUndefined();
  });

  it('gives cards saved before reviews existed a first review one day after saving', () => {
    expect(reviewDue({ saved: true, savedAt: T0, lastSeen: T0 })).toBe(T0 + DAY);
    expect(reviewDue({ saved: false, lastSeen: T0 })).toBeUndefined();
  });

  it('puts a due saved card into the feed, spaced out and not twice in a row', () => {
    const seen: Record<string, SeenInfo> = {};
    for (const c of deck.slice(0, 10)) seen[c.id] = { lastSeen: T0, views: 1, reaction: 0, saved: false };
    seen['faith-0'] = { lastSeen: T0, views: 1, reaction: 0, saved: true, due: T0 + DAY };
    const base = { cards: deck, seen, prefs: DEFAULT_PREFS, algo: emptyAlgo(T0), rng: rng() };

    // Not due yet: never picked as a review.
    expect(pickNext({ ...base, recent: [], now: T0 })!.due).toBeFalsy();
    // Due: picked when enough other cards came since the last review.
    const now = T0 + 2 * DAY;
    const pick = pickNext({ ...base, recent: [], now, sinceReview: TUNING.reviewGap })!;
    expect(pick).toMatchObject({ due: true, card: { id: 'faith-0' } });
    // Too soon after another review, or already in the feed: normal pick.
    expect(pickNext({ ...base, recent: [], now, sinceReview: 1 })!.due).toBeFalsy();
    expect(pickNext({ ...base, recent: ['faith-0'], now, sinceReview: 10 })!.due).toBeFalsy();
  });

  it('skips due cards from areas the user switched off', () => {
    const seen: Record<string, SeenInfo> = { 'faith-0': { lastSeen: T0, views: 1, reaction: 0, saved: true, due: T0 } };
    const prefs = { ...DEFAULT_PREFS, disabledAreas: ['glaube'] };
    const pick = pickNext({ cards: deck, seen, prefs, algo: emptyAlgo(T0), recent: [], now: T0 + 1, sinceReview: 10, rng: rng() })!;
    expect(pick.due).toBeFalsy();
  });
});
