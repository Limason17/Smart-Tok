// Housekeeping for news cards ("Aktuelles"), run by the routine before it writes new cards.
//   npx tsx scripts/routine/news.ts prune [--now 2026-11-02T06:00:00Z]
// Moves expired cards from content/cards/aktuelles.json to public/news-archive/YYYY-MM.json,
// where saved news cards stay readable in the profile. Prints what it did.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { newsMonth } from '../../src/content/news';
import type { CardInput } from '../../src/content/card';

const root = join(import.meta.dirname, '..', '..');
const liveFile = join(root, 'content', 'cards', 'aktuelles.json');
const archiveDir = join(root, 'public', 'news-archive');

const readJson = (file: string): CardInput[] => (existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as CardInput[]) : []);
const writeJson = (file: string, cards: CardInput[]) => writeFileSync(file, JSON.stringify(cards, null, 2) + '\n');

export function prune(now: number) {
  const live = readJson(liveFile);
  const keep: CardInput[] = [];
  const byMonth = new Map<string, CardInput[]>();
  for (const card of live) {
    const expires = Date.parse(card.expiresAt ?? '');
    const month = newsMonth(card.id);
    if (!month || Number.isNaN(expires) || expires > now) {
      keep.push(card);
      continue;
    }
    byMonth.set(month, [...(byMonth.get(month) ?? []), card]);
  }
  for (const [month, cards] of byMonth) {
    const file = join(archiveDir, `${month}.json`);
    const archived = readJson(file);
    const ids = new Set(archived.map((c) => c.id));
    writeJson(file, [...archived, ...cards.filter((c) => !ids.has(c.id))].sort((a, b) => a.id.localeCompare(b.id)));
  }
  if (keep.length !== live.length) writeJson(liveFile, keep);
  const moved = [...byMonth.values()].flat().map((c) => c.id);
  console.log(`news: ${keep.length} live, ${moved.length} archived${moved.length ? `: ${moved.join(', ')}` : ''}`);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'prune') {
  const at = args.indexOf('--now');
  prune(at >= 0 ? Date.parse(args[at + 1]) : Date.now());
} else {
  console.error('usage: tsx scripts/routine/news.ts prune [--now ISO]');
  process.exit(1);
}
