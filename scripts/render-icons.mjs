// Renders the app icons from assets/icon.svg with the preinstalled Chromium.
import { createRequire } from 'node:module';
// Uses the globally installed Playwright (not a project dependency).
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../assets/icon.svg', import.meta.url), 'utf8');
// Maskable icons need the mark inside the central 80 % safe zone.
const maskable = svg.replace('<g id="mark">', '<g id="mark" transform="translate(256 256) scale(0.8) translate(-256 -256)">');

const targets = [
  { file: 'public/icon-512.png', size: 512, src: svg },
  { file: 'public/icon-192.png', size: 192, src: svg },
  { file: 'public/apple-touch-icon.png', size: 180, src: svg },
  { file: 'public/icon-maskable-512.png', size: 512, src: maskable },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${t.size}px;height:${t.size}px}</style>${t.src}`);
  await page.screenshot({ path: t.file, omitBackground: false });
  console.log('wrote', t.file);
}
await browser.close();
