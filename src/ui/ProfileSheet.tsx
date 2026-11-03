import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { archiveVersion, loadArchived, onArchive } from '../content/archive';
import { ACTIVE_AREAS, CARD_BY_ID, CARDS } from '../content';
import { AREA_BY_ID, STYLE_LABELS, STYLES, subtopicLabel, type Lang } from '../content/taxonomy';
import {
  areaShares,
  longMultiplier,
  REVIEW_STEPS,
  reviewDue,
  sessionMultiplier,
  type Adjust,
  type Exploration,
} from '../algo/engine';
import { useT, type StringKey } from '../i18n/strings';
import { eventsBetween, localDate, resetAlgorithm, setAdjust, setPlanDone, setPrefs, streak, togglePlan, useStore } from '../store/store';
import type { CardRecord } from '../store/db';
import { AccountCard } from './AccountSheet';
import { actOf } from './CardView';
import { Icon } from './Icon';
import { Segmented, Sheet } from './Sheet';

type Tab = 'overview' | 'plan' | 'saved' | 'history';
// Remembered while the app runs, so closing a card brings you back to the same tab.
let lastTab: Tab = 'overview';
let lastMonth: number | null = null;
let lastDay: string | null = null;

export interface ProfileSheetProps {
  onClose: () => void;
  onOpenCard: (cardId: string) => void;
  onOpenSettings: () => void;
  onOpenTopics: () => void;
  onOpenAccount: () => void;
  onOpenAlgo: () => void;
}

export function ProfileSheet({ onClose, onOpenCard, onOpenSettings, onOpenTopics, onOpenAccount, onOpenAlgo }: ProfileSheetProps) {
  const tr = useT();
  const [tab, setTab] = useState<Tab>(lastTab);
  useEffect(() => {
    lastTab = tab;
  }, [tab]);
  // Saved news cards that already left the app are fetched from the archive.
  const records = useStore((s) => s.cards);
  useEffect(() => loadArchived(Object.keys(records)), [records]);
  useSyncExternalStore(onArchive, archiveVersion);
  const openPlans = Object.values(records).filter((r) => r.planAt && !r.planDone && CARD_BY_ID[r.id]).length;
  return (
    <Sheet title={tr('profile')} onClose={onClose}>
      <AccountCard onOpen={onOpenAccount} />
      <Segmented<Tab>
        small
        className="tabs"
        value={tab}
        options={[
          { value: 'overview', label: tr('tabOverview') },
          { value: 'plan', label: openPlans ? `${tr('tabPlan')} · ${openPlans}` : tr('tabPlan') },
          { value: 'saved', label: tr('tabSaved') },
          { value: 'history', label: tr('tabHistory') },
        ]}
        onChange={setTab}
      />
      {tab === 'overview' && (
        <Overview onOpenCard={onOpenCard} onOpenSettings={onOpenSettings} onOpenTopics={onOpenTopics} onOpenAlgo={onOpenAlgo} />
      )}
      {tab === 'plan' && <Plans onOpenCard={onOpenCard} />}
      {tab === 'saved' && <Saved onOpenCard={onOpenCard} />}
      {tab === 'history' && <History onOpenCard={onOpenCard} />}
    </Sheet>
  );
}

/** "Mein Algorithmus" in its own sheet, opened from the profile. */
export function AlgoSheet({ onClose, onOpenTopics, onToast }: { onClose: () => void; onOpenTopics: () => void; onToast: (t: string) => void }) {
  const tr = useT();
  return (
    <Sheet title={tr('myAlgo')} onClose={onClose}>
      <MyAlgorithm onOpenTopics={onOpenTopics} onToast={onToast} />
    </Sheet>
  );
}

// ---------------------------------------------------------------- shared bits

function countLabel(n: number, tr: ReturnType<typeof useT>) {
  return `${n} ${n === 1 ? tr('cardOne') : tr('cardMany')}`;
}

function ago(t: number, lang: Lang): string {
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const s = (t - Date.now()) / 1000;
  if (s > -60) return rtf.format(0, 'second');
  if (s > -3600) return rtf.format(Math.round(s / 60), 'minute');
  if (s > -86_400) return rtf.format(Math.round(s / 3600), 'hour');
  if (s > -7 * 86_400) return rtf.format(Math.round(s / 86_400), 'day');
  return new Date(t).toLocaleDateString(lang, { day: 'numeric', month: 'short' });
}

