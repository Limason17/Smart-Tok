// Draws every content/figures/<name>.json into <name>.svg (see src/content/figure-kit.ts).
//   npm run figures
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderFigure, type FigureSpec } from '../src/content/figure-kit';

const dir = join(import.meta.dirname, '..', 'content', 'figures');
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const spec = JSON.parse(readFileSync(join(dir, f), 'utf8')) as FigureSpec;
  writeFileSync(join(dir, f.replace(/\.json$/, '.svg')), renderFigure(spec, f));
  console.log(`✓ ${f}`);
}
