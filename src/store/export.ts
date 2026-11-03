import { CARD_BY_ID } from '../content';
import { allEvents, getState } from './store';

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const stamp = () => new Date().toISOString().slice(0, 10);
const iso = (t?: number) => (t ? new Date(t).toISOString() : '');

export async function buildExport() {
  const s = getState();
  const history = Object.values(s.cards)
    .filter((r) => r.views > 0 || r.saved || r.planAt || r.reaction !== 0)
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .map((r) => {
      const card = CARD_BY_ID[r.id];
      return {
        card: r.id,
        title: card?.[s.settings.lang].title ?? '',
        area: card?.area ?? '',
        sub: card?.sub ?? '',
        style: card?.style ?? '',
        format: card?.format ?? '',
        lang: r.lang,
        firstSeen: iso(r.firstSeen),
        lastSeen: iso(r.lastSeen),
        views: r.views,
        dwellSeconds: Math.round(r.dwellMs / 1000),
        reaction: r.reaction === 1 ? 'like' : r.reaction === -1 ? 'dislike' : '',
        saved: r.saved,
        toApply: r.planAt ? (r.planDone ? 'done' : 'open') : '',
        toApplySince: iso(r.planAt),
        appliedAt: iso(r.planDone),
        moreOpened: r.more,
        shared: r.shared,
      };
    });
  return {
    app: 'smart-tok',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: s.settings,
    topics: s.prefs,
    suggestions: s.suggestions.map((x) => ({ text: x.text, note: x.note ?? '', createdAt: iso(x.createdAt) })),
    days: s.days,
    algorithm: s.algo,
    history,
    events: await allEvents(),
  };
}

export async function downloadJson() {
  const data = await buildExport();
  download(`smart-tok-${stamp()}.json`, JSON.stringify(data, null, 2), 'application/json');
}

function csvCell(v: unknown): string {
  const str = String(v ?? '');
  return /[",\n;]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export async function downloadCsv() {
  const data = await buildExport();
  const cols = Object.keys(data.history[0] ?? { card: '' });
  const rows = [cols.join(','), ...data.history.map((h) => cols.map((c) => csvCell((h as Record<string, unknown>)[c])).join(','))];
  if (data.suggestions.length) {
    rows.push('', 'suggestion,note,createdAt', ...data.suggestions.map((x) => [x.text, x.note, x.createdAt].map(csvCell).join(',')));
  }
  download(`smart-tok-${stamp()}.csv`, '﻿' + rows.join('\n'), 'text/csv;charset=utf-8');
}
