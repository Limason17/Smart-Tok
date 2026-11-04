import { useContext, useEffect } from 'react';
import { CARD_BY_ID } from '../content';
import { AREA_BY_ID } from '../content/taxonomy';
import { useT } from '../i18n/strings';
import { countsAsView, recordView, setPlanDone, toggleDislike, toggleLike, togglePlan, toggleSave, useStore } from '../store/store';
import { CardDetail, Paragraphs } from './CardView';
import { Icon } from './Icon';
import { Sheet, SheetLevel } from './Sheet';

/** Background text and sources of a card (and of every slide of a stack). */
export function MoreContent({ cardId }: { cardId: string }) {
  const tr = useT();
  const card = CARD_BY_ID[cardId];
  const parts = [card[tr.lang], ...(card.slides ?? []).map((s) => s[tr.lang])].filter((t) => t.more || t.source);
  if (!parts.length) return <p className="hint">{tr('noMore')}</p>;
  return (
    <>
      {parts.map((t, i) => (
        <div key={i} style={{ marginTop: i ? 22 : 4 }}>
          {parts.length > 1 && <div className="section-label">{t.title}</div>}
          {t.more && (
            <div className="more-text">
              <Paragraphs text={t.more} lang={tr.lang} />
            </div>
          )}
          {t.source && (
            <p className="more-source">
              <b>{tr('source')}:</b> {t.source}
            </p>
          )}
        </div>
      ))}
    </>
  );
}

export function MoreSheet({ cardId, onClose }: { cardId: string; onClose: () => void }) {
  const tr = useT();
  return (
    <Sheet title={tr('more')} onClose={onClose}>
      <MoreContent cardId={cardId} />
    </Sheet>
  );
}

/**
 * Reading a card in a sheet counts like reading it in the feed: history, "gelesen", reviews,
 * Umsetzen check-backs and the algorithm all see it. Time in the background does not count,
 * and a sheet closed within a moment (a mis-tap) is not counted unless the card got a reaction.
 * While another sheet lies on top of it (e.g. a person opened from the card), the view is closed
 * and a new one starts when it is uncovered, as if the card had been opened again.
 */
export function useSheetView(cardId: string, active = true) {
  useEffect(() => {
    if (!active) return;
    let since: number | null = document.visibilityState === 'hidden' ? null : performance.now();
    let dwell = 0;
    const pause = () => {
      if (since !== null) dwell += performance.now() - since;
      since = null;
    };
    const flush = () => {
      pause();
      if (countsAsView(cardId, dwell)) recordView(cardId, dwell);
      dwell = 0;
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush();
      else if (since === null) since = performance.now();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [cardId, active]);
}

/** A card opened outside the feed (profile lists, a person's profile): full text, reactions and background in one sheet. */
export function CardSheet({ cardId, onClose, onPerson }: { cardId: string; onClose: () => void; onPerson?: (personId: string) => void }) {
  const tr = useT();
  const card = CARD_BY_ID[cardId];
  const record = useStore((s) => s.cards[cardId]);
  useSheetView(cardId, useContext(SheetLevel).top);
  if (!card) return null;
  return (
    <Sheet title={AREA_BY_ID[card.area].label[tr.lang]} onClose={onClose}>
      <CardDetail card={card} onPerson={onPerson} />
      <div className="detail-actions">
        <button className={`pill ${record?.reaction === 1 ? 'on-like' : ''}`} aria-pressed={record?.reaction === 1} onClick={() => toggleLike(cardId)}>
          <Icon name="heart" filled={record?.reaction === 1} size={18} />
          {tr('like')}
        </button>
        <button className={`pill ${record?.reaction === -1 ? 'on' : ''}`} aria-pressed={record?.reaction === -1} onClick={() => toggleDislike(cardId)}>
          <Icon name="dislike" filled={record?.reaction === -1} size={18} />
          {tr('dislike')}
        </button>
        <button className={`pill ${record?.saved ? 'on-save' : ''}`} aria-pressed={!!record?.saved} onClick={() => toggleSave(cardId)}>
          <Icon name="bookmark" filled={record?.saved} size={18} />
          {record?.saved ? tr('saved') : tr('save')}
        </button>
        {!card.de.act && !record?.planAt ? null : record?.planDone ? (
          <button className="pill on-done" onClick={() => setPlanDone(cardId, false)}>
            <Icon name="targetDone" size={18} />
            {tr('planDone')}
          </button>
        ) : (
          <button className={`pill ${record?.planAt ? 'on-save' : ''}`} aria-pressed={!!record?.planAt} onClick={() => togglePlan(cardId)}>
            <Icon name="target" size={18} />
            {record?.planAt ? tr('planOnShort') : tr('planShort')}
          </button>
        )}
        {record?.planAt && !record.planDone && (
          <button className="pill" onClick={() => setPlanDone(cardId, true)}>
            <Icon name="check" size={18} />
            {tr('planMarkDone')}
          </button>
        )}
      </div>
      <div className="section-label">{tr('background')}</div>
      <MoreContent cardId={cardId} />
    </Sheet>
  );
}
