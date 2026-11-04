import { memo, useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { Card } from '../content/card';
import { CARD_BY_ID, CARDS } from '../content';
import { pickNext } from '../algo/engine';
import { introId } from '../content/people';
import { useT } from '../i18n/strings';
import {
  getState,
  markMore,
  markShared,
  recordView,
  seenMap,
  setPlanDone,
  toggleDislike,
  toggleLike,
  togglePlan,
  toggleSave,
  useStore,
  VIEW_MIN_MS,
} from '../store/store';
import { CardView } from './CardView';
import { Icon } from './Icon';
import { useDesktop } from './useDesktop';
import { cardLink, clearCardLink, linkedCards } from './links';

interface FeedEntry {
  key: string;
  cardId: string;
  /** A saved card shown again for its spaced review. */
  due?: boolean;
  /** A card from the "Umsetzen" list, shown again to ask whether it was done. */
  checkIn?: boolean;
  /** Opened from a shared link. */
  shared?: boolean;
  /** Introduction of a person, placed before a card from a shared link: stays in place like it. */
  keep?: boolean;
}

const BATCH = 3;
let entryCounter = 0;

/**
 * The introduction a card needs first: the main person's introduction card,
 * unless it was already read or is already in the feed.
 */
function introFor(cardId: string, seen: Record<string, unknown>, inFeed: Set<string>): string | null {
  const person = CARD_BY_ID[cardId]?.people?.[0];
  if (!person) return null;
  const intro = introId(person);
  return intro === cardId || seen[intro] || inFeed.has(intro) || !CARD_BY_ID[intro] ? null : intro;
}

function sharedEntries(ids: string[], existing: FeedEntry[] = []): FeedEntry[] {
  const seen = seenMap(getState().cards);
  const inFeed = new Set([...existing.map((e) => e.cardId), ...ids]);
  const out: FeedEntry[] = [];
  for (const cardId of ids) {
    // Someone you don't know yet is introduced first, even in a shared link.
    const intro = introFor(cardId, seen, inFeed);
    if (intro) {
      inFeed.add(intro);
      out.push({ key: `${intro}-${entryCounter++}`, cardId: intro, keep: true });
    }
    out.push({ key: `${cardId}-${entryCounter++}`, cardId, shared: true });
  }
  return out;
}

function nextEntries(existing: FeedEntry[], count: number): FeedEntry[] {
  const s = getState();
  const seen = seenMap(s.cards);
  const recent = existing.map((e) => e.cardId);
  const out: FeedEntry[] = [];
  const lastDue = existing.map((e) => !!e.due).lastIndexOf(true);
  // Without an earlier review in this feed, the first one can come as the third card, never first.
  let sinceReview = lastDue < 0 ? existing.length + 2 : existing.length - 1 - lastDue;
  for (let i = 0; i < count; i++) {
    const pick = pickNext({ cards: CARDS, seen, prefs: s.prefs, algo: s.algo, recent, sinceReview, now: Date.now() });
    if (!pick) break;
    const intro = introFor(pick.card.id, seen, new Set(recent));
    if (intro) {
      recent.push(intro);
      out.push({ key: `${intro}-${entryCounter++}`, cardId: intro });
    }
    recent.push(pick.card.id);
    sinceReview = pick.due ? 0 : sinceReview + 1;
    out.push({ key: `${pick.card.id}-${entryCounter++}`, cardId: pick.card.id, due: pick.due, checkIn: pick.checkIn });
  }
  return out;
}

export interface FeedProps {
  onMore: (cardId: string) => void;
  /** Open a person's profile (from the name on a card). */
  onPerson?: (personId: string) => void;
  onToast: (text: string) => void;
  onOpenTopics: () => void;
  /** Only the cards from a shared link, before onboarding: no endless feed, a way in at the end. */
  preview?: { onStart: () => void };
  /** A panel covers the feed: the time spent there does not count for the card underneath. */
  paused?: boolean;
}

export function Feed({ onMore, onPerson, onToast, onOpenTopics, preview, paused = false }: FeedProps) {
  const tr = useT();
  const prefs = useStore((s) => s.prefs);
  // A shared link (#k=…) puts its cards first; the normal feed follows.
  const [entries, setEntries] = useState<FeedEntry[]>(() => {
    const linked = sharedEntries(linkedCards());
    return preview ? linked : [...linked, ...nextEntries(linked, linked.length ? BATCH : BATCH + 1)];
  });
  const [active, setActive] = useState(0);
  const [burst, setBurst] = useState<{ x: number; y: number; id: number } | null>(null);
  const [pop, setPop] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const activeSince = useRef(performance.now());
  /** Reading time of the active card from before a panel covered it. */
  const banked = useRef(0);
  const pausedRef = useRef(paused);
  const hiddenRef = useRef(false);
  const activeIndex = useRef(0);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;


  // --- dwell tracking: the active card is the one crossing the middle of the screen
  const flushDwell = useCallback((minMs = 0) => {
    const entry = entriesRef.current[activeIndex.current];
    const now = performance.now();
    const dwell = banked.current + (pausedRef.current || hiddenRef.current ? 0 : now - activeSince.current);
    if (entry && dwell > 0 && dwell >= minMs) recordView(entry.cardId, dwell);
    banked.current = 0;
    activeSince.current = now;
  }, []);

  // A sheet over the feed (profile, a person, another card...) stops the clock; it runs on after closing.
  useEffect(() => {
    if (paused === pausedRef.current) return;
    const now = performance.now();
    if (paused && !hiddenRef.current) banked.current += now - activeSince.current;
    activeSince.current = now;
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const root = feedRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (items) => {
        for (const it of items) {
          if (!it.isIntersecting) continue;
          const idx = Number((it.target as HTMLElement).dataset.index);
          if (idx === activeIndex.current) continue;
          flushDwell();
          activeIndex.current = idx;
          setActive(idx);
          if (idx > 0) setScrolled(true);
        }
      },
      { root, rootMargin: '-50% 0px -50% 0px', threshold: 0 },
    );
    root.querySelectorAll<HTMLElement>('.feed-item').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [entries, flushDwell]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        flushDwell();
        hiddenRef.current = true;
      } else {
        hiddenRef.current = false;
        activeSince.current = performance.now();
      }
    };
    const onHide = () => flushDwell();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
      // Leaving the feed (e.g. "Los geht's" after a shared link) still counts the card on screen.
      flushDwell(VIEW_MIN_MS);
    };
  }, [flushDwell]);

  // --- endless: keep a few cards ahead of the active one
  useEffect(() => {
    if (preview) return;
    if (active >= entries.length - 2) {
      const more = nextEntries(entries, BATCH);
      if (more.length) setEntries((prev) => [...prev, ...more]);
    }
  }, [active, entries, preview]);

  // --- a card link opened while the app is already open: show its cards next
  useEffect(() => {
    clearCardLink(); // read once at the start; a reload then shows the normal feed
    const onHash = () => {
      const ids = linkedCards();
      clearCardLink();
      if (!ids.length) return;
      const at = activeIndex.current + 1;
      setEntries((prev) => [...prev.slice(0, at), ...sharedEntries(ids, prev.slice(0, at)), ...prev.slice(at)]);
      requestAnimationFrame(() => {
        const feed = feedRef.current;
        if (feed) feed.scrollTo({ top: at * feed.clientHeight, behavior: 'smooth' });
      });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // --- computer: arrow keys, Page Up/Down and j/k move between cards
  const desktop = useDesktop();
  const step = useCallback((dir: 1 | -1) => {
    const feed = feedRef.current;
    if (feed) feed.scrollBy({ top: dir * feed.clientHeight, behavior: 'smooth' });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (document.querySelector('.sheet, .onb')) return;
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable]')) return;
      const dir = { ArrowDown: 1, PageDown: 1, j: 1, ArrowUp: -1, PageUp: -1, k: -1 }[e.key] as 1 | -1 | undefined;
      if (!dir) return;
      e.preventDefault();
      step(dir);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  // --- topic changes apply right away to the cards after the current one
  // (cards from a shared link stay in place; a sync that brings the same settings changes nothing)
  const lastPrefs = useRef(JSON.stringify(prefs));
  useEffect(() => {
    const key = JSON.stringify(prefs);
    if (key === lastPrefs.current) return;
    lastPrefs.current = key;
    setEntries((prev) => {
      const at = activeIndex.current + 1;
      const keep = [...prev.slice(0, at), ...prev.slice(at).filter((e) => e.shared || e.keep)];
      return [...keep, ...nextEntries(keep, BATCH)];
    });
  }, [prefs]);

  // --- double tap to like
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const onPointerUp = (e: RPointerEvent<HTMLDivElement>, cardId: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, a, input')) return;
    const now = performance.now();
    const prev = lastTap.current;
    if (prev && now - prev.t < 320 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 40) {
      lastTap.current = null;
      toggleLike(cardId, true);
      setBurst({ x: e.clientX, y: e.clientY, id: now });
      setPop('like');
    } else {
      lastTap.current = { t: now, x: e.clientX, y: e.clientY };
    }
  };

  useEffect(() => {
    if (!pop) return;
    const t = setTimeout(() => setPop(null), 450);
    return () => clearTimeout(t);
  }, [pop]);

  const share = useCallback(async (cardId: string) => {
    const card = CARD_BY_ID[cardId];
    const t = card[tr.lang];
    // A link to exactly this card: whoever opens it sees the card first.
    const url = cardLink([cardId]);
    try {
      if (navigator.share) {
        await navigator.share({ title: t.title, text: `${t.title} · Smart-Tok`, url });
        markShared(cardId);
        return;
      }
      await navigator.clipboard.writeText(`${t.title}\n${url}`);
      markShared(cardId);
      onToast(tr('linkCopied'));
    } catch {
      /* user cancelled the share sheet */
    }
  }, [tr, onToast]);

  const onPlan = useCallback(
    (cardId: string) => {
      const on = togglePlan(cardId);
      onToast(on ? tr('planAdded') : tr('planRemoved'));
    },
    [onToast, tr],
  );

  if (!entries.length) {
    return (
      <div className="empty">
        <div>
          <p>{tr('allOff')}</p>
          <button className="btn" onClick={onOpenTopics}>
            {tr('openTopics')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="feed" ref={feedRef}>
        {entries.map((e, i) => (
          <div key={e.key} className="feed-item" data-index={i} onPointerUp={(ev) => onPointerUp(ev, e.cardId)}>
            {Math.abs(i - active) <= 3 ? (
              <FeedCard
                card={CARD_BY_ID[e.cardId]}
                entry={e}
                active={i === active}
                pop={i === active ? pop : null}
                onPop={setPop}
                onMore={onMore}
                onPerson={onPerson}
                onShare={share}
                onPlan={onPlan}
              />
            ) : (
              <div className="card" />
            )}
          </div>
        ))}
        {preview && (
          <div className="feed-item">
            <div className="card preview-end">
              <h2>{tr('previewEnd')}</h2>
              <p>{tr('previewEndText')}</p>
              <button className="btn" onClick={preview.onStart}>
                {tr('previewStart')}
              </button>
            </div>
          </div>
        )}
      </div>

      {!scrolled && active === 0 && (
        <div className="swipe-hint" aria-hidden="true">
          <Icon name="chevron" size={18} />
          {tr(desktop ? 'swipeHintDesktop' : 'swipeHint')}
        </div>
      )}

      {/* computer: buttons beside the card to move between cards */}
      <div className="feed-nav">
        <button className="glass-btn" onClick={() => step(-1)} disabled={active === 0} aria-label={tr('prevCard')}>
          <Icon name="chevron" size={20} />
        </button>
        <button className="glass-btn" onClick={() => step(1)} aria-label={tr('nextCard')}>
          <Icon name="chevron" size={20} />
        </button>
      </div>

      {burst && (
        <div key={burst.id} className="burst" style={{ left: burst.x, top: burst.y }} onAnimationEnd={() => setBurst(null)}>
          <Icon name="heart" filled size={96} />
        </div>
      )}
    </>
  );
}

interface FeedCardProps {
  card: Card;
  entry: FeedEntry;
  active: boolean;
  pop: string | null;
  onPop: (what: string) => void;
  onMore: (cardId: string) => void;
  onPerson?: (personId: string) => void;
  onShare: (cardId: string) => Promise<void>;
  onPlan: (cardId: string) => void;
}

/** One card in the feed with its own action bar. */
const FeedCard = memo(function FeedCard({ card, entry, active, pop, onPop, onMore, onPerson, onShare, onPlan }: FeedCardProps) {
  const tr = useT();
  const record = useStore((s) => s.cards[card.id]);
  const [checkIn, setCheckIn] = useState<'ask' | 'done' | 'later' | null>(entry.checkIn ? 'ask' : null);
  const hasMore = !!(card.de.more || card.de.source || card.slides?.some((s) => s.de.more || s.de.source));
  // News have nothing to put into practice, so they get no "Umsetzen" button.
  const hasAct = !!card.de.act;
  const planned = !!record?.planAt && !record.planDone;
  const done = !!record?.planDone;

  const banner =
    checkIn === 'ask' ? (
      <div className="checkin">
        <p>
          <Icon name="target" size={16} />
          {tr('checkInQuestion')}
        </p>
        <div className="checkin-btns">
          <button
            className="btn small"
            onClick={() => {
              setPlanDone(card.id, true);
              setCheckIn('done');
            }}
          >
            <Icon name="check" size={16} />
            {tr('checkInDone')}
          </button>
          <button className="btn small ghost" onClick={() => setCheckIn('later')}>
            {tr('checkInLater')}
          </button>
        </div>
      </div>
    ) : checkIn === 'done' ? (
      <div className="checkin done">
        <p>
          <Icon name="check" size={16} />
          {tr('checkInDoneNote')}
        </p>
      </div>
    ) : checkIn === 'later' ? (
      <div className="checkin">
        <p>{tr('checkInLaterNote')}</p>
      </div>
    ) : undefined;

  const actions = (
    <nav className="card-bar" aria-label={tr('actions')}>
      <button
        className={`bar-btn ${record?.reaction === 1 ? 'on-like' : ''} ${pop === 'like' ? 'pop' : ''}`}
        aria-label={tr('like')}
        aria-pressed={record?.reaction === 1}
        onClick={() => {
          if (record?.reaction !== 1) onPop('like');
          toggleLike(card.id);
        }}
      >
        <Icon name="heart" filled={record?.reaction === 1} />
      </button>
      <button
        className={`bar-btn ${record?.reaction === -1 ? 'on-dislike' : ''}`}
        aria-label={tr('dislike')}
        aria-pressed={record?.reaction === -1}
        onClick={() => toggleDislike(card.id)}
      >
        <Icon name="dislike" filled={record?.reaction === -1} />
      </button>
      <button
        className={`bar-btn ${record?.saved ? 'on-save' : ''} ${pop === 'save' ? 'pop' : ''}`}
        aria-label={record?.saved ? tr('saved') : tr('save')}
        aria-pressed={!!record?.saved}
        onClick={() => {
          if (!record?.saved) onPop('save');
          toggleSave(card.id);
        }}
      >
        <Icon name="bookmark" filled={!!record?.saved} />
      </button>
      {hasAct && (
      <button
        className={`bar-btn bar-plan ${planned ? 'on-plan' : ''} ${done ? 'on-done' : ''} ${pop === 'plan' ? 'pop' : ''}`}
        aria-label={done ? tr('planDone') : planned ? tr('planOn') : tr('plan')}
        aria-pressed={planned || done}
        disabled={done}
        onClick={() => {
          if (!planned) onPop('plan');
          onPlan(card.id);
        }}
      >
        <Icon name={done ? 'targetDone' : 'target'} />
        <span>{done ? tr('planDoneShort') : planned ? tr('planOnShort') : tr('planShort')}</span>
      </button>
      )}
      <span className="bar-gap" />
      <button
        className="bar-btn"
        aria-label={tr('more')}
        disabled={!hasMore}
        onClick={() => {
          markMore(card.id);
          onMore(card.id);
        }}
      >
        <Icon name="info" />
      </button>
      <button className="bar-btn" aria-label={tr('share')} onClick={() => void onShare(card.id)}>
        <Icon name="share" />
      </button>
    </nav>
  );

  return (
    <CardView
      card={card}
      active={active}
      actions={actions}
      banner={banner}
      onPerson={onPerson}
      badge={entry.shared ? tr('sharedBadge') : entry.due && !entry.checkIn ? tr('reviewBadge') : entry.checkIn ? tr('checkInBadge') : undefined}
    />
  );
});
