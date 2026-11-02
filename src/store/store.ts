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
  type Adjust,
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
  /** Set once the first-start introduction is done. */
  onboarded: boolean;
}

export interface Suggestion {
  id: string;
  text: string;
  note?: string;
  createdAt: number;
}

/** Sections of the state that sync as a whole; the newer one wins. */
export type SyncSection = 'settings' | 'prefs' | 'suggestions' | 'algo';
export type Stamps = Record<SyncSection, number>;
const SYNC_SECTIONS: SyncSection[] = ['settings', 'prefs', 'suggestions', 'algo'];

export interface Account {
  uid: string;
  email: string;
  name: string;
}

export interface SyncStatus {
  state: 'off' | 'syncing' | 'ok' | 'error';
  at?: number;
  error?: string;
}

export interface State {
  ready: boolean;
  stamps: Stamps;
  /** Signed-in account, if any (comes from the sync module). */
  account: Account | null;
  sync: SyncStatus;
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

const defaultSettings = (): Settings => ({
  lang: detectLang(),
  theme: 'dark',
  fontSize: 'm',
  installHintDismissed: false,
  onboarded: false,
});

const emptyStamps = (): Stamps => ({ settings: 0, prefs: 0, suggestions: 0, algo: 0 });

let state: State = {
  ready: false,
  stamps: emptyStamps(),
  account: null,
  sync: { state: 'off' },
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
  if ((SYNC_SECTIONS as string[]).includes(key)) {
    const stamps = { ...state.stamps, [key]: Date.now() };
    set({ stamps });
    void safe(() => db.kv.put({ key: 'stamps', value: stamps }));
  }
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
    const stored = loaded.kv.settings as Partial<Settings> | undefined;
    set({
      // People who used the app before onboarding existed skip it.
      settings: { ...defaultSettings(), ...stored, onboarded: stored?.onboarded ?? loaded.cards.length > 0 },
      prefs: { ...DEFAULT_PREFS, ...(loaded.kv.prefs as Partial<Prefs> | undefined) },
      // A session idle for 30+ minutes is folded into the long-term profile on start.
      algo: ensureSession(algo, now),
      suggestions: (loaded.kv.suggestions as Suggestion[] | undefined) ?? [],
      stamps: { ...emptyStamps(), ...(loaded.kv.stamps as Partial<Stamps> | undefined) },
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

/** Days in a row with at least one card read, ending today (or yesterday, so the streak survives until tonight). */
export function streak(days: Record<string, number>, now = Date.now()): number {
  const d = new Date(now);
  if (!days[localDate(d.getTime())]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days[localDate(d.getTime())]) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
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

/** "Mein Algorithmus": less, normal, more or hidden for a feature key such as "st:zitat" or "s:geld/investment". */
export function setAdjust(key: string, value: Adjust) {
  const adjust = { ...state.prefs.adjust };
  if (value === 'normal') delete adjust[key];
  else adjust[key] = value;
  setPrefs({ adjust });
}

/** Ends the first-start introduction with the topics the person picked. */
export function finishOnboarding(areas: string[], allAreas: string[]) {
  setPrefs({ disabledAreas: allAreas.filter((a) => !areas.includes(a)) });
  setSettings({ onboarded: true });
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

/** Interaction events in a time range, oldest first. */
export async function eventsBetween(start: number, end: number): Promise<EventRecord[]> {
  return (await safe(() => db.events.where('t').between(start, end, true, false).toArray())) ?? [];
}

// ---------------------------------------------------------------- sync support

/** Everything that is synced to the account. */
export interface SyncData {
  cards: Record<string, CardRecord>;
  days: Record<string, number>;
  settings: Settings;
  prefs: Prefs;
  algo: AlgoState;
  suggestions: Suggestion[];
  stamps: Stamps;
}

export function getSyncData(): SyncData {
  const { cards, days, settings, prefs, algo, suggestions, stamps } = state;
  return { cards, days, settings, prefs, algo, suggestions, stamps };
}

/** Replaces local data with merged data from the account (does not touch the stamps' meaning). */
export async function applySyncData(data: SyncData): Promise<void> {
  const changedCards = Object.values(data.cards).filter((r) => state.cards[r.id]?.updatedAt !== r.updatedAt || !state.cards[r.id]);
  const changedDays = Object.entries(data.days).filter(([d, n]) => state.days[d] !== n);
  set({
    cards: data.cards,
    days: data.days,
    settings: { ...defaultSettings(), ...data.settings, onboarded: true },
    prefs: { ...DEFAULT_PREFS, ...data.prefs },
    algo: ensureSession(data.algo, Date.now()),
    suggestions: data.suggestions,
    stamps: data.stamps,
  });
  await safe(() =>
    db.transaction('rw', db.cards, db.days, db.kv, async () => {
      if (changedCards.length) await db.cards.bulkPut(changedCards);
      if (changedDays.length) await db.days.bulkPut(changedDays.map(([date, count]) => ({ date, count })));
      await db.kv.bulkPut([
        { key: 'algo', value: state.algo },
        { key: 'prefs', value: state.prefs },
        { key: 'settings', value: state.settings },
        { key: 'suggestions', value: state.suggestions },
        { key: 'stamps', value: state.stamps },
      ]);
    }),
  );
}

/** After signing out: removes history and personal settings from this device; keeps language and look. */
export async function clearLocalData(): Promise<void> {
  const { lang, theme, fontSize } = state.settings;
  set({
    cards: {},
    days: {},
    prefs: DEFAULT_PREFS,
    algo: ensureSession(emptyAlgo(), Date.now()),
    suggestions: [],
    stamps: emptyStamps(),
    settings: { ...defaultSettings(), lang, theme, fontSize, onboarded: true, installHintDismissed: state.settings.installHintDismissed },
  });
  await safe(async () => {
    await Promise.all([db.cards.clear(), db.days.clear(), db.events.clear(), db.kv.clear()]);
    await db.kv.put({ key: 'settings', value: state.settings });
  });
}

export function setAccount(account: Account | null) {
  set({ account });
}

export function setSyncStatus(sync: SyncStatus) {
  set({ sync });
}

/** Small key-value values that are not part of the state (e.g. which account this device last synced with). */
export async function readKv<T>(key: string): Promise<T | undefined> {
  return (await safe(() => db.kv.get(key)))?.value as T | undefined;
}

export async function writeKv(key: string, value: unknown): Promise<void> {
  await safe(() => db.kv.put({ key, value }));
}

export async function allEvents(): Promise<EventRecord[]> {
  return (await safe(() => db.events.orderBy('t').toArray())) ?? [];
}
