import { useCallback, useEffect, useState } from 'react';
import { useT } from '../i18n/strings';
import { setSettings, useStore } from '../store/store';
import { AccountSheet } from './AccountSheet';
import { CardSheet, MoreSheet } from './CardSheet';
import { Feed } from './Feed';
import { SheetLevel } from './Sheet';
import { Icon } from './Icon';
import { linkedCards } from './links';
import { Onboarding } from './Onboarding';
import { LegalSheet } from './LegalSheet';
import { PeopleSheet, PersonSheet } from './PeopleSheet';
import { AlgoSheet, ProfileSheet } from './ProfileSheet';
import { SettingsSheet } from './SettingsSheet';
import { TopicSheet } from './TopicSheet';

type Panel =
  | { kind: 'topics'; fromProfile?: boolean }
  | { kind: 'settings'; fromProfile?: boolean }
  | { kind: 'profile' }
  | { kind: 'algo' }
  | { kind: 'account' }
  | { kind: 'legal'; back: Panel }
  | { kind: 'people'; fromProfile?: boolean }
  | { kind: 'person'; personId: string; back?: Panel }
  | { kind: 'card'; cardId: string; back?: Panel }
  | { kind: 'more'; cardId: string }
  | null;

/** The sheet that closing `p` leads back to (the same target as its X), or null for the feed. */
function parentOf(p: NonNullable<Panel>): Panel {
  switch (p.kind) {
    case 'topics':
    case 'settings':
    case 'people':
      return p.fromProfile ? { kind: 'profile' } : null;
    case 'algo':
    case 'account':
      return { kind: 'profile' };
    case 'legal':
      return p.back;
    case 'person':
      return p.back ?? null;
    case 'card':
      return p.back ?? { kind: 'profile' };
    default:
      return null;
  }
}

/**
 * The open sheet with the sheets it leads back to underneath it, bottom first. They stay mounted
 * below the top one, so closing it uncovers the previous sheet as it was instead of opening it again.
 */
function panelStack(panel: Panel): NonNullable<Panel>[] {
  const stack: NonNullable<Panel>[] = [];
  for (let p = panel; p && stack.length < 6; p = parentOf(p)) stack.unshift(p);
  return stack;
}

const panelKey = (p: NonNullable<Panel>) => `${p.kind}:${'cardId' in p ? p.cardId : 'personId' in p ? p.personId : ''}`;

function useThemeAttributes() {
  const { theme, fontSize, lang } = useStore((s) => s.settings);
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      root.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f1013' : '#f1eee8');
    };
    apply();
    root.dataset.font = fontSize;
    root.lang = lang;
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme, fontSize, lang]);
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

function InstallHint() {
  const tr = useT();
  const dismissed = useStore((s) => s.settings.installHintDismissed);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (dismissed || !isIos() || isStandalone()) return;
    const t = setTimeout(() => setShow(true), 12_000);
    return () => clearTimeout(t);
  }, [dismissed]);
  if (!show || dismissed) return null;
  return (
    <div className="install" role="dialog" aria-label={tr('installTitle')}>
      <h3>{tr('installTitle')}</h3>
      <p>{tr('installText')}</p>
      <button className="btn" onClick={() => setSettings({ installHintDismissed: true })}>
        {tr('gotIt')}
      </button>
    </div>
  );
}

