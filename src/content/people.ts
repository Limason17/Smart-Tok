// Personalities: a profile per person and an introduction card built from it.
// Kept free of zod; content/people.json is validated at build time (scripts/validate-content.ts).
import { deriveCard, type Card, type CardData } from './card';
import type { PersonData } from './schema';
import type { Lang } from './taxonomy';
import raw from '../../content/people.json';

export type Person = PersonData;

export const PEOPLE: Person[] = raw as Person[];
export const PERSON_BY_ID: Record<string, Person> = Object.fromEntries(PEOPLE.map((p) => [p.id, p]));

/** Id of a person's introduction card, also usable in card links (#k=person-…). */
export const introId = (personId: string) => `person-${personId}`;

const GLANCE: Record<Lang, string> = { de: 'Auf einen Blick', en: 'At a glance' };

function introText(p: Person, lang: Lang) {
  const t = p[lang];
  const title = lang === 'de' ? `Wer ${p.alive ? 'ist' : 'war'} ${p.name}?` : `Who ${p.alive ? 'is' : 'was'} ${p.name}?`;
  const facts = t.facts.map(([label, value]) => `- **${label}:** ${value}`).join('\n');
  return { title, body: `${t.bio}\n\n## ${GLANCE[lang]}\n\n${facts}`, source: t.source };
}

/** The introduction card: who, what, where, when. It comes before every other card about the person. */
export function introCard(p: Person): CardData {
  return {
    id: introId(p.id),
    area: p.area,
    sub: p.sub,
    style: 'portraet',
    level: 1,
    people: [p.id],
    de: introText(p, 'de'),
    en: introText(p, 'en'),
  } as CardData;
}

export const INTRO_CARDS: Card[] = PEOPLE.map((p) => deriveCard(introCard(p)));

/** Initials for the round avatar ("David Goggins" → "DG", "Marc Aurel" → "MA", "Sunzi" → "S"). */
export function initials(name: string): string {
  const words = name.replace(/\(.*?\)/g, '').split(/[\s-]+/).filter((w) => /^[A-ZÄÖÜ]/.test(w));
  return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? name)[0]).toUpperCase();
}
