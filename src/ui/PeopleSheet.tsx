import { useMemo, type CSSProperties } from 'react';
import { cardsOfPerson, CARD_BY_ID } from '../content';
import { introId, PEOPLE, PERSON_BY_ID } from '../content/people';
import { AREA_BY_ID } from '../content/taxonomy';
import { useT } from '../i18n/strings';
import { useStore } from '../store/store';
import type { CardRecord } from '../store/db';
import { Avatar, Paragraphs } from './CardView';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

function readCount(personId: string, records: Record<string, CardRecord>) {
  return cardsOfPerson(personId).filter((c) => (records[c.id]?.views ?? 0) > 0).length;
}

/** All personalities, the ones you have read most about first. */
export function PeopleSheet({ onClose, onOpenPerson }: { onClose: () => void; onOpenPerson: (personId: string) => void }) {
  const tr = useT();
  const records = useStore((s) => s.cards);
  const people = useMemo(
    () =>
      PEOPLE.map((p) => ({ p, read: readCount(p.id, records), total: cardsOfPerson(p.id).length })).sort(
        (a, b) => b.read - a.read || b.read / b.total - a.read / a.total || b.total - a.total || a.p.name.localeCompare(b.p.name),
      ),
    [records],
  );
  return (
    <Sheet title={tr('people')} onClose={onClose}>
      <p className="hint tab-hint">{tr('peopleHint')}</p>
      <div className="list">
        {people.map(({ p, read, total }) => (
          <button key={p.id} className="row person-row" onClick={() => onOpenPerson(p.id)} style={{ '--area': AREA_BY_ID[p.area].color } as CSSProperties}>
            <Avatar personId={p.id} size={42} />
            <span className="row-text">
              <span className="row-title">{p.name}</span>
              <span className="row-sub">{p[tr.lang].role}</span>
              <span className="person-progress" aria-label={tr('peopleRead').replace('{n}', String(read)).replace('{m}', String(total))}>
                <i style={{ width: `${(read / total) * 100}%` }} />
              </span>
            </span>
            <span className="person-count">
              <b>{read}</b>/{total}
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/** A person's profile: who they are, then all their cards with the introduction pinned on top. */
export function PersonSheet({
  personId,
  onClose,
  onOpenCard,
}: {
  personId: string;
  onClose: () => void;
  onOpenCard: (cardId: string) => void;
}) {
  const tr = useT();
  const records = useStore((s) => s.cards);
  const p = PERSON_BY_ID[personId];
  if (!p) return null;
  const t = p[tr.lang];
  const cards = cardsOfPerson(p.id);
  const read = cards.filter((c) => (records[c.id]?.views ?? 0) > 0).length;
  const saved = cards.filter((c) => records[c.id]?.saved).length;
  const area = AREA_BY_ID[p.area];
  return (
    <Sheet title={p.name} onClose={onClose}>
      <div className="person-head" style={{ '--area': area.color } as CSSProperties}>
        <Avatar personId={p.id} size={76} />
        <h3>{p.name}</h3>
        <p className="person-role">{t.role}</p>
        <p className="person-meta">{t.meta}</p>
      </div>

      <div className="stats">
        <div className="stat">
          <b>{cards.length}</b>
          <span>{tr('personCards')}</span>
        </div>
        <div className="stat">
          <b>{read}</b>
          <span>{tr('personRead')}</span>
        </div>
        <div className="stat">
          <b>{saved}</b>
          <span>{tr('personSaved')}</span>
        </div>
      </div>

      <dl className="person-facts">
        {t.facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              <Paragraphs text={value} lang={tr.lang} />
            </dd>
          </div>
        ))}
      </dl>

      <div className="section-label">{tr('personCards')}</div>
      <div className="list">
        {cards.map((c) => {
          const r = records[c.id];
          const isIntro = c.id === introId(p.id);
          const cardArea = AREA_BY_ID[CARD_BY_ID[c.id].area];
          return (
            <button
              key={c.id}
              className={`row ${isIntro ? 'pinned' : ''}`}
              onClick={() => onOpenCard(c.id)}
              style={{ '--area': cardArea.color } as CSSProperties}
            >
              <span className="row-icon">
                <Icon name={isIntro ? 'pin' : cardArea.icon} size={17} />
              </span>
              <span className="row-text">
                <span className="row-title">{c[tr.lang].title}</span>
                <span className="row-sub">{isIntro ? tr('pinned') : cardArea.label[tr.lang]}</span>
              </span>
              <span className="row-flags">
                {r?.reaction === 1 && <Icon name="heart" filled size={15} className="flag-like" />}
                {r?.saved && <Icon name="bookmark" filled size={15} className="flag-save" />}
                {(r?.views ?? 0) > 0 ? <Icon name="check" size={15} className="flag-read" /> : <span className="unread-dot" aria-label={tr('unread')} />}
              </span>
            </button>
          );
        })}
      </div>
      {t.source && (
        <p className="more-source" style={{ marginTop: 18 }}>
          <b>{tr('source')}:</b> {t.source}
        </p>
      )}
    </Sheet>
  );
}
