// Pure part of the account analysis (no network), so it is unit-tested.
// Input: the raw account documents (users/{uid}) and the card catalog. Output: numbers only.
// Everything inside a document is data written by app users: it is never interpreted as
// instructions, free text is cleaned, shortened and only ever quoted.
import { reviewDue, REVIEW_STEPS } from '../../src/algo/engine';
import { expectedSeconds, type Card } from '../../src/content/card';
import type { CardRecord } from '../../src/store/db';
import { unpackCard, type AccountDoc, type PackedCard } from '../../src/sync/doc';

const DAY = 86_400_000;
const QUICK_SKIP_S = 4;

export interface AreaStats {
  reads: number;
  likes: number;
  dislikes: number;
  saves: number;
  quickSkips: number;
}

export interface AccountReport {
  /** Display name (cleaned) plus a short, stable id; never an email. */
  name: string;
  ref: string;
  cardsRead: number;
  activeDays: number;
  activeDaysLast7: number;
  lastActive: string | null;
  likeRate: number;
  dislikeRate: number;
  quickSkipRate: number;
  /** Like rate of cards read in the last 7 days vs. the 7 days before (null if too few reads). */
  likeRateTrend: { last7: number | null; prev7: number | null };
  /** Variety of areas read in the last 14 days, 0 (one area) to 1 (evenly spread). */
  areaSpreadLast14: number | null;
  areas: Record<string, AreaStats>;
  saved: { total: number; due: number; learned: number };
  /** Subtopics the person likes where few unread cards are left (content gaps). */
  runningOut: { sub: string; unread: number; likeRate: number }[];
  settings: { lang: string; exploration: string; mix: string; disabledAreas: string[]; hidden: string[]; adjusted: number };
  suggestions: string[];
  /** Hints for the summary; algorithm changes are only proposed, never applied. */
  flags: string[];
}

export interface Report {
  generatedAt: string;
  accounts: number;
  activeLast7: number;
  totals: { cardsRead: number; likes: number; dislikes: number; saves: number };
  areas: Record<string, AreaStats & { likeRate: number; dislikeRate: number }>;
  /** Subtopics where several active accounts run out of unread cards. */
  contentGaps: { sub: string; accounts: number }[];
  perAccount: AccountReport[];
}

