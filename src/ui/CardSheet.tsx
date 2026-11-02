import { CARD_BY_ID } from '../content';
import { AREA_BY_ID } from '../content/taxonomy';
import { useT } from '../i18n/strings';
import { toggleDislike, toggleLike, toggleSave, useStore } from '../store/store';
import { CardDetail, Paragraphs } from './CardView';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

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

/** A card opened from the profile: full text, reactions and background in one sheet. */
export function CardSheet({ cardId, onClose }: { cardId: string; onClose: () => void }) {
  const tr = useT();
  const card = CARD_BY_ID[cardId];
  const record = useStore((s) => s.cards[cardId]);
  if (!card) return null;
  return (
    <Sheet title={AREA_BY_ID[card.area].label[tr.lang]} onClose={onClose}>
      <CardDetail card={card} />
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
      </div>
      <div className="section-label">{tr('background')}</div>
      <MoreContent cardId={cardId} />
    </Sheet>
  );
}
