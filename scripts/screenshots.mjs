// Screenshots of the built app on several phone sizes (run `npm run build` first with BASE_PATH=/).
// Uses the globally installed Playwright; not part of CI.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] ?? 'screenshots';
mkdirSync(out, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore', env: { ...process.env, BASE_PATH: '/' } });
await new Promise((r) => setTimeout(r, 2500));

const targets = [
  { name: 'iphone15promax', device: { ...devices['iPhone 15 Pro Max'] } },
  { name: 'iphone-se', device: { ...devices['iPhone SE'] } },
  { name: 'pixel7', device: { ...devices['Pixel 7'] } },
];
const lang = process.env.LANG_CODE ?? 'de';
const browser = await chromium.launch();
try {
  for (const t of targets) {
    const ctx = await browser.newContext({ ...t.device, locale: lang === 'de' ? 'de-CH' : 'en-US', serviceWorkers: 'block' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.error(`[${t.name}] page error:`, e.message));
    await page.goto('http://localhost:4173/');
    await page.waitForSelector('.card');
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/${t.name}-1-feed.png` });
    // next cards
    for (let i = 2; i <= 4; i++) {
      await page.evaluate(() => document.querySelector('.feed').scrollBy(0, window.innerHeight));
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${out}/${t.name}-${i}-feed.png` });
    }
    await page.click('.rail-btn >> nth=0');
    await page.waitForTimeout(300);
    await page.click('[aria-label="Themen"], [aria-label="Topics"]');
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${out}/${t.name}-5-topics.png` });
    await page.keyboard.press('Escape');
    await page.click('[aria-label="Einstellungen"], [aria-label="Settings"]');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/${t.name}-6-settings.png` });
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}
console.log('screenshots in', out);
