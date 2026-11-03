import { CARD_BY_ID } from '../content';

/** Links to cards: `…/Smart-Tok/#k=<id>` opens one card, `#k=<id>,<id>` several in a row. */
const KEY = 'k';
const MAX = 20;

/** The app's address with a link to the given cards. */
export function cardLink(ids: string[]): string {
  return `${location.origin}${location.pathname}#${KEY}=${ids.map(encodeURIComponent).join(',')}`;
}

/** Card ids from the address (only cards that exist, no duplicates). */
export function linkedCards(hash = location.hash): string[] {
  const m = hash.match(new RegExp(`^#${KEY}=([^&]*)`));
  if (!m) return [];
  const ids = m[1].split(',').map((s) => decodeURIComponent(s.trim()));
  return [...new Set(ids)].filter((id) => CARD_BY_ID[id]).slice(0, MAX);
}

/** Removes the card link from the address, so a reload starts the normal feed. */
export function clearCardLink() {
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}
