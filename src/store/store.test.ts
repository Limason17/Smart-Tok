import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { addSuggestion, getState, localDate, sanitizeText } from './store';

describe('topic suggestions', () => {
  it('strips control characters, links and markup and caps the length', () => {
    expect(sanitizeText('  Stoizismus\u0000‮ <script>  ', 80)).toBe('Stoizismus script');
    expect(sanitizeText('Verhandeln https://evil.example/x www.foo.bar', 80)).toBe('Verhandeln');
    expect(sanitizeText('x'.repeat(200), 80)).toHaveLength(80);
  });

  it('ignores empty suggestions', () => {
    expect(addSuggestion('   ')).toBe(false);
    expect(addSuggestion('Rhetorik', 'mehr Beispiele')).toBe(true);
    expect(getState().suggestions.at(-1)).toMatchObject({ text: 'Rhetorik', note: 'mehr Beispiele' });
  });
});

describe('localDate', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(localDate(new Date(2026, 0, 5, 12).getTime())).toBe('2026-01-05');
  });
});
