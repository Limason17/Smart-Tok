import { z } from 'zod';
import { NEWS_AREA, NEWS_ID, NEWS_MAX_DAYS } from './news';
import { AREA_BY_ID, STYLES } from './taxonomy';

const nonEmpty = z.string().trim().min(1);

const QuoteSchema = z.object({
  text: nonEmpty,
  author: nonEmpty,
  /** Book, speech or Bible reference. */
  source: z.string().optional(),
});

/** One language version of a card or a stack slide. */
const TextSchema = z.object({
  title: nonEmpty.max(80),
  /** Paragraphs separated by a blank line. `**bold**` is supported. */
  body: z.string().default(''),
  /** Optional bullet list (shown as "Liste" presentation). */
  points: z.array(nonEmpty).optional(),
  quote: QuoteSchema.optional(),
  /** One concrete sentence: what to do with it today. */
  apply: z.string().optional(),
  /** "Mehr erfahren": background, explanation, example. */
  more: z.string().optional(),
  source: z.string().optional(),
});

const SlideSchema = z.object({ de: TextSchema, en: TextSchema });

const Base = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id must be kebab-case'),
  area: nonEmpty,
  sub: nonEmpty,
  style: z.enum(STYLES),
  /** 1 = easy, 2 = medium, 3 = deep. */
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
  de: TextSchema,
  en: TextSchema,
  /** A stack: the card itself is the cover, slides follow sideways. */
  slides: z.array(SlideSchema).min(1).optional(),
  /** News cards: ISO dates. The card fades out and is removed at expiresAt. */
  publishedAt: z.string().optional(),
  expiresAt: z.string().optional(),
});

export const CardSchema = Base.superRefine((card, ctx) => {
  const area = AREA_BY_ID[card.area];
  if (!area) {
    ctx.addIssue({ code: 'custom', message: `unknown area "${card.area}"`, path: ['area'] });
    return;
  }
  if (!area.subtopics.some((s) => s.id === card.sub)) {
    ctx.addIssue({ code: 'custom', message: `unknown subtopic "${card.sub}" in ${card.area}`, path: ['sub'] });
  }
  for (const lang of ['de', 'en'] as const) {
    const t = card[lang];
    if (!t.body && !t.points && !t.quote && !card.slides) {
      ctx.addIssue({ code: 'custom', message: `${lang}: card has no content`, path: [lang] });
    }
    if (t.title.split(/\s+/).length > 9) {
      ctx.addIssue({ code: 'custom', message: `${lang}: title longer than 9 words`, path: [lang, 'title'] });
    }
  }
  if (!!card.de.points !== !!card.en.points || (card.de.points?.length ?? 0) !== (card.en.points?.length ?? 0)) {
    ctx.addIssue({ code: 'custom', message: 'de/en points differ in count', path: ['en', 'points'] });
  }
  if (!!card.de.quote !== !!card.en.quote) {
    ctx.addIssue({ code: 'custom', message: 'quote present in only one language', path: ['en', 'quote'] });
  }
  if (card.area === NEWS_AREA) checkNews(card, ctx);
});

function checkNews(card: z.infer<typeof Base>, ctx: z.RefinementCtx) {
  if (!NEWS_ID.test(card.id)) ctx.addIssue({ code: 'custom', message: 'news id must look like news-YYYY-MM-DD-topic', path: ['id'] });
  const published = Date.parse(card.publishedAt ?? '');
  const expires = Date.parse(card.expiresAt ?? '');
  if (Number.isNaN(published) || Number.isNaN(expires)) {
    ctx.addIssue({ code: 'custom', message: 'news needs publishedAt and expiresAt', path: ['expiresAt'] });
  } else {
    const days = (expires - published) / 86_400_000;
    if (days <= 0 || days > NEWS_MAX_DAYS) {
      ctx.addIssue({ code: 'custom', message: `news must expire within ${NEWS_MAX_DAYS} days`, path: ['expiresAt'] });
    }
    if (card.id.slice(5, 15) !== card.publishedAt!.slice(0, 10)) {
      ctx.addIssue({ code: 'custom', message: 'news id date must match publishedAt', path: ['id'] });
    }
  }
  for (const lang of ['de', 'en'] as const) {
    if (!card[lang].source?.trim()) ctx.addIssue({ code: 'custom', message: `${lang}: news needs a source`, path: [lang, 'source'] });
  }
}

export type CardInput = z.input<typeof CardSchema>;
export type CardData = z.output<typeof CardSchema>;
export type CardText = CardData['de'];

