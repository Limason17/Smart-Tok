import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, emptyAlgo } from '../algo/engine';
import type { CardRecord } from '../store/db';
import type { SyncData } from '../store/store';
import { decodeDoc, encodeDoc, mergeData } from './doc';

const rec = (id: string, patch: Partial<CardRecord> = {}): CardRecord => ({
  id,
  firstSeen: 1000,
  lastSeen: 2000,
  views: 1,
  dwellMs: 5000,
  reaction: 0,
  saved: false,
  more: false,
  shared: false,
  lang: 'de',
  updatedAt: 2000,
  ...patch,
});

const data = (patch: Partial<SyncData> = {}): SyncData => ({
  cards: {},
  days: {},
  settings: { lang: 'de', theme: 'dark', fontSize: 'm', installHintDismissed: false, onboarded: true },
  prefs: DEFAULT_PREFS,
  algo: emptyAlgo(0),
  suggestions: [],
  stamps: { settings: 0, prefs: 0, suggestions: 0, algo: 0 },
  ...patch,
});

describe('account document', () => {
  it('round-trips card records compactly and drops undefined values', () => {
    const local = data({
      cards: { a: rec('a', { saved: true, savedAt: 1500, reaction: 1 }), b: rec('b', { views: 0 }) },
      suggestions: [{ id: 's1', text: 'Rhetorik', createdAt: 1, note: undefined }],
    });
    const doc = encodeDoc(local, 'Liam');
    expect(doc.cards.a).toEqual([1000, 2000, 1, 5000, 1, 1, 1500, 0, 0, 'de', 2000]);
    expect(doc.cards.b).toBeUndefined();
    expect('note' in doc.suggestions[0]).toBe(false);
    const back = decodeDoc(doc, data());
    expect(back.cards.a).toEqual(local.cards.a);
  });
});

describe('merging devices', () => {
  it('combines card records: newest reaction wins, counts and times add up sensibly', () => {
    const phone = data({ cards: { a: rec('a', { reaction: 1, updatedAt: 5000, lastSeen: 5000, views: 3 }) } });
    const tablet = data({ cards: { a: rec('a', { saved: true, updatedAt: 4000, firstSeen: 500, views: 2 }), b: rec('b') } });
    const merged = mergeData(phone, tablet, false);
    expect(merged.cards.a).toMatchObject({ reaction: 1, saved: false, firstSeen: 500, lastSeen: 5000, views: 3, updatedAt: 5000 });
    expect(merged.cards.b).toBeDefined();
  });

  it('keeps the higher count per day', () => {
    const merged = mergeData(data({ days: { '2026-11-01': 4 } }), data({ days: { '2026-11-01': 6, '2026-11-02': 1 } }), false);
    expect(merged.days).toEqual({ '2026-11-01': 6, '2026-11-02': 1 });
  });

  it('takes whole sections from the side that changed them last', () => {
    const local = data({ prefs: { ...DEFAULT_PREFS, exploration: 'high' }, stamps: { settings: 0, prefs: 900, suggestions: 0, algo: 0 } });
    const remote = data({ prefs: { ...DEFAULT_PREFS, exploration: 'low' }, stamps: { settings: 0, prefs: 800, suggestions: 0, algo: 0 } });
    expect(mergeData(local, remote, false).prefs.exploration).toBe('high');
    // A device that never synced with this account takes the account's choices.
    expect(mergeData(local, remote, true).prefs.exploration).toBe('low');
    expect(mergeData(local, data(), true).prefs.exploration).toBe('high');
  });
});
