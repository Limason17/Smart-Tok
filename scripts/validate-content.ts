// Validates every card file. A broken card stops the build instead of the app.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CardSchema } from '../src/content/schema';
import { deriveCard, type Card } from '../src/content/card';
import { NEWS_AREA, newsMonth } from '../src/content/news';

const dir = join(import.meta.dirname, '..', 'content', 'cards');
const archiveDir = join(import.meta.dirname, '..', 'public', 'news-archive');
const errors: string[] = [];
const cards: Card[] = [];
const ids = new Map<string, string>();

// Card files first, then archived news (public/news-archive/YYYY-MM.json, see src/content/news.ts).
const files = [
  ...readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => ({ file: f, path: join(dir, f), archive: false })),
  ...(existsSync(archiveDir) ? readdirSync(archiveDir) : [])
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ file: `news-archive/${f}`, path: join(archiveDir, f), archive: true })),
];
let archivedCount = 0;

for (const { file, path, archive } of files) {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    errors.push(`${file}: invalid JSON (${(e as Error).message})`);
    continue;
  }
  if (!Array.isArray(raw)) {
    errors.push(`${file}: must contain an array of cards`);
    continue;
  }
  raw.forEach((item, i) => {
    const res = CardSchema.safeParse(item);
    const label = `${file}[${i}]${(item as { id?: string })?.id ? ` ${(item as { id: string }).id}` : ''}`;
    if (!res.success) {
      for (const issue of res.error.issues) errors.push(`${label}: ${issue.path.join('.')} ${issue.message}`);
      return;
    }
    const prev = ids.get(res.data.id);
    if (prev) errors.push(`${label}: duplicate id (also in ${prev})`);
    ids.set(res.data.id, file);
    if (archive) {
      if (res.data.area !== NEWS_AREA) errors.push(`${label}: only news cards belong in the archive`);
      else if (file !== `news-archive/${newsMonth(res.data.id)}.json`) errors.push(`${label}: belongs in news-archive/${newsMonth(res.data.id)}.json`);
      archivedCount++;
      return;
    }
    cards.push(deriveCard(res.data));
  });
}

if (errors.length) {
  console.error(`Content validation failed (${errors.length}):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

const count = (key: (c: Card) => string) =>
  Object.entries(cards.reduce<Record<string, number>>((m, c) => ((m[key(c)] = (m[key(c)] ?? 0) + 1), m), {}))
    .map(([k, v]) => `${k} ${v}`)
    .join(', ');
console.log(`✓ ${cards.length} cards valid${archivedCount ? ` (+${archivedCount} archived news)` : ''}`);
console.log(`  areas:   ${count((c) => c.area)}`);
console.log(`  styles:  ${count((c) => c.style)}`);
console.log(`  formats: ${count((c) => c.format)}`);
console.log(`  length:  ${count((c) => c.length)}`);
