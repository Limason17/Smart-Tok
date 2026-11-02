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
    const shot = (name) => page.screenshot({ path: `${out}/${t.name}-${name}.png` });
    const next = () => page.click('.onb-actions .btn:last-child');
    // onboarding
    await page.waitForSelector('.onb');
    await page.waitForTimeout(400);
    await shot('0a-onboarding');
    await next();
    await page.waitForTimeout(400);
    await shot('0b-onboarding-topics');
    await next();
    await page.waitForTimeout(400);
    await shot('0c-onboarding-how');
    await next();
    // feed
    await page.waitForSelector('.card');
    await page.waitForTimeout(600);
    await shot('1-feed');
    for (let i = 2; i <= 4; i++) {
      await page.evaluate(() => document.querySelector('.feed').scrollBy(0, window.innerHeight));
      await page.waitForTimeout(1400);
      if (i === 3) await page.click('.rail-btn >> nth=2'); // save
      await shot(`${i}-feed`);
    }
    await page.click('.rail-btn >> nth=0'); // like
    await page.waitForTimeout(300);
    await page.click('[aria-label="Themen"], [aria-label="Topics"]');
    await page.waitForTimeout(900);
    await shot('5-topics');
    await page.keyboard.press('Escape');
    // profile
    await page.click('[aria-label="Profil"], [aria-label="Profile"]');
    await page.waitForTimeout(500);
    await page.click('.cal-day.today');
    await page.waitForTimeout(500);
    await shot('6-profile');
    await page.click('.sheet .segmented button >> nth=1');
    await page.waitForTimeout(300);
    await shot('7-saved');
    await page.click('.sheet .row >> nth=0');
    await page.waitForTimeout(500);
    await shot('8-card');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.click('.sheet .segmented button >> nth=2');
    await page.waitForTimeout(300);
    await shot('9-history');
    await page.click('.sheet .segmented button >> nth=3');
    await page.waitForTimeout(500);
    await shot('10-algorithm');
    await page.evaluate(() => document.querySelector('.sheet-body').scrollBy(0, 700));
    await page.waitForTimeout(300);
    await shot('11-algorithm-tweaks');
    await page.click('.sheet .segmented button >> nth=0');
    await page.click('.btn-row .btn.ghost');
    await page.waitForTimeout(500);
    await shot('12-settings');
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}
console.log('screenshots in', out);
