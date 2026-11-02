import { describe, expect, it } from 'vitest';
import { newsMonth } from './news';
import { CardSchema } from './schema';

const text = (title: string, source?: string) => ({ title, body: 'Ein kurzer Text.', source });
const news = (patch: Record<string, unknown> = {}) => ({
  id: 'news-2026-11-02-zinsentscheid',
  area: 'aktuelles',
  sub: 'wirtschaft',
  style: 'fakt',
  de: text('Zinsentscheid', 'Reuters, 2.11.2026'),
  en: text('Rate decision', 'Reuters, Nov 2, 2026'),
  publishedAt: '2026-11-02T06:00:00Z',
  expiresAt: '2026-11-07T06:00:00Z',
  ...patch,
});
const problems = (input: unknown) => {
  const res = CardSchema.safeParse(input);
  return res.success ? [] : res.error.issues.map((i) => i.message);
};

describe('news cards', () => {
  it('accepts a dated, sourced news card', () => {
    expect(problems(news())).toEqual([]);
    expect(newsMonth('news-2026-11-02-zinsentscheid')).toBe('2026-11');
    expect(newsMonth('stoiker-1')).toBeNull();
  });

  it('rejects news without dates, with a long life, a wrong id or no source', () => {
    expect(problems(news({ expiresAt: undefined }))).toContain('news needs publishedAt and expiresAt');
    expect(problems(news({ expiresAt: '2026-11-12T06:00:00Z' }))).toContain('news must expire within 7 days');
    expect(problems(news({ id: 'zinsentscheid' }))).toContain('news id must look like news-YYYY-MM-DD-topic');
    expect(problems(news({ id: 'news-2026-11-01-zinsentscheid' }))).toContain('news id date must match publishedAt');
    expect(problems(news({ en: text('Rate decision') }))).toContain('en: news needs a source');
  });
});
