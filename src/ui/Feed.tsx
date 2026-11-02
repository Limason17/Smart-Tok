import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { CARD_BY_ID, CARDS } from '../content';
import { pickNext } from '../algo/engine';
import { useT } from '../i18n/strings';
import {
  getState,
  markMore,
  markShared,
  recordView,
  seenMap,
  toggleDislike,
  toggleLike,
  toggleSave,
  useStore,
} from '../store/store';
import { CardView } from './CardView';
import { Icon } from './Icon';

interface FeedEntry {
  key: string;
  cardId: string;
}

const BATCH = 3;
let entryCounter = 0;

function nextEntries(existing: FeedEntry[], count: number): FeedEntry[] {
  const s = getState();
  const seen = seenMap(s.cards);
  const recent = existing.map((e) => e.cardId);
  const out: FeedEntry[] = [];
  for (let i = 0; i < count; i++) {
    const pick = pickNext({ cards: CARDS, seen, prefs: s.prefs, algo: s.algo, recent, now: Date.now() });
    if (!pick) break;
    recent.push(pick.card.id);
    out.push({ key: `${pick.card.id}-${entryCounter++}`, cardId: pick.card.id });
  }
  return out;
}

export interface FeedProps {
  onMore: (cardId: string) => void;
  onToast: (text: string) => void;
  onOpenTopics: () => void;
}

export function Feed({ onMore, onToast, onOpenTopics }: FeedProps) {
  const tr = useT();
  const prefs = useStore((s) => s.prefs);
  const [entries, setEntries] = useState<FeedEntry[]>(() => nextEntries([], BATCH + 1));
  const [active, setActive] = useState(0);
  const [burst, setBurst] = useState<{ x: number; y: number; id: number } | null>(null);
  const [pop, setPop] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const activeSince = useRef(performance.now());
  const activeIndex = useRef(0);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const activeCardId = entries[active]?.cardId;
  const record = useStore((s) => (activeCardId ? s.cards[activeCardId] : undefined));

  // --- dwell tracking: the active card is the one crossing the middle of the screen
  const flushDwell = useCallback(() => {
    const entry = entriesRef.current[activeIndex.current];
    const now = performance.now();
    if (entry) recordView(entry.cardId, now - activeSince.current);
    activeSince.current = now;
  }, []);

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
      if (document.visibilityState === 'hidden') flushDwell();
      else activeSince.current = performance.now();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flushDwell);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flushDwell);
    };
  }, [flushDwell]);

  // --- endless: keep a few cards ahead of the active one
  useEffect(() => {
    if (active >= entries.length - 2) {
      const more = nextEntries(entries, BATCH);
      if (more.length) setEntries((prev) => [...prev, ...more]);
    }
  }, [active, entries]);

  // --- topic changes apply right away to the cards after the current one
  const firstPrefs = useRef(true);
  useEffect(() => {
    if (firstPrefs.current) {
      firstPrefs.current = false;
      return;
    }
    setEntries((prev) => {
      const keep = prev.slice(0, activeIndex.current + 1);
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

  const share = async (cardId: string) => {
    const card = CARD_BY_ID[cardId];
    const t = card[tr.lang];
    const text = [t.title, t.body, t.quote ? `„${t.quote.text}“ — ${t.quote.author}` : '', t.apply ?? '']
      .filter(Boolean)
      .join('\n\n')
      .replace(/\*\*/g, '');
    markShared(cardId);
    try {
      if (navigator.share) {
        await navigator.share({ title: t.title, text: `${text}\n\nSmart-Tok` });
        return;
      }
      await navigator.clipboard.writeText(text);
      onToast(tr('copied'));
    } catch {
      /* user cancelled the share sheet */
    }
  };

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

  const card = activeCardId ? CARD_BY_ID[activeCardId] : undefined;
  const hasMore = !!card && !!(card.de.more || card.de.source || card.slides?.some((s) => s.de.more || s.de.source));

  return (
    <>
      <div className="feed" ref={feedRef}>
        {entries.map((e, i) => (
          <div key={e.key} className="feed-item" data-index={i} onPointerUp={(ev) => onPointerUp(ev, e.cardId)}>
            {Math.abs(i - active) <= 3 ? <CardView card={CARD_BY_ID[e.cardId]} /> : <div className="card" />}
          </div>
        ))}
      </div>

      {card && (
        <nav className="rail" aria-label="Aktionen">
          <button
            className={`rail-btn ${record?.reaction === 1 ? 'on-like' : ''} ${pop === 'like' ? 'pop' : ''}`}
            aria-label={tr('like')}
            aria-pressed={record?.reaction === 1}
            onClick={() => {
              if (record?.reaction !== 1) setPop('like');
              toggleLike(card.id);
            }}
          >
            <Icon name="heart" filled={record?.reaction === 1} />
          </button>
          <button
            className={`rail-btn ${record?.reaction === -1 ? 'on-dislike' : ''}`}
            aria-label={tr('dislike')}
            aria-pressed={record?.reaction === -1}
            onClick={() => toggleDislike(card.id)}
          >
            <Icon name="dislike" filled={record?.reaction === -1} />
          </button>
          <button
            className={`rail-btn ${record?.saved ? 'on-save' : ''} ${pop === 'save' ? 'pop' : ''}`}
            aria-label={record?.saved ? tr('saved') : tr('save')}
            aria-pressed={!!record?.saved}
            onClick={() => {
              if (!record?.saved) setPop('save');
              toggleSave(card.id);
            }}
          >
            <Icon name="bookmark" filled={!!record?.saved} />
          </button>
          <button
            className="rail-btn"
            aria-label={tr('more')}
            disabled={!hasMore}
            onClick={() => {
              markMore(card.id);
              onMore(card.id);
            }}
          >
            <Icon name="info" />
          </button>
          <button className="rail-btn" aria-label={tr('share')} onClick={() => void share(card.id)}>
            <Icon name="share" />
          </button>
        </nav>
      )}

      {!scrolled && active === 0 && (
        <div className="swipe-hint" aria-hidden="true">
          <Icon name="chevron" size={18} />
          {tr('swipeHint')}
        </div>
      )}

      {burst && (
        <div key={burst.id} className="burst" style={{ left: burst.x, top: burst.y }} onAnimationEnd={() => setBurst(null)}>
          <Icon name="heart" filled size={96} />
        </div>
      )}
    </>
  );
}
