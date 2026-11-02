import { deriveCard, type Card, type CardData, type CardInput } from './card';
import { AREAS } from './taxonomy';

// Card files are validated with zod at build time (scripts/validate-content.ts),
// so the app only normalises defaults here and keeps zod out of the bundle.
const modules = import.meta.glob<CardInput[]>('../../content/cards/*.json', { eager: true, import: 'default' });

function normalise(input: CardInput): CardData {
  return { ...input, level: input.level ?? 1 } as CardData;
}

export const CARDS: Card[] = Object.keys(modules)
  .sort()
  .flatMap((k) => modules[k].map((c) => deriveCard(normalise(c))));

export const CARD_BY_ID: Record<string, Card> = Object.fromEntries(CARDS.map((c) => [c.id, c]));

/** Areas that currently have at least one card, in taxonomy order. */
export const ACTIVE_AREAS = AREAS.filter((a) => CARDS.some((c) => c.area === a.id));
export const UPCOMING_AREAS = AREAS.filter((a) => !ACTIVE_AREAS.includes(a));

export function cardsInArea(areaId: string): Card[] {
  return CARDS.filter((c) => c.area === areaId);
}
