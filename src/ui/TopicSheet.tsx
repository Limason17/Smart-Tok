import { useEffect, useState, type CSSProperties } from 'react';
import { ACTIVE_AREAS, cardsInArea, UPCOMING_AREAS } from '../content';
import type { Level3 } from '../algo/engine';
import { useT } from '../i18n/strings';
import {
  addSuggestion,
  removeSuggestion,
  setPrefs,
  SUGGESTION_MAX,
  SUGGESTION_NOTE_MAX,
  toggleArea,
  toggleSub,
  useStore,
} from '../store/store';
import { Icon } from './Icon';
import { ProgressRing, Segmented, Sheet, Switch } from './Sheet';

// Last shown percentage per area, so the ring animates from there on the next open.
const lastShown: Record<string, number> = {};

export function TopicSheet({ onClose }: { onClose: () => void }) {
  const tr = useT();
  const prefs = useStore((s) => s.prefs);
  const records = useStore((s) => s.cards);
  const suggestions = useStore((s) => s.suggestions);
  const [open, setOpen] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [thanks, setThanks] = useState(false);
  const [startPct] = useState(() => ({ ...lastShown }));

  const progress: Record<string, { read: number; total: number; pct: number }> = {};
  for (const area of ACTIVE_AREAS) {
    const cards = cardsInArea(area.id);
    const read = cards.filter((c) => (records[c.id]?.views ?? 0) > 0).length;
    progress[area.id] = { read, total: cards.length, pct: cards.length ? (read / cards.length) * 100 : 0 };
  }
  useEffect(() => {
    for (const [id, p] of Object.entries(progress)) lastShown[id] = p.pct;
  });

  const submit = () => {
    if (addSuggestion(text, note)) {
      setText('');
      setNote('');
      setThanks(true);
      setTimeout(() => setThanks(false), 2500);
    }
  };

  const weightOptions: { value: Level3; label: string }[] = [
    { value: 'less', label: tr('less') },
    { value: 'normal', label: tr('normal') },
    { value: 'more', label: tr('moreOften') },
  ];

  return (
    <Sheet title={tr('topics')} onClose={onClose}>
      <div className="section-label">{tr('mix')}</div>
      <Segmented
        value={prefs.mix}
        options={[
          { value: 'random', label: tr('mixRandom') },
          { value: 'custom', label: tr('mixCustom') },
        ]}
        onChange={(mix) => setPrefs({ mix })}
      />
      <p className="hint">{prefs.mix === 'random' ? tr('mixHintRandom') : tr('mixHintCustom')}</p>

      <div className="section-label">{tr('topics')}</div>
      {ACTIVE_AREAS.map((area) => {
        const cards = cardsInArea(area.id);
        const { read, pct } = progress[area.id];
        const from = startPct[area.id];
        const on = !prefs.disabledAreas.includes(area.id);
        const isOpen = open === area.id;
        const subs = area.subtopics.filter((s) => cards.some((c) => c.sub === s.id));
        return (
          <div key={area.id} className={`topic ${isOpen ? 'open' : ''} ${on ? '' : 'off'}`} style={{ '--area': area.color } as CSSProperties}>
            <div className="topic-row">
              <button className="topic-main" onClick={() => setOpen(isOpen ? null : area.id)} aria-expanded={isOpen}>
                <span className="topic-icon">
                  <Icon name={area.icon} size={20} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <div className="topic-name">{area.label[tr.lang]}</div>
                  <div className="topic-sub">
                    {read} / {cards.length} {tr('read')}
                  </div>
                </span>
                <Icon name="chevron" size={18} className="chev" />
              </button>
              <ProgressRing value={pct} from={from} />
              <Switch on={on} onChange={() => toggleArea(area.id)} label={area.label[tr.lang]} />
            </div>
            {prefs.mix === 'custom' && on && (
              <div className="topic-weight">
                <Segmented
                  small
                  value={prefs.areaWeight[area.id] ?? 'normal'}
                  options={weightOptions}
                  onChange={(w) => setPrefs({ areaWeight: { ...prefs.areaWeight, [area.id]: w } })}
                />
              </div>
            )}
            {isOpen && (
              <div className="subs">
                {subs.map((sub) => {
                  const subOn = on && !prefs.disabledSubs.includes(`${area.id}/${sub.id}`);
                  const n = cards.filter((c) => c.sub === sub.id).length;
                  return (
                    <div className="sub-row" key={sub.id}>
                      <span>
                        {sub.label[tr.lang]}
                        <span className="count">{n}</span>
                      </span>
                      <Switch on={subOn} onChange={() => (on ? toggleSub(area.id, sub.id) : toggleArea(area.id))} label={sub.label[tr.lang]} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {UPCOMING_AREAS.length > 0 && (
        <>
          <div className="section-label">{tr('upcoming')}</div>
          <div className="upcoming">
            {UPCOMING_AREAS.map((a) => (
              <span key={a.id}>{a.label[tr.lang]}</span>
            ))}
          </div>
        </>
      )}

      <div className="section-label">{tr('suggestTitle')}</div>
      <p className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
        {tr('suggestHint')}
      </p>
      <input
        className="field"
        value={text}
        maxLength={SUGGESTION_MAX}
        placeholder={tr('suggestPlaceholder')}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        enterKeyHint="send"
      />
      <textarea className="field" rows={2} value={note} maxLength={SUGGESTION_NOTE_MAX} placeholder={tr('suggestNote')} onChange={(e) => setNote(e.target.value)} />
      <div className="btn-row">
        <button className="btn" disabled={!text.trim()} onClick={submit}>
          {tr('suggestSend')}
        </button>
      </div>
      {thanks && <p className="hint">{tr('suggestThanks')}</p>}
      {suggestions.length > 0 && (
        <>
          <div className="section-label">{tr('yourSuggestions')}</div>
          {suggestions.map((s) => (
            <div className="suggestion" key={s.id}>
              <span>
                {s.text}
                {s.note && <small>{s.note}</small>}
              </span>
              <button className="link-btn" onClick={() => removeSuggestion(s.id)}>
                {tr('remove')}
              </button>
            </div>
          ))}
        </>
      )}
    </Sheet>
  );
}
