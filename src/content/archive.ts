/** Loads archived news cards (see news.ts) on demand, for the profile. */
import { deriveCard, type Card, type CardData } from './card';
import { CARD_BY_ID } from './index';
import { newsMonth } from './news';

const loaded = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();
let version = 0;

/** Changes whenever archived cards were added to CARD_BY_ID. */
export const archiveVersion = () => version;
export function onArchive(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Makes sure the given card ids can be shown: news cards that already left the app bundle are
 * fetched from the archive and added to CARD_BY_ID (never to the feed).
 */
export function loadArchived(ids: Iterable<string>): void {
  const months = new Set<string>();
  for (const id of ids) {
    const month = !CARD_BY_ID[id] && newsMonth(id);
    if (month && !loaded.has(month)) months.add(month);
  }
  for (const month of months) {
    const job = fetch(`${import.meta.env.BASE_URL}news-archive/${month}.json`)
      .then((res) => (res.ok ? (res.json() as Promise<CardData[]>) : []))
      .then((list) => {
        let added = 0;
        for (const data of list) {
          if (CARD_BY_ID[data.id]) continue;
          const card: Card = deriveCard({ ...data, level: data.level ?? 1 });
          CARD_BY_ID[card.id] = card;
          added++;
        }
        if (added) {
          version++;
          listeners.forEach((fn) => fn());
        }
      })
      .catch(() => {
        loaded.delete(month); // offline: try again next time
      });
    loaded.set(month, job);
  }
}