function CardRow({ cardId, record, meta, onOpen }: { cardId: string; record?: CardRecord; meta?: string; onOpen: (id: string) => void }) {
  const tr = useT();
  const card = CARD_BY_ID[cardId];
  if (!card) return null;
  const area = AREA_BY_ID[card.area];
  return (
    <button className="row" onClick={() => onOpen(cardId)} style={{ '--area': area.color } as CSSProperties}>
      <span className="row-icon">
        <Icon name={area.icon} size={17} />
      </span>
      <span className="row-text">
        <span className="row-title">{card[tr.lang].title}</span>
        <span className="row-sub">
          {subtopicLabel(card.area, card.sub, tr.lang)}
          {meta ? ` · ${meta}` : ''}
        </span>
      </span>
      <span className="row-flags">
        {record?.reaction === 1 && <Icon name="heart" filled size={15} className="flag-like" />}
        {record?.reaction === -1 && <Icon name="dislike" size={15} />}
        {record?.saved && <Icon name="bookmark" filled size={15} className="flag-save" />}
        {record?.planAt && <Icon name={record.planDone ? 'targetDone' : 'target'} size={15} className="flag-plan" />}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------- overview

function Overview({
  onOpenCard,
  onOpenSettings,
  onOpenTopics,
  onOpenAlgo,
}: {
  onOpenCard: (id: string) => void;
  onOpenSettings: () => void;
  onOpenTopics: () => void;
  onOpenAlgo: () => void;
}) {
  const tr = useT();
  const cards = useStore((s) => s.cards);
  const days = useStore((s) => s.days);
  const records = Object.values(cards);
  const read = records.filter((r) => r.views > 0).length;
  const done = records.filter((r) => r.planDone).length;
  const [day, setDay] = useState<string | null>(lastDay);
  useEffect(() => {
    lastDay = day;
  }, [day]);

  return (
    <>
      <div className="stats">
        <Stat value={streak(days)} label={tr('statStreak')} icon="flame" />
        <Stat value={read} label={tr('statRead')} />
        <Stat value={done} label={tr('statDone')} icon="targetDone" />
      </div>

      <Calendar days={days} selected={day} onSelect={(d) => setDay(d === day ? null : d)} />
      {day && <DayCards date={day} onOpenCard={onOpenCard} />}

      <div className="menu">
        <MenuRow icon="steps" title={tr('menuAlgo')} sub={tr('menuAlgoSub')} onClick={onOpenAlgo} />
        <MenuRow icon="layers" title={tr('menuTopics')} sub={tr('menuTopicsSub')} onClick={onOpenTopics} />
        <MenuRow icon="settings" title={tr('menuSettings')} sub={tr('menuSettingsSub')} onClick={onOpenSettings} />
      </div>
    </>
  );
}

function MenuRow({ icon, title, sub, onClick }: { icon: string; title: string; sub: string; onClick: () => void }) {
  return (
    <button className="menu-row" onClick={onClick}>
      <span className="menu-icon">
        <Icon name={icon} size={19} />
      </span>
      <span className="row-text">
        <span className="row-title">{title}</span>
        <span className="row-sub">{sub}</span>
      </span>
      <Icon name="chevron" size={18} className="me-chev" />
    </button>
  );
}

function Stat({ value, label, icon }: { value: number; label: string; icon?: string }) {
  return (
    <div className="stat">
      <b>
        {icon && value > 0 && <Icon name={icon} size={18} className="stat-icon" />}
        {value.toLocaleString()}
      </b>
      <span>{label}</span>
    </div>
  );
}

function Calendar({ days, selected, onSelect }: { days: Record<string, number>; selected: string | null; onSelect: (date: string) => void }) {
  const tr = useT();
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const [month, setMonth] = useState(lastMonth ?? thisMonth);
  useEffect(() => {
    lastMonth = month;
  }, [month]);

  const first = new Date(month);
  const weekStart = tr.lang === 'de' ? 1 : 0;
  const lead = (first.getDay() - weekStart + 7) % 7;
  const inMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const today = localDate(Date.now());
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 7 + weekStart + i).toLocaleDateString(tr.lang, { weekday: 'narrow' }),
  );
  const shift = (n: number) => setMonth(new Date(first.getFullYear(), first.getMonth() + n, 1).getTime());
  const total = Array.from({ length: inMonth }, (_, i) => days[localDate(new Date(first.getFullYear(), first.getMonth(), i + 1).getTime())] ?? 0).reduce(
    (a, b) => a + b,
    0,
  );

  return (
    <div className="cal">
      <div className="cal-head">
        <button className="icon-btn" aria-label={tr('prevMonth')} onClick={() => shift(-1)}>
          <Icon name="chevron" size={18} style={{ transform: 'rotate(180deg)' }} />
        </button>
        <span>
          {first.toLocaleDateString(tr.lang, { month: 'long', year: 'numeric' })}
          <small>{countLabel(total, tr)}</small>
        </span>
        <button className="icon-btn" aria-label={tr('nextMonth')} disabled={month >= thisMonth} onClick={() => shift(1)}>
          <Icon name="chevron" size={18} />
        </button>
      </div>
      <div className="cal-grid">
        {weekdays.map((w, i) => (
          <span key={`w${i}`} className="cal-wd">
            {w}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`l${i}`} />
        ))}
        {Array.from({ length: inMonth }, (_, i) => {
          const date = localDate(new Date(first.getFullYear(), first.getMonth(), i + 1).getTime());
          const n = days[date] ?? 0;
          const level = n === 0 ? 0 : n < 3 ? 1 : n < 6 ? 2 : n < 11 ? 3 : 4;
          const future = date > today;
          return (
            <button
              key={date}
              className={`cal-day l${level} ${date === today ? 'today' : ''} ${date === selected ? 'sel' : ''}`}
              disabled={future}
              aria-label={`${date}: ${countLabel(n, tr)}`}
              aria-pressed={date === selected}
              onClick={() => onSelect(date)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DayCards({ date, onOpenCard }: { date: string; onOpenCard: (id: string) => void }) {
  const tr = useT();
  const records = useStore((s) => s.cards);
  const [ids, setIds] = useState<string[] | null>(null);
  useEffect(() => {
    let alive = true;
    const [y, m, d] = date.split('-').map(Number);
    const start = new Date(y, m - 1, d).getTime();
    const end = new Date(y, m - 1, d + 1).getTime();
    void eventsBetween(start, end).then((events) => {
      if (!alive) return;
      const seen = new Set<string>();
      const out: string[] = [];
      for (const e of events) {
        if (e.type !== 'view' || seen.has(e.card) || !CARD_BY_ID[e.card]) continue;
        seen.add(e.card);
        out.push(e.card);
      }
      setIds(out);
    });
    return () => {
      alive = false;
    };
  }, [date]);

  const [y, m, d] = date.split('-').map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString(tr.lang, { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <div className="day-cards">
      <div className="day-head">
        {label}
        {ids && <small>{countLabel(ids.length, tr)}</small>}
      </div>
      {ids && ids.length === 0 && <p className="hint">{tr('dayEmpty')}</p>}
      {ids?.map((id) => <CardRow key={id} cardId={id} record={records[id]} onOpen={onOpenCard} />)}
    </div>
  );
}

// ---------------------------------------------------------------- "Umsetzen"

function Plans({ onOpenCard }: { onOpenCard: (id: string) => void }) {
  const tr = useT();
  const records = useStore((s) => s.cards);
  const [showDone, setShowDone] = useState(false);
  const all = Object.values(records).filter((r) => r.planAt && CARD_BY_ID[r.id]);
  const open = all.filter((r) => !r.planDone).sort((a, b) => (b.planAt ?? 0) - (a.planAt ?? 0));
  const done = all.filter((r) => r.planDone).sort((a, b) => (b.planDone ?? 0) - (a.planDone ?? 0));
  if (!all.length) return <Empty icon="target" text={tr('planEmpty')} />;
  return (
    <>
      <p className="hint tab-hint">{tr('planHint')}</p>
      {open.length > 0 && <div className="section-label">{`${tr('planOpen')} · ${open.length}`}</div>}
      {open.map((r) => (
        <PlanItem key={r.id} record={r} onOpen={onOpenCard} />
      ))}
      {done.length > 0 && (
        <>
          <button className="section-label section-toggle" onClick={() => setShowDone(!showDone)} aria-expanded={showDone}>
            {`${tr('planDoneList')} · ${done.length}`}
            <Icon name="chevron" size={14} style={{ transform: showDone ? 'rotate(90deg)' : undefined }} />
          </button>
          {showDone && done.map((r) => <PlanItem key={r.id} record={r} onOpen={onOpenCard} />)}
        </>
      )}
    </>
  );
}

function PlanItem({ record, onOpen }: { record: CardRecord; onOpen: (id: string) => void }) {
  const tr = useT();
  const card = CARD_BY_ID[record.id];
  const area = AREA_BY_ID[card.area];
  const act = actOf(card, tr.lang);
  const done = !!record.planDone;
  return (
    <div className={`plan ${done ? 'is-done' : ''}`} style={{ '--area': area.color } as CSSProperties}>
      <button className="plan-main" onClick={() => onOpen(card.id)}>
        <span className="plan-title">{card[tr.lang].title}</span>
        {act && (
          <span className="plan-act">
            <b>{act.label}:</b> {act.text}
          </span>
        )}
        <span className="row-sub">
          {area.label[tr.lang]} · {done ? `${tr('planDoneList')} ${ago(record.planDone!, tr.lang)}` : `${tr('planSince')} ${ago(record.planAt!, tr.lang)}`}
        </span>
      </button>
      <div className="plan-btns">
        {done ? (
          <button className="pill" onClick={() => setPlanDone(card.id, false)}>
            {tr('planReopen')}
          </button>
        ) : (
          <button className="pill on-done" onClick={() => setPlanDone(card.id, true)}>
            <Icon name="check" size={16} />
            {tr('planMarkDone')}
          </button>
        )}
        <button className="link-btn" onClick={() => togglePlan(card.id, false)}>
          {tr('planRemove')}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- saved and history

function Saved({ onOpenCard }: { onOpenCard: (id: string) => void }) {
  const tr = useT();
  const records = useStore((s) => s.cards);
  const saved = Object.values(records)
    .filter((r) => r.saved && CARD_BY_ID[r.id])
    .sort((a, b) => (b.savedAt ?? b.updatedAt) - (a.savedAt ?? a.updatedAt));
  if (!saved.length) return <Empty icon="bookmark" text={tr('savedEmpty')} />;
  const now = Date.now();
  const dueCount = saved.filter((r) => (reviewDue(r) ?? Infinity) <= now).length;
  return (
    <>
      <p className="hint tab-hint review-hint">
        {tr('reviewHint')}
        {dueCount > 0 && <b> {dueCount === 1 ? tr('reviewDueOne') : tr('reviewDueMany').replace('{n}', String(dueCount))}</b>}
      </p>
      <div className="list">
        {saved.map((r) => (
          <CardRow key={r.id} cardId={r.id} record={r} meta={`${ago(r.savedAt ?? r.updatedAt, tr.lang)} · ${reviewLabel(r, now, tr)}`} onOpen={onOpenCard} />
        ))}
      </div>
    </>
  );
}

function reviewLabel(r: CardRecord, now: number, tr: ReturnType<typeof useT>): string {
  const step = r.reviewStep ?? 0;
  if (step >= REVIEW_STEPS) return tr('reviewDone');
  const label = `${tr('reviewed')} ${step}/${REVIEW_STEPS}`;
  return (reviewDue(r) ?? Infinity) <= now ? `${label} · ${tr('reviewDueShort')}` : label;
}

type Filter = 'all' | 'liked' | 'disliked';
const PAGE = 40;

function History({ onOpenCard }: { onOpenCard: (id: string) => void }) {
  const tr = useT();
  const records = useStore((s) => s.cards);
  const archived = useSyncExternalStore(onArchive, archiveVersion);
  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit] = useState(PAGE);
  const list = useMemo(
    () =>
      Object.values(records)
        .filter((r) => r.views > 0 && CARD_BY_ID[r.id])
        .filter((r) => (filter === 'liked' ? r.reaction === 1 : filter === 'disliked' ? r.reaction === -1 : true))
        .sort((a, b) => b.lastSeen - a.lastSeen),
    [records, filter, archived],
  );
  const anyRead = Object.values(records).some((r) => r.views > 0);
  if (!anyRead) return <Empty icon="history" text={tr('historyEmpty')} />;
  return (
    <>
      <div className="tab-hint">
        <Segmented<Filter>
          small
          value={filter}
          options={[
            { value: 'all', label: tr('filterAll') },
            { value: 'liked', label: tr('filterLiked') },
            { value: 'disliked', label: tr('filterDisliked') },
          ]}
          onChange={(f) => {
            setFilter(f);
            setLimit(PAGE);
          }}
        />
      </div>
      <div className="list">
        {list.slice(0, limit).map((r) => (
          <CardRow key={r.id} cardId={r.id} record={r} meta={ago(r.lastSeen, tr.lang)} onOpen={onOpenCard} />
        ))}
      </div>
      {list.length > limit && (
        <div className="btn-row">
          <button className="btn ghost" onClick={() => setLimit(limit + PAGE)}>
            {tr('showMore')}
          </button>
        </div>
      )}
    </>
  );
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="empty-inline">
      <Icon name={icon} size={28} />
      <p>{text}</p>
    </div>
  );
}

// ---------------------------------------------------------------- my algorithm

function levelOf(m: number): { key: StringKey; cls: string } {
  if (m >= 1.3) return { key: 'levelFav', cls: 'up2' };
  if (m >= 1.08) return { key: 'levelLike', cls: 'up' };
  if (m <= 0.77) return { key: 'levelNot', cls: 'down2' };
  if (m <= 0.93) return { key: 'levelLess', cls: 'down' };
  return { key: 'levelNeutral', cls: '' };
}

function featureLabel(key: string, lang: Lang): string | null {
  const [kind, rest] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
  if (kind === 'a') return AREA_BY_ID[rest]?.label[lang] ?? null;
  if (kind === 's') {
    const [area, sub] = rest.split('/');
    return AREA_BY_ID[area] ? subtopicLabel(area, sub, lang) : null;
  }
  if (kind === 'st') return STYLE_LABELS[rest as keyof typeof STYLE_LABELS]?.[lang] ?? null;
  return null;
}

const ADJUST_OPTIONS: { value: Adjust; icon: string; key: StringKey }[] = [
  { value: 'less', icon: '−', key: 'less' },
  { value: 'normal', icon: '=', key: 'normal' },
  { value: 'more', icon: '+', key: 'moreOften' },
  { value: 'hidden', icon: '⊘', key: 'off' },
];

function TweakRow({ featureKey, title, sub }: { featureKey: string; title: string; sub?: string }) {
  const tr = useT();
  const algo = useStore((s) => s.algo);
  const adjust = useStore((s) => s.prefs.adjust[featureKey] ?? 'normal');
  const level = levelOf(longMultiplier(algo, featureKey) * sessionMultiplier(algo, featureKey));
  return (
    <div className={`tweak ${adjust === 'hidden' ? 'off' : ''}`}>
      <span className="tweak-name">
        {title}
        <small>
          {sub ? `${sub} · ` : ''}
          <span className={`lvl ${level.cls}`}>{tr(level.key)}</span>
        </small>
      </span>
      <div className="mini-seg" role="radiogroup" aria-label={title}>
        {ADJUST_OPTIONS.map((o) => (
          <button
            key={o.value}
            role="radio"
            aria-checked={adjust === o.value}
            aria-label={tr(o.key)}
            title={tr(o.key)}
            className={adjust === o.value ? 'on' : ''}
            onClick={() => setAdjust(featureKey, o.value)}
          >
            {o.icon}
          </button>
        ))}
      </div>
    </div>
  );
}

function MyAlgorithm({ onOpenTopics, onToast }: { onOpenTopics: () => void; onToast: (t: string) => void }) {
  const tr = useT();
  const algo = useStore((s) => s.algo);
  const prefs = useStore((s) => s.prefs);
  const [allSubs, setAllSubs] = useState(false);
  const shares = useMemo(() => areaShares(CARDS, prefs, algo, Date.now()), [prefs, algo]);
  const maxShare = Math.max(0.01, ...Object.values(shares));

  const subs = ACTIVE_AREAS.filter((a) => !prefs.disabledAreas.includes(a.id)).flatMap((area) =>
    area.subtopics
      .filter((s) => CARDS.some((c) => c.area === area.id && c.sub === s.id))
      .filter((s) => !prefs.disabledSubs.includes(`${area.id}/${s.id}`))
      .map((s) => {
        const key = `s:${area.id}/${s.id}`;
        return { key, area, label: s.label[tr.lang], m: longMultiplier(algo, key) * sessionMultiplier(algo, key) };
      }),
  );
  const learned = subs.filter((s) => Math.abs(Math.log(s.m)) > 0.05 || prefs.adjust[s.key]).sort((a, b) => b.m - a.m);
  const shownSubs = allSubs ? subs : learned;
  const styles = STYLES.filter((st) => CARDS.some((c) => c.style === st));

  const focus = Object.keys(algo.session?.scores ?? {})
    .map((key) => ({ key, m: sessionMultiplier(algo, key), label: featureLabel(key, tr.lang) }))
    .filter((f) => f.label && f.m > 1.15)
    .sort((a, b) => b.m - a.m)
    .slice(0, 5);

  const reset = () => {
    if (!window.confirm(tr('algoResetConfirm'))) return;
    resetAlgorithm();
    onToast(tr('algoResetDone'));
  };

  return (
    <>
      <p className="hint" style={{ marginTop: 0 }}>
        {tr('algoIntro')}
      </p>

      <div className="section-label">{tr('algoShares')}</div>
      <div className="shares">
        {ACTIVE_AREAS.filter((a) => shares[a.id] !== undefined).map((a) => (
          <div className="share" key={a.id} style={{ '--area': a.color } as CSSProperties}>
            <span className="share-name">{a.label[tr.lang]}</span>
            <span className="share-bar">
              <i style={{ width: `${Math.max(4, (shares[a.id] / maxShare) * 100)}%` }} />
            </span>
            <span className="share-pct">{Math.round(shares[a.id] * 100)}%</span>
          </div>
        ))}
      </div>
      <p className="hint">
        {tr('algoSharesHint')}{' '}
        <button className="inline-link" onClick={onOpenTopics}>
          {tr('openTopics')}
        </button>
      </p>

      <div className="section-label">{tr('algoSession')}</div>
      {focus.length ? (
        <>
          <div className="chips">
            {focus.map((f) => (
              <span key={f.key}>{f.label}</span>
            ))}
          </div>
          <p className="hint">{tr('algoSessionHint')}</p>
        </>
      ) : (
        <p className="hint" style={{ marginTop: 0 }}>
          {tr('algoSessionNone')}
        </p>
      )}

      <div className="section-label">{tr('algoSubs')}</div>
      <p className="hint" style={{ margin: '0 0 4px' }}>
        {tr('algoSubsHint')}
      </p>
      {shownSubs.length === 0 && <p className="hint">{tr('algoNoSubs')}</p>}
      {shownSubs.map((s) => (
        <TweakRow key={s.key} featureKey={s.key} title={s.label} sub={s.area.label[tr.lang]} />
      ))}
      <button className="inline-link" style={{ marginTop: 10 }} onClick={() => setAllSubs(!allSubs)}>
        {allSubs ? tr('algoLearnedSubs') : tr('algoAllSubs')}
      </button>

      <div className="section-label">{tr('algoStyles')}</div>
      {styles.map((st) => (
        <TweakRow key={st} featureKey={`st:${st}`} title={STYLE_LABELS[st][tr.lang]} />
      ))}

      <div className="section-label">{tr('algoExplore')}</div>
      <Segmented<Exploration>
        value={prefs.exploration}
        options={[
          { value: 'low', label: tr('exploreLow') },
          { value: 'normal', label: tr('normal') },
          { value: 'high', label: tr('exploreHigh') },
        ]}
        onChange={(exploration) => setPrefs({ exploration })}
      />
      <p className="hint">{tr('algoExploreHint')}</p>

      <div className="btn-row" style={{ marginTop: 26 }}>
        <button className="btn ghost" onClick={reset}>
          <Icon name="reset" size={17} style={{ verticalAlign: '-3px', marginRight: 8 }} />
          {tr('algoReset')}
        </button>
      </div>
    </>
  );
}
