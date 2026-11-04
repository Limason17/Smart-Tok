// Runtime helpers for cards. Kept free of zod so the schema stays out of the app bundle.
import type { CardData, CardText } from './schema';
import type { Lang } from './taxonomy';

export type { CardData, CardInput, CardText } from './schema';

export type Format = 'text' | 'liste' | 'zitat' | 'stapel';
export type Length = 'kurz' | 'mittel' | 'lang';

/** A validated card plus the features the algorithm scores. */
export interface Card extends CardData {
  format: Format;
  length: Length;
  /** Words in the German version (used for expected reading time). */
  words: number;
}

/** A figure takes about as long to read as this many words. */
const FIGURE_WORDS = 12;
const FIGURE_LINES = /^\[\[grafik:[a-z0-9-]+\]\]$/gm;

export function countWords(t: CardText): number {
  const figures = (t.body.match(FIGURE_LINES)?.length ?? 0) + (t.example?.match(FIGURE_LINES)?.length ?? 0);
  const body = t.body.replace(/^---$/gm, '').replace(FIGURE_LINES, '');
  const parts = [t.title, body, ...(t.points ?? []), t.quote?.text ?? '', (t.example ?? '').replace(FIGURE_LINES, ''), t.act ?? ''];
  return parts.join(' ').split(/\s+/).filter(Boolean).length + figures * FIGURE_WORDS;
}

export function deriveCard(data: CardData): Card {
  let words = countWords(data.de);
  for (const slide of data.slides ?? []) words += countWords(slide.de);
  const format: Format = data.slides
    ? 'stapel'
    : data.de.points
      ? 'liste'
      : data.style === 'zitat' && data.de.quote
        ? 'zitat'
        : 'text';
  const length: Length = words < 70 ? 'kurz' : words < 160 ? 'mittel' : 'lang';
  return { ...data, format, length, words };
}

/** Expected reading time in seconds (about 200 words per minute plus a beat to orient). */
export function expectedSeconds(card: Pick<Card, 'words'>): number {
  return card.words / 3.3 + 2;
}

export function textFor(card: Pick<CardData, 'de' | 'en'>, lang: Lang): CardText {
  return card[lang];
}
