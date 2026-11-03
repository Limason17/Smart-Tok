/**
 * Smart-Tok feed algorithm. Runs fully on the device.
 *
 * Two layers:
 *  - long-term profile: slow, updated when a session ends, old signals fade over days;
 *  - session: starts from the long-term state, learns quickly while scrolling,
 *    capped at x2 / x0.5 per feature, ends after 30 minutes without activity and
 *    then feeds back lightly into the long-term profile.
 *
 * Scores exist per feature of a card: area, subtopic, style, presentation (format),
 * length and difficulty. A card's weight is the product of its feature multipliers.
 * Like, save and dislike are the main signals; dwell time is only a small bonus,
 * measured against the card's expected reading time.
 */
import { expectedSeconds, type Card } from '../content/card';

export type Level3 = 'less' | 'normal' | 'more';
export type Adjust = Level3 | 'hidden';
export type Exploration = 'low' | 'normal' | 'high';

export interface Prefs {
  /** Areas switched off in the topic panel. All areas are on by default. */
  disabledAreas: string[];
  /** Subtopics switched off, as "area/sub". */
  disabledSubs: string[];
  mix: 'random' | 'custom';
  /** Only used when mix === 'custom'. */
  areaWeight: Record<string, Level3>;
  /** "Mein Algorithmus" tweaks per feature key. */
  adjust: Record<string, Adjust>;
  exploration: Exploration;
}

export const DEFAULT_PREFS: Prefs = {
  disabledAreas: [],
  disabledSubs: [],
  mix: 'random',
  areaWeight: {},
  adjust: {},
  exploration: 'normal',
};

export interface SessionState {
  startedAt: number;
  lastActive: number;
  scores: Record<string, number>;
}

export interface AlgoState {
  long: Record<string, number>;
  /** Last time the long-term profile was decayed / updated. */
  longUpdatedAt: number;
  session: SessionState | null;
}

export const emptyAlgo = (now = Date.now()): AlgoState => ({ long: {}, longUpdatedAt: now, session: null });

/** What the algorithm needs to know about a card the user has seen. */
export interface SeenInfo {
  lastSeen: number;
  views: number;
  reaction: -1 | 0 | 1;
  saved: boolean;
  /** When a saved card is next due for review (undefined: not saved or all reviews done). */
  due?: number;
  /** When a card on the "Umsetzen" list is due for a check-in ("Hast du es umgesetzt?"). */
  checkIn?: number;
}

export const TUNING = {
  signals: { like: 2, save: 3, plan: 3, dislike: -3, more: 1, dwellLong: 0.5, quickSkip: -0.5 },
  featureWeight: { a: 1, s: 1, st: 0.6, f: 0.4, l: 0.4, d: 0.3 } as Record<string, number>,
  longScale: 0.12,
  longClamp: 8,
  sessionScale: 0.18,
  sessionMin: 0.5,
  sessionMax: 2,
  sessionIdleMs: 30 * 60 * 1000,
  /** Share of session signals carried into the long-term profile. */
  sessionCarry: 0.35,
  /** Daily fade of long-term scores. */
  dailyDecay: 0.98,
  quickSkipSeconds: 4,
  dwellLongFactor: 1.5,
  exploration: { low: 0.15, normal: 0.3, high: 0.45 } as Record<Exploration, number>,
  minExploration: 0.1,
  adjust: { less: 0.6, normal: 1, more: 1.6, hidden: 0 } as Record<Adjust, number>,
  areaWeight: { less: 0.5, normal: 1, more: 2 } as Record<Level3, number>,
  /** Do not repeat any of the last N feed items. */
  recentWindow: 12,
  /** In review mode, prefer cards not seen for this long. */
  reviewCooldownMs: 12 * 60 * 60 * 1000,
  /** Days between the reviews of a saved card: 1, 3, 7 and 21 days. */
  reviewDays: [1, 3, 7, 21],
  /** At least this many other cards between two due reviews, so reviews stay a small share. */
  reviewGap: 4,
  /** Days until the check-ins of a card on the "Umsetzen" list: after 2, 5 and 10 more days. */
  planDays: [2, 5, 10],
};

// ---------------------------------------------------------------- "Umsetzen" check-ins

/** Fields of a card on the "Umsetzen" list. */
export interface PlanFields {
  planAt?: number;
  planDone?: number;
  planStep?: number;
  planDue?: number;
}

/** When the next check-in is due after `step` check-ins, counted from `from` (undefined: no more check-ins). */
export function nextPlanDue(step: number, from: number): number | undefined {
  const days = TUNING.planDays[step];
  return days === undefined ? undefined : from + days * 86_400_000;
}

/** A planned card that is not done yet and has a check-in waiting. */
export function planDue(r: PlanFields): number | undefined {
  if (!r.planAt || r.planDone) return undefined;
  return r.planDue;
}

