import { useSyncExternalStore } from 'react';
import { CARD_BY_ID } from '../content';
import type { Card } from '../content/card';
import type { Lang } from '../content/taxonomy';
import {
  applySignal,
  DEFAULT_PREFS,
  emptyAlgo,
  ensureSession,
  foldSession,
  type AlgoState,
  type Prefs,
  type SeenInfo,
  type Signal,
} from '../algo/engine';
import { db, type CardRecord, type EventRecord } from './db';

export type Theme = 'dark' | 'light' | 'system';
export type FontSize = 's' | 'm' | 'l';

export interface Settings {
  lang: Lang;
  theme: Theme;
  fontSize: FontSize;
  installHintDismissed: boolean;
}

export interface Suggestion {
  id: string;
  text: string;
  note?: string;
  createdAt: number;
}

export interface State {
  ready: boolean;
  settings: Settings;
  prefs: Prefs;
  algo: AlgoState;
  cards: Record<string, CardRecord>;
  days: Record<string, number>;
  suggestions: Suggestion[];
}

export const SUGGESTION_MAX = 80;
export const SUGGESTION_NOTE_MAX = 200;
/** A card counts as read once it was on screen this long. */
export const VIEW_MIN_MS = 1200;

function detectLang(): Lang {
  const langs = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : [];
  return langs.some((l) => l?.toLowerCase().startsWith('de')) || !langs.length ? 'de' : 'en';
}

const defaultSettings = (): Settings => ({ lang: detectLang(), theme: 'dark', fontSize: 'm', installHintDismissed: false });

let state: State = {
  ready: false,
  settings: defaultSettings(),
  prefs: DEFAULT_PREFS,
  algo: emptyAlgo(),
  cards: {},
  days: {},
  suggestions: [],
};

const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function getState(): State {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

// ---------------------------------------------------------------- persistence

/** IndexedDB can be unavailable (private mode, blocked storage). The app keeps working in memory. */
async function safe<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    console.warn('[smart-tok] storage unavailable', err);
    return undefined;
  }
}

const kvTimers = new Map<string, ReturnType<typeof setTimeout>>();
function persistKv(key: string, value: unknown, delay = 400) {
  clearTimeout(kvTimers.get(key));
  kvTimers.set(
    key,
    setTimeout(() => void safe(() => db.kv.put({ key, value })), delay),
  );
}

function flushKv() {
  for (const t of kvTimers.values()) clearTimeout(t);
  kvTimers.clear();
  void safe(() =>
    db.kv.bulkPut([
      { key: 'algo', value: state.algo },
      { key: 'prefs', value: state.prefs },
      { key: 'settings', value: state.settings },
      { key: 'suggestions', value: state.suggestions },
    ]),
  );
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function logEvent(card: string, type: EventRecord['type'], value?: number) {
  const ev: EventRecord = { id: uid(), t: Date.now(), card, type, value };
  void safe(() => db.events.add(ev));
}

export async function init(): Promise<void> {
  const loaded = await safe(async () => {
    const [kv, cards, days] = await Promise.all([db.kv.toArray(), db.cards.toArray(), db.days.toArray()]);
    return { kv: Object.fromEntries(kv.map((r) => [r.key, r.value])), cards, days };
  });
  const now = Date.now();
  if (loaded) {
    const algo = (loaded.kv.algo as AlgoState | undefined) ?? emptyAlgo(now);
    set({
      settings: { ...defaultSettings(), ...(loaded.kv.settings as Partial<Settings> | undefined) },
      prefs: { ...DEFAULT_PREFS, ...(loaded.kv.prefs as Partial<Prefs> | undefined) },
      // A session idle for 30+ minutes is folded into the long-term profile on start.
      algo: ensureSession(algo, now),
      suggestions: (loaded.kv.suggestions as Suggestion[] | undefined) ?? [],
      cards: Object.fromEntries(loaded.cards.map((c) => [c.id, c])),
      days: Object.fromEntries(loaded.days.map((d) => [d.date, d.count])),
    });
  } else {
    set({ algo: ensureSession(state.algo, now) });
  }
  set({ ready: true });
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushKv();
    });
  }
}

// ---------------------------------------------------------------- helpers

