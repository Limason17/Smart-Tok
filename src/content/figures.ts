// The figure files, bundled as text (see figure-mark.ts for the format).
import { localiseSvg } from './figure-mark';
import type { Lang } from './taxonomy';

export { parseFigure } from './figure-mark';

const files = import.meta.glob<string>('../../content/figures/*.svg', { eager: true, query: '?raw', import: 'default' });

const cache = new Map<string, string>();

export function figureSvg(name: string, lang: Lang): string | null {
  const key = `${lang}:${name}`;
  if (cache.has(key)) return cache.get(key)!;
  const raw = files[`../../content/figures/${name}.svg`];
  if (!raw) return null;
  const out = localiseSvg(raw, lang);
  cache.set(key, out);
  return out;
}
