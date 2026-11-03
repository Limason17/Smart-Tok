import { deriveCard, type Card, type CardData, type CardInput } from './card';
import { INTRO_CARDS, introId, PEOPLE } from './people';
import { AREAS } from './taxonomy';

// Card files are validated with zod at build time (scripts/validate-content.ts),
// so the app only normalises defaults here and keeps zod out of the bundle.
const modules = import.meta.glob<CardInput[]>('../../content/cards/*.json', { eager: true, import: 'default' });

function normalise(input: CardInput): CardData {
  return { ...input, level: input.level ?? 1 } as CardData;
}

export const CARDS: Card[] = Object.keys(modules)
  .sort()
  .flatMap((k) => modules[k].map((c) => deriveCard(normalise(c))))
  .concat(INTRO_CARDS);

export const CARD_BY_ID: Record<string, Card> = Object.fromEntries(CARDS.map((c) => [c.id, c]));

/** Areas that currently have at least one card, in taxonomy order. */
export const ACTIVE_AREAS = AREAS.filter((a) => CARDS.some((c) => c.area === a.id));
export const UPCOMING_AREAS = AREAS.filter((a) => !ACTIVE_AREAS.includes(a));

export function cardsInArea(areaId: string): Card[] {
  return CARDS.filter((c) => c.area === areaId);
}

/** All cards about a person: the introduction first (pinned), then the others in content order. */
export function cardsOfPerson(personId: string): Card[] {
  const intro = CARD_BY_ID[introId(personId)];
  return [intro, ...CARDS.filter((c) => c.id !== intro?.id && c.people?.includes(personId))].filter(Boolean);
}

/** Card count per person, for sorting the people list. */
export const PERSON_CARD_COUNT: Record<string, number> = Object.fromEntries(PEOPLE.map((p) => [p.id, cardsOfPerson(p.id).length]));