export function localDate(t: number): string {
  const d = new Date(t);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function seenMap(cards: Record<string, CardRecord>): Record<string, SeenInfo> {
  const out: Record<string, SeenInfo> = {};
  for (const [id, r] of Object.entries(cards)) {
    if (r.views > 0) out[id] = { lastSeen: r.lastSeen, views: r.views, reaction: r.reaction, saved: r.saved };
  }
  return out;
}

function blankRecord(id: string, now: number): CardRecord {
  return {
    id,
    firstSeen: 0,
    lastSeen: 0,
    views: 0,
    dwellMs: 0,
    reaction: 0,
    saved: false,
    more: false,
    shared: false,
    lang: state.settings.lang,
    updatedAt: now,
  };
}

function writeCard(rec: CardRecord) {
  set({ cards: { ...state.cards, [rec.id]: rec } });
  void safe(() => db.cards.put(rec));
}

function signal(card: Card, s: Signal) {
  const algo = applySignal(state.algo, card, s, Date.now());
  set({ algo });
  persistKv('algo', algo);
}

// ---------------------------------------------------------------- actions

/** Called when a card leaves the screen (or the app is hidden). */
export function recordView(cardId: string, dwellMs: number) {
  const card = CARD_BY_ID[cardId];
  if (!card || dwellMs < VIEW_MIN_MS) {
    if (card && dwellMs > 0) signal(card, { type: 'dwell', seconds: dwellMs / 1000 });
    return;
  }
  const now = Date.now();
  const prev = state.cards[cardId] ?? blankRecord(cardId, now);
  const today = localDate(now);
  const firstToday = !prev.lastSeen || localDate(prev.lastSeen) !== today;
  writeCard({
    ...prev,
    firstSeen: prev.firstSeen || now,
    lastSeen: now,
    views: prev.views + 1,
    dwellMs: prev.dwellMs + Math.min(dwellMs, 15 * 60 * 1000),
    lang: state.settings.lang,
    updatedAt: now,
  });
  if (firstToday) {
    const count = (state.days[today] ?? 0) + 1;
    set({ days: { ...state.days, [today]: count } });
    void safe(() => db.days.put({ date: today, count }));
  }
  logEvent(cardId, 'view', Math.round(dwellMs / 100) / 10);
  signal(card, { type: 'dwell', seconds: dwellMs / 1000 });
}

function updateCard(cardId: string, fn: (r: CardRecord) => Partial<CardRecord>) {
  const now = Date.now();
  const prev = state.cards[cardId] ?? blankRecord(cardId, now);
  writeCard({ ...prev, ...fn(prev), updatedAt: now });
}

export function toggleLike(cardId: string, force?: boolean) {
  const card = CARD_BY_ID[cardId];
  if (!card) return;
  const prev = state.cards[cardId]?.reaction ?? 0;
  const on = force ?? prev !== 1;
  if (on === (prev === 1)) return;
  if (on && prev === -1) signal(card, { type: 'dislike', on: false });
  updateCard(cardId, () => ({ reaction: on ? 1 : 0 }));
  signal(card, { type: 'like', on });
  logEvent(cardId, 'like', on ? 1 : 0);
}

export function toggleDislike(cardId: string) {
  const card = CARD_BY_ID[cardId];
  if (!card) return;
  const prev = state.cards[cardId]?.reaction ?? 0;
  const on = prev !== -1;
  if (on && prev === 1) signal(card, { type: 'like', on: false });
  updateCard(cardId, () => ({ reaction: on ? -1 : 0 }));
  signal(card, { type: 'dislike', on });
  logEvent(cardId, 'dislike', on ? 1 : 0);
}

export function toggleSave(cardId: string) {
  const card = CARD_BY_ID[cardId];
  if (!card) return;
  const on = !state.cards[cardId]?.saved;
  updateCard(cardId, () => ({ saved: on, savedAt: on ? Date.now() : undefined }));
  signal(card, { type: 'save', on });
  logEvent(cardId, 'save', on ? 1 : 0);
}

export function markMore(cardId: string) {
  const card = CARD_BY_ID[cardId];
  if (!card) return;
  const first = !state.cards[cardId]?.more;
  updateCard(cardId, () => ({ more: true }));
  if (first) signal(card, { type: 'more' });
  logEvent(cardId, 'more');
}

export function markShared(cardId: string) {
  updateCard(cardId, () => ({ shared: true }));
  logEvent(cardId, 'share');
}

export function setSettings(patch: Partial<Settings>) {
  const settings = { ...state.settings, ...patch };
  set({ settings });
  persistKv('settings', settings, 0);
}

export function setPrefs(patch: Partial<Prefs>) {
  const prefs = { ...state.prefs, ...patch };
  set({ prefs });
  persistKv('prefs', prefs, 0);
}

export function toggleArea(areaId: string) {
  const off = state.prefs.disabledAreas.includes(areaId);
  setPrefs({
    disabledAreas: off ? state.prefs.disabledAreas.filter((a) => a !== areaId) : [...state.prefs.disabledAreas, areaId],
  });
}

export function toggleSub(areaId: string, subId: string) {
  const key = `${areaId}/${subId}`;
  const off = state.prefs.disabledSubs.includes(key);
  setPrefs({ disabledSubs: off ? state.prefs.disabledSubs.filter((s) => s !== key) : [...state.prefs.disabledSubs, key] });
}

/** Strips control characters and links; keeps suggestions short (they are data, never instructions). */
export function sanitizeText(input: string, max: number): string {
  return input
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, ' ')
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, '')
    .replace(/[<>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function addSuggestion(text: string, note?: string): boolean {
  const clean = sanitizeText(text, SUGGESTION_MAX);
  if (!clean) return false;
  const cleanNote = note ? sanitizeText(note, SUGGESTION_NOTE_MAX) : '';
  const suggestions = [...state.suggestions, { id: uid(), text: clean, note: cleanNote || undefined, createdAt: Date.now() }];
  set({ suggestions });
  persistKv('suggestions', suggestions, 0);
  return true;
}

export function removeSuggestion(id: string) {
  const suggestions = state.suggestions.filter((s) => s.id !== id);
  set({ suggestions });
  persistKv('suggestions', suggestions, 0);
}

/** Restarts the algorithm without touching history or saved cards. */
export function resetAlgorithm() {
  const algo = emptyAlgo();
  set({ algo: ensureSession(algo, Date.now()) });
  persistKv('algo', state.algo, 0);
}

/** Closes the running session now (used by tests and the profile view). */
export function endSession() {
  const algo = foldSession(state.algo, Date.now());
  set({ algo });
  persistKv('algo', algo, 0);
}

export async function allEvents(): Promise<EventRecord[]> {
  return (await safe(() => db.events.orderBy('t').toArray())) ?? [];
}