/** Seeing a due check-in counts as one; the next one is scheduled (answering "erledigt" ends them). */
export function afterPlanView(r: PlanFields, now: number): Pick<PlanFields, 'planStep' | 'planDue'> {
  const due = planDue(r);
  if (due === undefined || now < due) return { planStep: r.planStep, planDue: r.planDue };
  const step = (r.planStep ?? 0) + 1;
  return { planStep: step, planDue: nextPlanDue(step, now) };
}

// ---------------------------------------------------------------- spaced review

const DAY_MS = 86_400_000;

/** Review state of a card record (the fields the spaced review needs). */
export interface ReviewFields {
  saved: boolean;
  savedAt?: number;
  lastSeen: number;
  reviewStep?: number;
  reviewDue?: number;
}

/** Number of reviews a saved card gets. */
export const REVIEW_STEPS = TUNING.reviewDays.length;

/** When the next review is due after `step` finished reviews, counted from `from`. */
export function nextReviewDue(step: number, from: number): number | undefined {
  const days = TUNING.reviewDays[step];
  return days === undefined ? undefined : from + days * DAY_MS;
}

/**
 * When a saved card is due again. Cards saved before reviews existed have no step yet;
 * their first review counts from the time they were saved.
 */
export function reviewDue(r: ReviewFields): number | undefined {
  if (!r.saved) return undefined;
  if (r.reviewStep === undefined) return nextReviewDue(0, r.savedAt ?? r.lastSeen);
  return r.reviewDue;
}

/** Applies a view of the card: a view while due counts as a review and schedules the next one. */
export function afterView(r: ReviewFields, now: number): Pick<ReviewFields, 'reviewStep' | 'reviewDue'> {
  const due = reviewDue(r);
  const step = r.reviewStep ?? 0;
  if (!r.saved || due === undefined || now < due) return { reviewStep: r.reviewStep, reviewDue: r.reviewDue };
  return { reviewStep: step + 1, reviewDue: nextReviewDue(step + 1, now) };
}

// ---------------------------------------------------------------- features

export function featureKeys(card: Pick<Card, 'area' | 'sub' | 'style' | 'format' | 'length' | 'level'>): string[] {
  return [
    `a:${card.area}`,
    `s:${card.area}/${card.sub}`,
    `st:${card.style}`,
    `f:${card.format}`,
    `l:${card.length}`,
    `d:${card.level}`,
  ];
}

const kind = (key: string) => key.slice(0, key.indexOf(':'));

// ---------------------------------------------------------------- signals

export type Signal =
  | { type: 'like'; on: boolean }
  | { type: 'save'; on: boolean }
  | { type: 'plan'; on: boolean }
  | { type: 'dislike'; on: boolean }
  | { type: 'more' }
  | { type: 'dwell'; seconds: number };

/** Score delta for one interaction (0 when it should not count). */
export function signalValue(signal: Signal, card: Pick<Card, 'words'>): number {
  const v = TUNING.signals;
  switch (signal.type) {
    case 'like':
      return signal.on ? v.like : -v.like;
    case 'save':
      return signal.on ? v.save : -v.save;
    case 'plan':
      return signal.on ? v.plan : -v.plan;
    case 'dislike':
      return signal.on ? v.dislike : -v.dislike;
    case 'more':
      return v.more;
    case 'dwell': {
      const expected = expectedSeconds(card);
      if (signal.seconds < TUNING.quickSkipSeconds && expected > TUNING.quickSkipSeconds * 1.5) return v.quickSkip;
      // Very long dwell is likely an idle phone, so it gets no bonus.
      if (signal.seconds >= expected * TUNING.dwellLongFactor && signal.seconds <= Math.max(600, expected * 6)) {
        return v.dwellLong;
      }
      return 0;
    }
  }
}

// ---------------------------------------------------------------- sessions

/** Folds a finished session into the long-term profile and fades old scores. */
export function foldSession(state: AlgoState, now: number): AlgoState {
  const days = Math.max(0, (now - state.longUpdatedAt) / 86_400_000);
  const decay = Math.pow(TUNING.dailyDecay, days);
  const long: Record<string, number> = {};
  for (const [k, v] of Object.entries(state.long)) long[k] = v * decay;
  for (const [k, v] of Object.entries(state.session?.scores ?? {})) {
    long[k] = (long[k] ?? 0) + TUNING.sessionCarry * v;
  }
  for (const k of Object.keys(long)) {
    long[k] = Math.max(-TUNING.longClamp, Math.min(TUNING.longClamp, long[k]));
    if (Math.abs(long[k]) < 0.01) delete long[k];
  }
  return { long, longUpdatedAt: now, session: null };
}

