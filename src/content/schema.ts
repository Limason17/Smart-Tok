import { z } from 'zod';
import { NEWS_AREA, NEWS_ID, NEWS_MAX_DAYS } from './news';
import { ACT_KINDS, AREA_BY_ID, STYLES } from './taxonomy';

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
  /**
   * Paragraphs separated by a blank line. `**bold**` is supported.
   * A paragraph that is only `---` starts a new page (pages are swiped sideways).
   * Pages are also split automatically, so a card never needs vertical scrolling.
   */
  body: z.string().default(''),
  /** Optional numbered list (shown as "Liste" presentation). */
  points: z.array(nonEmpty).optional(),
  quote: QuoteSchema.optional(),
  /** A worked example, shown in its own box ("Beispiel"). Paragraphs like body. */
  example: z.string().optional(),
  /**
   * The closing section; its heading comes from the card's actKind
   * (Heute anwenden, So wendest du es an, Achte darauf, Über längere Zeit, Merk dir, Frag dich, Im Gebet).
   * Lines starting with "- " become steps.
   */
  act: z.string().optional(),
  /**
   * "Genauer betrachtet": depth for those who want it (research, history, nuance).
   * Shown as the card's last page(s), after the closing section. Paragraphs like body.
   */
  deep: z.string().optional(),
  /** "Mehr erfahren" sheet: background that does not need its own page. */
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
  /** What kind of closing section the card has (see act). */
  actKind: z.enum(ACT_KINDS).optional(),
  de: TextSchema,
  en: TextSchema,
  /** A stack: the card itself is the cover, slides follow sideways. */
  slides: z.array(SlideSchema).min(1).optional(),
  /**
   * People the card is about (ids from content/people.json), main person first.
   * Before a card about someone, the feed shows that person's introduction once.
   */
  people: z.array(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)).min(1).optional(),
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
  if (!!card.de.act !== !!card.en.act) {
    ctx.addIssue({ code: 'custom', message: 'act present in only one language', path: ['en', 'act'] });
  }
  if (card.de.act && !card.actKind) {
    ctx.addIssue({ code: 'custom', message: 'card with act needs actKind', path: ['actKind'] });
  }
  if (!!card.de.deep !== !!card.en.deep) {
    ctx.addIssue({ code: 'custom', message: 'deep present in only one language', path: ['en', 'deep'] });
  }
  if (!!card.de.example !== !!card.en.example) {
    ctx.addIssue({ code: 'custom', message: 'example present in only one language', path: ['en', 'example'] });
  }
  for (const [i, slide] of (card.slides ?? []).entries()) {
    if (slide.de.act || slide.en.act) ctx.addIssue({ code: 'custom', message: 'act belongs on the card, not on a slide', path: ['slides', i] });
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

/** One language version of a person's profile. */
const PersonTextSchema = z.object({
  /** What the person is known as, e.g. "Ex-Navy-SEAL, Ultraläufer, Autor". */
  role: nonEmpty,
  /** Short line under the name, e.g. "geb. 1975 · USA". */
  meta: nonEmpty,
  /** Who, what, where, when: the introduction card's text. Paragraphs like a card body. */
  bio: nonEmpty,
  /** "Auf einen Blick": label and value pairs, shown on the introduction card and the profile. */
  facts: z.array(z.tuple([nonEmpty, nonEmpty])).min(2),
  source: z.string().optional(),
});

/** A personality with a profile and an introduction card that comes before their other cards. */
export const PersonSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id must be kebab-case'),
  name: nonEmpty,
  /** Living people get "Wer ist …?", others "Wer war …?". */
  alive: z.boolean(),
  /** Where the introduction card belongs in the feed. */
  area: nonEmpty,
  sub: nonEmpty,
  de: PersonTextSchema,
  en: PersonTextSchema,
});

export type PersonData = z.output<typeof PersonSchema>;
export type CardInput = z.input<typeof CardSchema>;
export type CardData = z.output<typeof CardSchema>;
export type CardText = CardData['de'];