export function App() {
  const tr = useT();
  const ready = useStore((s) => s.ready);
  const onboarded = useStore((s) => s.settings.onboarded);
  const [panel, setPanel] = useState<Panel>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Someone new opening a shared card sees it right away; the introduction comes after.
  const [preview, setPreview] = useState(() => linkedCards().length > 0);
  useThemeAttributes();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  // After "Alles zurücksetzen" the introduction runs again; no sheet should pop up behind it.
  useEffect(() => {
    if (!onboarded) setPanel(null);
  }, [onboarded]);

  const close = useCallback(() => setPanel(null), []);
  const openTopics = useCallback(() => setPanel({ kind: 'topics' }), []);
  const onMore = useCallback((cardId: string) => setPanel({ kind: 'more', cardId }), []);
  const openProfile = useCallback(() => setPanel({ kind: 'profile' }), []);
  const openPerson = useCallback((personId: string) => setPanel({ kind: 'person', personId }), []);

  const renderPanel = (p: NonNullable<Panel>) => {
    switch (p.kind) {
      case 'topics':
        return <TopicSheet onClose={p.fromProfile ? openProfile : close} />;
      case 'settings':
        return <SettingsSheet onClose={p.fromProfile ? openProfile : close} onOpenLegal={() => setPanel({ kind: 'legal', back: p })} />;
      case 'profile':
        return (
          <ProfileSheet
            onClose={close}
            onOpenCard={(cardId) => setPanel({ kind: 'card', cardId })}
            onOpenSettings={() => setPanel({ kind: 'settings', fromProfile: true })}
            onOpenTopics={() => setPanel({ kind: 'topics', fromProfile: true })}
            onOpenAccount={() => setPanel({ kind: 'account' })}
            onOpenAlgo={() => setPanel({ kind: 'algo' })}
            onOpenPeople={() => setPanel({ kind: 'people', fromProfile: true })}
          />
        );
      case 'people':
        return (
          <PeopleSheet
            onClose={p.fromProfile ? openProfile : close}
            onOpenPerson={(personId) => setPanel({ kind: 'person', personId, back: p })}
          />
        );
      case 'person':
        return (
          <PersonSheet
            personId={p.personId}
            onClose={() => setPanel(p.back ?? null)}
            onOpenCard={(cardId) => setPanel({ kind: 'card', cardId, back: p })}
          />
        );
      case 'algo':
        return <AlgoSheet onClose={openProfile} onOpenTopics={() => setPanel({ kind: 'topics', fromProfile: true })} onToast={setToast} />;
      case 'account':
        return <AccountSheet onClose={openProfile} onToast={setToast} onOpenLegal={() => setPanel({ kind: 'legal', back: p })} />;
      case 'legal':
        return <LegalSheet onClose={() => setPanel(p.back)} />;
      case 'card':
        return (
          <CardSheet
            cardId={p.cardId}
            onClose={() => (p.back ? setPanel(p.back) : openProfile())}
            onPerson={(personId) => setPanel({ kind: 'person', personId, back: p.back?.kind === 'person' ? p.back.back : p })}
          />
        );
      case 'more':
        return <MoreSheet cardId={p.cardId} onClose={close} />;
    }
  };

  if (!ready) return null;
  // The feed is built after onboarding, so the first cards already follow the picked topics.
  if (!onboarded && preview) {
    return (
      <>
        <Feed onMore={onMore} onToast={setToast} onOpenTopics={openTopics} preview={{ onStart: () => setPreview(false) }} />
        {panel?.kind === 'more' && <MoreSheet cardId={panel.cardId} onClose={close} />}
        {toast && <div className="toast">{toast}</div>}
      </>
    );
  }
  if (!onboarded) return <Onboarding />;

  return (
    <>
      <Feed
        onMore={onMore}
        onPerson={openPerson}
        onToast={setToast}
        onOpenTopics={openTopics}
        paused={!!panel && panel.kind !== 'more'}
      />
      <div className="topbar">
        <div className="topbar-inner">
          <button className="glass-btn" aria-label={tr('topics')} onClick={openTopics}>
            <Icon name="layers" size={20} />
          </button>
          <span className="topbar-right">
            <button className="glass-btn" aria-label={tr('people')} onClick={() => setPanel({ kind: 'people' })}>
              <Icon name="people" size={20} />
            </button>
            <button className="glass-btn" aria-label={tr('profile')} onClick={openProfile}>
              <Icon name="user" size={20} />
            </button>
          </span>
        </div>
      </div>
      {panelStack(panel).map((p, i, stack) => (
        <SheetLevel.Provider key={`${i}:${panelKey(p)}`} value={{ level: i, top: i === stack.length - 1 }}>
          {renderPanel(p)}
        </SheetLevel.Provider>
      ))}
      <InstallHint />
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