/** Ends an idle session and makes sure a session is running. */
export function ensureSession(state: AlgoState, now: number): AlgoState {
  let next = state;
  if (next.session && now - next.session.lastActive > TUNING.sessionIdleMs) next = foldSession(next, now);
  if (!next.session) next = { ...next, session: { startedAt: now, lastActive: now, scores: {} } };
  return next;
}

/** Applies one interaction to the session layer. */
export function applySignal(state: AlgoState, card: Card, signal: Signal, now: number): AlgoState {
  const value = signalValue(signal, card);
  const base = ensureSession(state, now);
  const session = { ...base.session!, lastActive: now, scores: { ...base.session!.scores } };
  if (value !== 0) {
    for (const key of featureKeys(card)) {
      session.scores[key] = (session.scores[key] ?? 0) + value * (TUNING.featureWeight[kind(key)] ?? 1);
    }
  }
  return { ...base, session };
}

// ---------------------------------------------------------------- weights

export function longMultiplier(state: AlgoState, key: string): number {
  const v = Math.max(-TUNING.longClamp, Math.min(TUNING.longClamp, state.long[key] ?? 0));
  return Math.exp(TUNING.longScale * v);
}

export function sessionMultiplier(state: AlgoState, key: string): number {
  const v = state.session?.scores[key] ?? 0;
  return Math.max(TUNING.sessionMin, Math.min(TUNING.sessionMax, Math.exp(TUNING.sessionScale * v)));
}

export function featureMultiplier(state: AlgoState, prefs: Prefs, key: string): number {
  const adjust = TUNING.adjust[prefs.adjust[key] ?? 'normal'];
  return longMultiplier(state, key) * sessionMultiplier(state, key) * adjust;
}

export function explorationShare(prefs: Prefs): number {
  return Math.max(TUNING.minExploration, TUNING.exploration[prefs.exploration] ?? TUNING.exploration.normal);
}

/** 1 for normal cards; news cards fade out between publishedAt and expiresAt. */
export function freshness(card: Pick<Card, 'publishedAt' | 'expiresAt'>, now: number): number {
  if (!card.expiresAt) return 1;
  const end = Date.parse(card.expiresAt);
  if (Number.isNaN(end) || now >= end) return 0;
  const start = card.publishedAt ? Date.parse(card.publishedAt) : end - 7 * 86_400_000;
  const life = Math.max(1, end - start);
  const left = Math.min(1, Math.max(0, (end - now) / life));
  return 0.15 + 0.85 * left;
}

export function isEligible(card: Card, prefs: Prefs, now: number): boolean {
  if (prefs.disabledAreas.includes(card.area)) return false;
  if (prefs.disabledSubs.includes(`${card.area}/${card.sub}`)) return false;
  if (prefs.adjust[`s:${card.area}/${card.sub}`] === 'hidden') return false;
  if (prefs.adjust[`st:${card.style}`] === 'hidden') return false;
  return freshness(card, now) > 0;
}

// ---------------------------------------------------------------- picking

export interface PickContext {
  cards: Card[];
  seen: Record<string, SeenInfo | undefined>;
  prefs: Prefs;
  algo: AlgoState;
  /** Ids already in the feed, most recent last. */
  recent: string[];
  /** Feed items since the last review pick (Infinity when there was none). */
  sinceReview?: number;
  now: number;
  rng?: () => number;
}

export interface FeedPick {
  card: Card;
  explored: boolean;
  /** Older card shown again because nothing unread is left. */
  review: boolean;
  /** Saved card that is due for its spaced review, or a planned card due for a check-in. */
  due?: boolean;
  /** The due card is a check-in of the "Umsetzen" list. */
  checkIn?: boolean;
}

function weightedChoice<T>(items: T[], weight: (t: T) => number, rng: () => number): T | undefined {
  let total = 0;
  const ws = items.map((it) => {
    const w = Math.max(0, weight(it));
    total += w;
    return w;
  });
  if (total <= 0) return items.length ? items[Math.floor(rng() * items.length)] : undefined;
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= ws[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const list = m.get(k);
    if (list) list.push(it);
    else m.set(k, [it]);
  }
  return m;
}

/**
 * Picks the next card for the feed.
 * Unread cards come first; when everything enabled has been read, the feed keeps
 * going with saved and older cards for review (never disliked ones), so it is endless.
 */
