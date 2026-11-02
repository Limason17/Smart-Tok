// End-to-end test of accounts and sync against the Firebase emulators (not part of CI):
// 1. firebase emulators:start --project demo-smarttok --only auth,firestore
// 2. BASE_PATH=/ VITE_FIREBASE_EMULATOR=127.0.0.1 \
//    VITE_FIREBASE_CONFIG='{"apiKey":"demo","authDomain":"demo-smarttok.firebaseapp.com","projectId":"demo-smarttok","appId":"1:1:web:1"}' \
//    npx vite build --outDir dist-emu
// 3. node scripts/e2e-sync.mjs
// Two simulated phones: A reads and saves cards, signs up; B signs in and must see the same history.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const dist = process.argv[2] ?? 'dist-emu';
const out = process.argv[3] ?? 'screenshots/sync';
mkdirSync(out, { recursive: true });
const server = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort', '--outDir', dist], { stdio: 'ignore', env: { ...process.env, BASE_PATH: '/' } });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch();
const log = (...a) => console.log(...a);
async function device(name) {
  const ctx = await browser.newContext({ ...devices['iPhone 15 Pro Max'], locale: 'de-CH', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log(`[${name}] page error`, e.message));
  page.on('console', (m) => m.type() === 'warning' || m.type() === 'error' ? log(`[${name}] console`, m.text()) : null);
  await page.goto('http://localhost:4174/');
  await page.waitForSelector('.onb');
  for (let i = 0; i < 3; i++) await page.click('.onb-actions .btn:last-child');
  await page.waitForSelector('.card');
  return { ctx, page };
}
const openAccount = async (page) => {
  await page.click('[aria-label="Profil"]');
  await page.waitForTimeout(400);
  await page.click('.account-card .btn, .account-card.signed-in');
  await page.waitForTimeout(400);
};
try {
  // Device A: read, react, sign up
  const A = await device('A');
  for (let i = 0; i < 4; i++) {
    await A.page.waitForTimeout(1500);
    if (i === 1) await A.page.click('.rail-btn >> nth=2');
    if (i === 2) await A.page.click('.rail-btn >> nth=0');
    await A.page.evaluate(() => document.querySelector('.feed').scrollBy(0, window.innerHeight));
  }
  await A.page.waitForTimeout(1500);
  await openAccount(A.page);
  await A.page.screenshot({ path: `${out}/a1-signin.png` });
  await A.page.click('text=Noch kein Konto? Erstellen');
  await A.page.fill('input[autocomplete=nickname]', 'Liam');
  await A.page.fill('input[type=email]', 'liam@example.com');
  await A.page.fill('input[type=password]', '123456');
  await A.page.screenshot({ path: `${out}/a2-signup.png` });
  await A.page.click('button[type=submit]');
  await A.page.waitForSelector('.account-head', { timeout: 15000 });
  await A.page.waitForSelector('.sync.ok', { timeout: 15000 });
  await A.page.screenshot({ path: `${out}/a3-signed-in.png` });
  const stateA = await A.page.evaluate(() => [...document.querySelectorAll('.sync')].map((e) => e.textContent));
  log('A sync line', stateA);
  // Firestore doc as admin
  const docs = await (await fetch('http://127.0.0.1:8080/v1/projects/demo-smarttok/databases/(default)/documents/users', { headers: { Authorization: 'Bearer owner' } })).json();
  const d = docs.documents?.[0];
  log('docs in users:', docs.documents?.length, 'name:', d?.fields?.name?.stringValue, 'cards:', Object.keys(d?.fields?.cards?.mapValue?.fields ?? {}).length);
  // Unauthenticated read must be denied
  const anon = await fetch(`http://127.0.0.1:8080/v1/${d.name}`);
  log('anonymous read status:', anon.status);
  // Device B: sign in, history arrives
  const B = await device('B');
  await openAccount(B.page);
  await B.page.fill('input[type=email]', 'liam@example.com');
  await B.page.fill('input[type=password]', 'falsch1');
  await B.page.click('button[type=submit]');
  await B.page.waitForSelector('.form-error', { timeout: 15000 });
  log('wrong password:', await B.page.textContent('.form-error'));
  await B.page.fill('input[type=password]', '123456');
  await B.page.click('button[type=submit]');
  await B.page.waitForSelector('.sync.ok', { timeout: 15000 });
  await B.page.keyboard.press('Escape');
  await B.page.waitForTimeout(400);
  const statsB = await B.page.evaluate(() => [...document.querySelectorAll('.stat b')].map((e) => e.textContent));
  log('B stats after sign-in:', statsB);
  await B.page.screenshot({ path: `${out}/b1-profile.png` });
  await B.page.click('.sheet .segmented button >> nth=1');
  await B.page.waitForTimeout(300);
  log('B saved rows:', await B.page.locator('.sheet .row').count());
  await B.page.screenshot({ path: `${out}/b2-saved.png` });
  // Sign out clears device B
  B.page.on('dialog', (dlg) => dlg.accept());
  await B.page.click('.sheet .segmented button >> nth=0');
  await B.page.click('.account-card.signed-in');
  await B.page.waitForTimeout(300);
  await B.page.click('text=Abmelden');
  await B.page.waitForTimeout(2000);
  await B.page.click('[aria-label="Profil"]').catch(() => {});
  await B.page.waitForTimeout(400);
  log('B stats after sign-out:', await B.page.evaluate(() => [...document.querySelectorAll('.stat b')].map((e) => e.textContent)));
  await B.page.screenshot({ path: `${out}/b3-signed-out.png` });
} finally {
  await browser.close();
  server.kill();
}
