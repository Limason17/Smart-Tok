// Read-only account analysis for the routine (docs/routine.md).
//   npx tsx scripts/routine/analyze.ts --out <folder>            reads all accounts from Firestore
//   npx tsx scripts/routine/analyze.ts --input docs.json --out <folder>   reads a local copy instead
// Signs in as the analysis account (SMARTTOK_ANALYSIS_EMAIL / SMARTTOK_ANALYSIS_PASSWORD), which the
// Firestore rules allow to read, never to write. Writes report.json and summary.md to <folder>.
// Never write the output into the repository: it is about real people.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deriveCard, type Card, type CardData } from '../../src/content/card';
import { FIREBASE_CONFIG } from '../../src/sync/config';
import type { AccountDoc } from '../../src/sync/doc';
import { analyze, summary } from './analyze-core';

const root = join(import.meta.dirname, '..', '..');

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function catalog(): Record<string, Card> {
  const out: Record<string, Card> = {};
  const dirs = [join(root, 'content', 'cards'), join(root, 'public', 'news-archive')];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      for (const c of JSON.parse(readFileSync(join(dir, f), 'utf8')) as CardData[]) out[c.id] = deriveCard({ ...c, level: c.level ?? 1 });
    }
  }
  return out;
}

// Firestore REST returns typed values ({stringValue: ...}); turn them into plain JSON.
type FsValue = Record<string, unknown>;
function plain(v: FsValue): unknown {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (((v.arrayValue as { values?: FsValue[] }).values ?? []) as FsValue[]).map(plain);
  if ('mapValue' in v) return fields((v.mapValue as { fields?: Record<string, FsValue> }).fields ?? {});
  return null;
}
const fields = (f: Record<string, FsValue>) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, plain(v)]));

// Local test against the Firebase emulators only: SMARTTOK_EMULATOR=127.0.0.1
const emulator = process.env.SMARTTOK_EMULATOR;
const authUrl = emulator ? `http://${emulator}:9099/identitytoolkit.googleapis.com` : 'https://identitytoolkit.googleapis.com';
const storeUrl = emulator ? `http://${emulator}:8080` : 'https://firestore.googleapis.com';

async function fetchAll(): Promise<{ uid: string; doc: Partial<AccountDoc> }[]> {
  const email = process.env.SMARTTOK_ANALYSIS_EMAIL;
  const password = process.env.SMARTTOK_ANALYSIS_PASSWORD;
  if (!email || !password || !FIREBASE_CONFIG) throw new Error('SMARTTOK_ANALYSIS_EMAIL and SMARTTOK_ANALYSIS_PASSWORD must be set');
  const auth = await fetch(`${authUrl}/v1/accounts:signInWithPassword?key=${FIREBASE_CONFIG.apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const session = (await auth.json()) as { idToken?: string; localId?: string; error?: { message: string } };
  if (!session.idToken) throw new Error(`sign-in failed: ${session.error?.message ?? auth.status}`);
  console.log(`signed in as analysis account (uid ${session.localId})`);

  const project = emulator ? 'demo-smarttok' : FIREBASE_CONFIG.projectId;
  const base = `${storeUrl}/v1/projects/${project}/databases/(default)/documents/users`;
  const out: { uid: string; doc: Partial<AccountDoc> }[] = [];
  let pageToken = '';
  do {
    const res = await fetch(`${base}?pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, {
      headers: { authorization: `Bearer ${session.idToken}` },
    });
    const page = (await res.json()) as { documents?: { name: string; fields?: Record<string, FsValue> }[]; nextPageToken?: string; error?: { message: string } };
    if (!res.ok) throw new Error(`reading accounts failed: ${page.error?.message ?? res.status}`);
    for (const d of page.documents ?? []) {
      const uid = d.name.split('/').pop()!;
      if (uid !== session.localId) out.push({ uid, doc: fields(d.fields ?? {}) as Partial<AccountDoc> });
    }
    pageToken = page.nextPageToken ?? '';
  } while (pageToken);
  return out;
}

const outDir = arg('--out');
if (!outDir) {
  console.error('usage: tsx scripts/routine/analyze.ts --out <folder> [--input docs.json]');
  process.exit(1);
}
const input = arg('--input');
const docs = input ? (JSON.parse(readFileSync(input, 'utf8')) as { uid: string; doc: Partial<AccountDoc> }[]) : await fetchAll();
const report = analyze(docs, catalog(), Date.now());
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
writeFileSync(join(outDir, 'summary.md'), summary(report));
console.log(`analysed ${report.accounts} accounts → ${outDir}/summary.md`);