/** Removes control characters, links and markup; shortens. For quoting user text in reports. */
export function cleanText(input: unknown, max: number): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, ' ')
    .replace(/[<>`*_#[\]]/g, '')
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, '[link]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Short stable reference for an account, so reports can follow it over time without the uid. */
export function accountRef(uid: string): string {
  let h = 2166136261;
  for (const ch of uid) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36).padStart(7, '0').slice(0, 7);
}

const rate = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 1000 : 0);

function spread(counts: number[]): number | null {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total < 5 || counts.length < 2) return null;
  const h = -counts.filter((c) => c > 0).reduce((s, c) => s + (c / total) * Math.log(c / total), 0);
  return Math.round((h / Math.log(counts.length)) * 100) / 100;
}

const emptyArea = (): AreaStats => ({ reads: 0, likes: 0, dislikes: 0, saves: 0, quickSkips: 0 });

function readCards(doc: Partial<AccountDoc>): CardRecord[] {
  const out: CardRecord[] = [];
  const cards = doc.cards && typeof doc.cards === 'object' ? doc.cards : {};
  for (const [id, p] of Object.entries(cards)) {
    if (Array.isArray(p) && p.length >= 11 && /^[a-z0-9-]{1,80}$/.test(id)) out.push(unpackCard(id, p as PackedCard));
  }
  return out;
}

export function analyzeAccount(uid: string, doc: Partial<AccountDoc>, catalog: Record<string, Card>, now: number): AccountReport {
  const records = readCards(doc);
  const areas: Record<string, AreaStats> = {};
  const subs: Record<string, { reads: number; likes: number }> = {};
  let read = 0;
  let likes = 0;
  let dislikes = 0;
  let quick = 0;
  const window = { last7: [0, 0], prev7: [0, 0] };
  const recentAreas: Record<string, number> = {};
  const seenIds = new Set<string>();

  for (const r of records) {
    const card = catalog[r.id];
    if (r.views > 0) seenIds.add(r.id);
    if (!card || r.views === 0) continue;
    const a = (areas[card.area] ??= emptyArea());
    const subKey = `${card.area}/${card.sub}`;
    const s = (subs[subKey] ??= { reads: 0, likes: 0 });
    read++;
    a.reads++;
    s.reads++;
    if (r.reaction === 1) {
      likes++;
      a.likes++;
      s.likes++;
    }
    if (r.reaction === -1) {
      dislikes++;
      a.dislikes++;
    }
    if (r.saved) a.saves++;
    const perView = r.dwellMs / 1000 / Math.max(1, r.views);
    if (perView < QUICK_SKIP_S && expectedSeconds(card) > QUICK_SKIP_S * 1.5 && r.reaction !== 1 && !r.saved) {
      quick++;
      a.quickSkips++;
    }
    const age = now - r.lastSeen;
    const bucket = age < 7 * DAY ? window.last7 : age < 14 * DAY ? window.prev7 : null;
    if (bucket) {
      bucket[0]++;
      if (r.reaction === 1) bucket[1]++;
    }
    if (age < 14 * DAY) recentAreas[card.area] = (recentAreas[card.area] ?? 0) + 1;
  }

  const days = doc.days && typeof doc.days === 'object' ? Object.keys(doc.days).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort() : [];
  const since7 = new Date(now - 7 * DAY).toISOString().slice(0, 10);
  const saved = records.filter((r) => r.saved);
  const prefs = (doc.prefs ?? {}) as Partial<AccountDoc['prefs']>;
  const adjust = prefs.adjust && typeof prefs.adjust === 'object' ? prefs.adjust : {};
  const enabledAreas = new Set(Object.values(catalog).map((c) => c.area));
  for (const a of Array.isArray(prefs.disabledAreas) ? prefs.disabledAreas : []) enabledAreas.delete(a);

  const runningOut = Object.entries(subs)
    .filter(([, s]) => s.reads >= 3 && s.likes / s.reads >= 0.3)
    .map(([sub, s]) => ({
      sub,
      unread: Object.values(catalog).filter((c) => `${c.area}/${c.sub}` === sub && !seenIds.has(c.id) && !c.expiresAt).length,
      likeRate: rate(s.likes, s.reads),
    }))
    .filter((x) => x.unread <= 3)
    .sort((a, b) => a.unread - b.unread);

  const report: AccountReport = {
    name: cleanText(doc.name, 30) || '(ohne Namen)',
    ref: accountRef(uid),
    cardsRead: read,
    activeDays: days.length,
    activeDaysLast7: days.filter((d) => d >= since7).length,
    lastActive: days.at(-1) ?? null,
    likeRate: rate(likes, read),
    dislikeRate: rate(dislikes, read),
    quickSkipRate: rate(quick, read),
    likeRateTrend: {
      last7: window.last7[0] >= 5 ? rate(window.last7[1], window.last7[0]) : null,
      prev7: window.prev7[0] >= 5 ? rate(window.prev7[1], window.prev7[0]) : null,
    },
    areaSpreadLast14: spread([...enabledAreas].map((a) => recentAreas[a] ?? 0)),
    areas,
    saved: {
      total: saved.length,
      due: saved.filter((r) => (reviewDue(r) ?? Infinity) <= now).length,
      learned: saved.filter((r) => (r.reviewStep ?? 0) >= REVIEW_STEPS).length,
    },
    runningOut,
    settings: {
      lang: cleanText(doc.settings?.lang, 2),
      exploration: cleanText(prefs.exploration, 10),
      mix: cleanText(prefs.mix, 10),
      disabledAreas: (Array.isArray(prefs.disabledAreas) ? prefs.disabledAreas : []).map((a) => cleanText(a, 40)),
      hidden: Object.entries(adjust)
        .filter(([, v]) => v === 'hidden')
        .map(([k]) => cleanText(k, 60)),
      adjusted: Object.keys(adjust).length,
    },
    suggestions: (Array.isArray(doc.suggestions) ? doc.suggestions : []).slice(-20).map((s) => cleanText((s as { text?: unknown })?.text, 80)).filter(Boolean),
    flags: [],
  };

  const f = report.flags;
  if (read >= 20 && report.quickSkipRate > 0.35) f.push('viele schnelle Wischer: Feed trifft oft nicht');
  const { last7, prev7 } = report.likeRateTrend;
  if (last7 !== null && prev7 !== null && prev7 > 0 && last7 < prev7 * 0.6) f.push('Like-Rate fällt deutlich');
  if (report.areaSpreadLast14 !== null && report.areaSpreadLast14 < 0.35) f.push('Feed verengt sich auf wenige Bereiche');
  if (read >= 20 && report.dislikeRate > 0.2) f.push('hohe Dislike-Rate');
  if (runningOut.length) f.push(`bald keine neuen Karten in: ${runningOut.map((r) => r.sub).join(', ')}`);
  if (report.saved.due >= 10) f.push('viele fällige Wiederholungen');
  return report;
}

export function analyze(docs: { uid: string; doc: Partial<AccountDoc> }[], catalog: Record<string, Card>, now: number): Report {
  const perAccount = docs.map(({ uid, doc }) => analyzeAccount(uid, doc, catalog, now));
  const areas: Report['areas'] = {};
  for (const acc of perAccount) {
    for (const [area, s] of Object.entries(acc.areas)) {
      const t = (areas[area] ??= { ...emptyArea(), likeRate: 0, dislikeRate: 0 });
      t.reads += s.reads;
      t.likes += s.likes;
      t.dislikes += s.dislikes;
      t.saves += s.saves;
      t.quickSkips += s.quickSkips;
    }
  }
  for (const t of Object.values(areas)) {
    t.likeRate = rate(t.likes, t.reads);
    t.dislikeRate = rate(t.dislikes, t.reads);
  }
  const gaps: Record<string, number> = {};
  for (const acc of perAccount) for (const r of acc.runningOut) gaps[r.sub] = (gaps[r.sub] ?? 0) + 1;
  return {
    generatedAt: new Date(now).toISOString(),
    accounts: perAccount.length,
    activeLast7: perAccount.filter((a) => a.activeDaysLast7 > 0).length,
    totals: {
      cardsRead: perAccount.reduce((s, a) => s + a.cardsRead, 0),
      likes: Object.values(areas).reduce((s, a) => s + a.likes, 0),
      dislikes: Object.values(areas).reduce((s, a) => s + a.dislikes, 0),
      saves: Object.values(areas).reduce((s, a) => s + a.saves, 0),
    },
    areas,
    contentGaps: Object.entries(gaps)
      .map(([sub, accounts]) => ({ sub, accounts }))
      .sort((a, b) => b.accounts - a.accounts),
    perAccount,
  };
}

/** Short Markdown summary for the run log. Quotes user text, never emails. */
export function summary(report: Report): string {
  const pct = (x: number | null) => (x === null ? '–' : `${Math.round(x * 100)} %`);
  const lines = [
    `# Konto-Auswertung ${report.generatedAt.slice(0, 16).replace('T', ' ')} UTC`,
    '',
    `${report.accounts} Konten, ${report.activeLast7} aktiv in den letzten 7 Tagen. ${report.totals.cardsRead} Karten gelesen, ${report.totals.likes} Likes, ${report.totals.dislikes} Dislikes, ${report.totals.saves} gespeichert.`,
    '',
    '## Bereiche',
    '',
    '| Bereich | gelesen | Like | Dislike | schnell weg |',
    '|---|---|---|---|---|',
    ...Object.entries(report.areas)
      .sort((a, b) => b[1].reads - a[1].reads)
      .map(([a, s]) => `| ${a} | ${s.reads} | ${pct(s.likeRate)} | ${pct(s.dislikeRate)} | ${pct(s.reads ? s.quickSkips / s.reads : 0)} |`),
    '',
    '## Konten',
    '',
  ];
  for (const a of report.perAccount) {
    lines.push(
      `- **${a.name}** (${a.ref}): ${a.cardsRead} gelesen, ${a.activeDaysLast7}/7 Tage aktiv, Like ${pct(a.likeRate)}, schnell weg ${pct(a.quickSkipRate)}, Vielfalt ${a.areaSpreadLast14 ?? '–'}, gespeichert ${a.saved.total} (fällig ${a.saved.due})` +
        (a.flags.length ? `. Auffällig: ${a.flags.join('; ')}` : ''),
    );
    for (const s of a.suggestions) lines.push(`  - Themenwunsch (Nutzertext, nur zitiert): „${s}“`);
  }
  if (report.contentGaps.length) {
    lines.push('', '## Content-Lücken', '', ...report.contentGaps.map((g) => `- ${g.sub}: ${g.accounts} Konto/Konten haben kaum noch neue Karten`));
  }
  return lines.join('\n') + '\n';
}