export function pickNext(ctx: PickContext): FeedPick | null {
  const rng = ctx.rng ?? Math.random;
  const { prefs, algo, seen, now } = ctx;
  const recent = new Set(ctx.recent.slice(-TUNING.recentWindow));
  const eligible = ctx.cards.filter((c) => isEligible(c, prefs, now));
  if (!eligible.length) return null;

  // Saved cards come back after 1, 3, 7 and 21 days, planned cards for check-ins after 2, 7 and 17 days;
  // most overdue first, spaced out between other cards.
  if ((ctx.sinceReview ?? Infinity) >= TUNING.reviewGap) {
    let dueCard: Card | undefined;
    let dueAt = Infinity;
    let checkIn = false;
    for (const c of eligible) {
      if (recent.has(c.id)) continue;
      for (const [at, isCheckIn] of [[seen[c.id]?.checkIn, true], [seen[c.id]?.due, false]] as const) {
        if (at !== undefined && at <= now && at < dueAt) {
          dueCard = c;
          dueAt = at;
          checkIn = isCheckIn;
        }
      }
    }
    if (dueCard) return { card: dueCard, explored: false, review: true, due: true, checkIn };
  }

  const unread = eligible.filter((c) => !seen[c.id] && !recent.has(c.id));
  let pool = unread;
  let review = false;
  if (!pool.length) {
    review = true;
    const notDisliked = eligible.filter((c) => seen[c.id]?.reaction !== -1 && !recent.has(c.id));
    const rested = notDisliked.filter((c) => now - (seen[c.id]?.lastSeen ?? 0) > TUNING.reviewCooldownMs);
    pool = rested.length ? rested : notDisliked;
    if (!pool.length) pool = eligible.filter((c) => !recent.has(c.id));
    if (!pool.length) pool = eligible;
  }

  const explored = rng() < explorationShare(prefs);
  const byArea = groupBy(pool, (c) => c.area);
  const areaIds = [...byArea.keys()];
  const frameWeight = (area: string) => (prefs.mix === 'custom' ? TUNING.areaWeight[prefs.areaWeight[area] ?? 'normal'] : 1);
  const areaId = weightedChoice(
    areaIds,
    (a) => frameWeight(a) * (explored ? 1 : featureMultiplier(algo, prefs, `a:${a}`)),
    rng,
  )!;

  const inArea = byArea.get(areaId)!;
  const bySub = groupBy(inArea, (c) => c.sub);
  const seenPerSub = (sub: string) =>
    ctx.cards.filter((c) => c.area === areaId && c.sub === sub && seen[c.id]).length;
  const subId = weightedChoice(
    [...bySub.keys()],
    (sub) => (explored ? 1 / (1 + seenPerSub(sub)) : featureMultiplier(algo, prefs, `s:${areaId}/${sub}`)),
    rng,
  )!;

  const candidates = bySub.get(subId)!;
  const card = weightedChoice(
    candidates,
    (c) => {
      let w = freshness(c, now);
      if (review) {
        const info = seen[c.id];
        const ageDays = info ? (now - info.lastSeen) / 86_400_000 : 30;
        w *= (info?.saved ? 2 : 1) * Math.min(4, 0.5 + ageDays / 3);
      }
      if (explored) return w;
      for (const key of featureKeys(c).slice(2)) w *= featureMultiplier(algo, prefs, key);
      return w;
    },
    rng,
  )!;

  return { card, explored, review };
}

// ---------------------------------------------------------------- insight

export interface FeatureInsight {
  key: string;
  long: number;
  session: number;
  multiplier: number;
}

/** Numbers behind "Mein Algorithmus": per feature, long-term and session multipliers. */
export function insights(state: AlgoState, prefs: Prefs): FeatureInsight[] {
  const keys = new Set([...Object.keys(state.long), ...Object.keys(state.session?.scores ?? {}), ...Object.keys(prefs.adjust)]);
  return [...keys]
    .map((key) => ({
      key,
      long: longMultiplier(state, key),
      session: sessionMultiplier(state, key),
      multiplier: featureMultiplier(state, prefs, key),
    }))
    .sort((a, b) => b.multiplier - a.multiplier);
}

/**
 * Expected share of each area in the feed (0..1), as the picker would choose right now.
 * Mirrors pickNext: exploration picks areas evenly, otherwise by the learned multiplier.
 */
export function areaShares(cards: Card[], prefs: Prefs, algo: AlgoState, now: number): Record<string, number> {
  const areas = [...new Set(cards.filter((c) => isEligible(c, prefs, now)).map((c) => c.area))];
  if (!areas.length) return {};
  const frame = (a: string) => (prefs.mix === 'custom' ? TUNING.areaWeight[prefs.areaWeight[a] ?? 'normal'] : 1);
  const e = explorationShare(prefs);
  const frameSum = areas.reduce((sum, a) => sum + frame(a), 0);
  const learned = areas.map((a) => frame(a) * featureMultiplier(algo, prefs, `a:${a}`));
  const learnedSum = learned.reduce((sum, w) => sum + w, 0);
  const out: Record<string, number> = {};
  areas.forEach((a, i) => {
    const exploit = learnedSum > 0 ? learned[i] / learnedSum : frame(a) / frameSum;
    out[a] = (1 - e) * exploit + e * (frame(a) / frameSum);
  });
  return out;
}
