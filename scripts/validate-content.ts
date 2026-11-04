// Validates every card file. A broken card stops the build instead of the app.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CardSchema, PersonSchema, type PersonData } from '../src/content/schema';
import { introCard } from '../src/content/people';
import { deriveCard, type Card } from '../src/content/card';
import { NEWS_AREA, newsMonth } from '../src/content/news';
import { LEGAL, OWNER } from '../src/content/legal';
import { parseFigure } from '../src/content/figure-mark';
import { renderFigure, type FigureSpec } from '../src/content/figure-kit';

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

// Figures: every [[fig:name]] exists, is used in both languages, and is a safe, self-contained SVG.
const figDir = join(import.meta.dirname, '..', 'content', 'figures');
const figFiles = new Set(existsSync(figDir) ? readdirSync(figDir).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)) : []);
const usedFigures = new Set<string>();
const figuresIn = (text: string | undefined) =>
  (text ?? '')
    .split(/\n{2,}/)
    .map((p) => parseFigure(p))
    .filter((f): f is NonNullable<typeof f> => !!f)
    .map((f) => f.name);
for (const c of cards) {
  const texts = [c, ...(c.slides ?? [])];
  for (const t of texts) {
    const de = [...figuresIn(t.de.body), ...figuresIn(t.de.deep)];
    const en = [...figuresIn(t.en.body), ...figuresIn(t.en.deep)];
    if (de.join() !== en.join()) errors.push(`${c.id}: figures differ between de and en (${de.join() || '–'} / ${en.join() || '–'})`);
    for (const f of de) {
      usedFigures.add(f);
      if (!figFiles.has(f)) errors.push(`${c.id}: figure "${f}" not found in content/figures`);
    }
  }
  const stray = JSON.stringify([c.de, c.en]).match(/\[\[fig[^\]]*\]\]/g)?.filter((m) => !parseFigure(m)) ?? [];
  if (stray.length) errors.push(`${c.id}: malformed figure mark ${stray[0]} (use [[fig:name]] alone in its paragraph)`);
}
for (const name of figFiles) {
  const svg = readFileSync(join(figDir, `${name}.svg`), 'utf8');
  const label = `content/figures/${name}.svg`;
  if (!usedFigures.has(name)) errors.push(`${label}: not used by any card`);
  const specPath = join(figDir, `${name}.json`);
  if (existsSync(specPath)) {
    try {
      if (renderFigure(JSON.parse(readFileSync(specPath, 'utf8')) as FigureSpec, `${name}.json`) !== svg) errors.push(`${label}: out of date, run npm run figures`);
    } catch (e) {
      errors.push(`content/figures/${name}.json: ${(e as Error).message}`);
    }
  }
  if (!/^\s*(<\?xml[^>]*>\s*)?<svg[^>]*\sviewBox="[^"]+"/.test(svg)) errors.push(`${label}: must start with <svg ... viewBox="...">`);
  if (/<script|<foreignObject|<image|\son[a-z]+\s*=|javascript:|(?:xlink:)?href\s*=\s*"(?!#)|url\((?!#)|@import/i.test(svg))
    errors.push(`${label}: scripts, event handlers, images and external references are not allowed`);
  if (/\s(width|height)="[^"]*"[^>]*>/.test(svg.slice(0, svg.indexOf('>') + 1))) errors.push(`${label}: no width/height on <svg>, the card sizes it`);
  for (const m of svg.matchAll(/<(text|tspan)\b([^>]*)>([^<]*)</g)) {
    if (/\p{L}{2,}/u.test(m[3]) && !/\sdata-en="[^"]+"/.test(m[2])) errors.push(`${label}: label "${m[3].trim()}" needs data-en`);
  }
  if (svg.length > 12_000) errors.push(`${label}: larger than 12 KB, keep figures simple`);
}

// Privacy notice: a real contact person and both languages complete.
if (OWNER.name.includes('{{') || !OWNER.name.trim()) errors.push('src/content/legal.ts: OWNER.name is not filled in');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(OWNER.email)) errors.push('src/content/legal.ts: OWNER.email is not a valid email address');
if (LEGAL.de.length !== LEGAL.en.length) errors.push('src/content/legal.ts: German and English have a different number of sections');

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
if (figFiles.size) console.log(`  figures: ${figFiles.size}`);
