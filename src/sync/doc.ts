/**
 * The account document: one compact Firestore document per user (users/{uid}).
 * Pure functions only, so encoding and merging are unit-tested without Firebase.
 */
import type { CardRecord } from '../store/db';
import type { Stamps, SyncData, SyncSection } from '../store/store';

export const DOC_VERSION = 1;

/**
 * A card record as a short array:
 * [firstSeen, lastSeen, views, dwellMs, reaction, saved, savedAt, more, shared, lang, updatedAt, reviewStep, reviewDue].
 * reviewStep is -1 when unset; the last two entries are missing in documents written before reviews existed.
 */
export type PackedCard = [number, number, number, number, -1 | 0 | 1, 0 | 1, number, 0 | 1, 0 | 1, 'de' | 'en', number, number?, number?];

export interface AccountDoc {
  v: number;
  name: string;
  cards: Record<string, PackedCard>;
  days: Record<string, number>;
  settings: SyncData['settings'];
  prefs: SyncData['prefs'];
  algo: SyncData['algo'];
  suggestions: SyncData['suggestions'];
  stamps: Stamps;
}

export function packCard(r: CardRecord): PackedCard {
  return [r.firstSeen, r.lastSeen, r.views, Math.round(r.dwellMs), r.reaction, r.saved ? 1 : 0, r.savedAt ?? 0, r.more ? 1 : 0, r.shared ? 1 : 0, r.lang, r.updatedAt, r.reviewStep ?? -1, r.reviewDue ?? 0];
}

export function unpackCard(id: string, p: PackedCard): CardRecord {
  const [firstSeen, lastSeen, views, dwellMs, reaction, saved, savedAt, more, shared, lang, updatedAt, reviewStep, reviewDue] = p;
  return {
    id,
    firstSeen,
    lastSeen,
    views,
    dwellMs,
    reaction,
    saved: saved === 1,
    savedAt: savedAt || undefined,
    more: more === 1,
    shared: shared === 1,
    lang: lang === 'en' ? 'en' : 'de',
    updatedAt,
    reviewStep: typeof reviewStep === 'number' && reviewStep >= 0 ? reviewStep : undefined,
    reviewDue: reviewDue || undefined,
  };
}

/** Firestore rejects `undefined`; a JSON round trip drops it and copies the data. */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function encodeDoc(data: SyncData, name: string): AccountDoc {
  const cards: Record<string, PackedCard> = {};
  for (const r of Object.values(data.cards)) {
    // Cards that were only scrolled past without a view, reaction or save carry nothing worth syncing.
    if (r.views > 0 || r.saved || r.reaction !== 0 || r.more || r.shared) cards[r.id] = packCard(r);
  }
  return plain({
    v: DOC_VERSION,
    name,
    cards,
    days: data.days,
    settings: data.settings,
    prefs: data.prefs,
    algo: data.algo,
    suggestions: data.suggestions,
    stamps: data.stamps,
  });
}

export function decodeDoc(doc: Partial<AccountDoc>, fallback: SyncData): SyncData {
  const cards: Record<string, CardRecord> = {};
  for (const [id, p] of Object.entries(doc.cards ?? {})) {
    if (Array.isArray(p) && p.length >= 11) cards[id] = unpackCard(id, p);
  }
  return {
    cards,
    days: doc.days ?? {},
    settings: { ...fallback.settings, ...doc.settings },
    prefs: { ...fallback.prefs, ...doc.prefs },
    algo: doc.algo ?? fallback.algo,
    suggestions: doc.suggestions ?? [],
    stamps: { settings: 0, prefs: 0, suggestions: 0, algo: 0, ...doc.stamps },
  };
}

function mergeCard(a: CardRecord, b: CardRecord): CardRecord {
  const newer = b.updatedAt > a.updatedAt ? b : a;
  const firsts = [a.firstSeen, b.firstSeen].filter((t) => t > 0);
  return {
    ...newer,
    firstSeen: firsts.length ? Math.min(...firsts) : 0,
    lastSeen: Math.max(a.lastSeen, b.lastSeen),
    views: Math.max(a.views, b.views),
    dwellMs: Math.max(a.dwellMs, b.dwellMs),
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
  };
}

const SECTIONS: SyncSection[] = ['settings', 'prefs', 'suggestions', 'algo'];

/**
 * Merges this device's data with the account's.
 * Cards and days are combined record by record. Settings, topic choices, suggestions and the
 * algorithm are taken whole from whichever side changed them last; a device that has never
 * synced with this account takes them from the account, so a fresh install doesn't overwrite them.
 */
export function mergeData(local: SyncData, remote: SyncData, preferRemote: boolean): SyncData {
  const cards: Record<string, CardRecord> = { ...remote.cards };
  for (const [id, r] of Object.entries(local.cards)) cards[id] = cards[id] ? mergeCard(r, cards[id]) : r;

  const days: Record<string, number> = { ...remote.days };
  for (const [d, n] of Object.entries(local.days)) days[d] = Math.max(n, days[d] ?? 0);

  const out: SyncData = { ...local, cards, days, stamps: { ...local.stamps } };
  for (const section of SECTIONS) {
    const remoteWins = preferRemote ? remote.stamps[section] > 0 : remote.stamps[section] > local.stamps[section];
    if (remoteWins) {
      (out as unknown as Record<SyncSection, unknown>)[section] = remote[section];
      out.stamps[section] = remote.stamps[section];
    }
  }
  return out;
}
