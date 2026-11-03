// Validates every card file. A broken card stops the build instead of the app.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CardSchema, PersonSchema, type PersonData } from '../src/content/schema';
import { introCard } from '../src/content/people';
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

// People: each gets an introduction card (built from the profile, validated like any card).
const people = new Map<string, PersonData>();
let rawPeople: unknown = [];
try {
  rawPeople = JSON.parse(readFileSync(join(dir, '..', 'people.json'), 'utf8'));
} catch (e) {
  errors.push(`people.json: invalid JSON (${(e as Error).message})`);
}
(Array.isArray(rawPeople) ? rawPeople : []).forEach((item, i) => {
  const res = PersonSchema.safeParse(item);
  const label = `people.json[${i}]${(item as { id?: string })?.id ? ` ${(item as { id: string }).id}` : ''}`;
  if (!res.success) {
    for (const issue of res.error.issues) errors.push(`${label}: ${issue.path.join('.')} ${issue.message}`);
    return;
  }
  if (people.has(res.data.id)) errors.push(`${label}: duplicate person id`);
  people.set(res.data.id, res.data);
  const intro = CardSchema.safeParse(introCard(res.data));
  if (!intro.success) {
    for (const issue of intro.error.issues) errors.push(`${label} (introduction card): ${issue.path.join('.')} ${issue.message}`);
    return;
  }
  if (ids.has(intro.data.id)) errors.push(`${label}: introduction id ${intro.data.id} already used by a card`);
  ids.set(intro.data.id, 'people.json');
  cards.push(deriveCard(intro.data));
});
for (const c of cards) {
  for (const p of c.people ?? []) if (!people.has(p)) errors.push(`${c.id}: unknown person "${p}"`);
  if (new Set(c.people ?? []).size !== (c.people ?? []).length) errors.push(`${c.id}: person listed twice`);
}

if (errors.length) {
  console.error(`Content validation failed (${errors.length}):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

const count = (key: (c: Card) => string) =>
  Object.entries(cards.reduce<Record<string, number>>((m, c) => ((m[key(c)] = (m[key(c)] ?? 0) + 1), m), {}))
    .map(([k, v]) => `${k} ${v}`)
    .join(', ');
console.log(`✓ ${cards.length} cards valid, ${people.size} people${archivedCount ? ` (+${archivedCount} archived news)` : ''}`);
console.log(`  areas:   ${count((c) => c.area)}`);
console.log(`  styles:  ${count((c) => c.style)}`);
console.log(`  formats: ${count((c) => c.format)}`);
console.log(`  length:  ${count((c) => c.length)}`);
