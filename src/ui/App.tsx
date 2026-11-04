import { useCallback, useEffect, useState } from 'react';
import { useT } from '../i18n/strings';
import { setSettings, useStore } from '../store/store';
import { AccountSheet } from './AccountSheet';
import { CardSheet, MoreSheet } from './CardSheet';
import { Feed } from './Feed';
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
      <Feed onMore={onMore} onPerson={openPerson} onToast={setToast} onOpenTopics={openTopics} />
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
      {panel?.kind === 'topics' && <TopicSheet onClose={panel.fromProfile ? openProfile : close} />}
      {panel?.kind === 'settings' && (
        <SettingsSheet onClose={panel.fromProfile ? openProfile : close} onOpenLegal={() => setPanel({ kind: 'legal', back: panel })} />
      )}
      {panel?.kind === 'profile' && (
        <ProfileSheet
          onClose={close}
          onOpenCard={(cardId) => setPanel({ kind: 'card', cardId })}
          onOpenSettings={() => setPanel({ kind: 'settings', fromProfile: true })}
          onOpenTopics={() => setPanel({ kind: 'topics', fromProfile: true })}
          onOpenAccount={() => setPanel({ kind: 'account' })}
          onOpenAlgo={() => setPanel({ kind: 'algo' })}
          onOpenPeople={() => setPanel({ kind: 'people', fromProfile: true })}
        />
      )}
      {panel?.kind === 'people' && (
        <PeopleSheet
          onClose={panel.fromProfile ? openProfile : close}
          onOpenPerson={(personId) => setPanel({ kind: 'person', personId, back: panel })}
        />
      )}
      {panel?.kind === 'person' && (
        <PersonSheet
          personId={panel.personId}
          onClose={() => setPanel(panel.back ?? null)}
          onOpenCard={(cardId) => setPanel({ kind: 'card', cardId, back: panel })}
        />
      )}
      {panel?.kind === 'algo' && (
        <AlgoSheet onClose={openProfile} onOpenTopics={() => setPanel({ kind: 'topics', fromProfile: true })} onToast={setToast} />
      )}
      {panel?.kind === 'account' && (
        <AccountSheet onClose={openProfile} onToast={setToast} onOpenLegal={() => setPanel({ kind: 'legal', back: panel })} />
      )}
      {panel?.kind === 'legal' && <LegalSheet onClose={() => setPanel(panel.back)} />}
      {panel?.kind === 'card' && (
        <CardSheet
          cardId={panel.cardId}
          onClose={() => (panel.back ? setPanel(panel.back) : openProfile())}
          onPerson={(personId) => setPanel({ kind: 'person', personId, back: panel.back?.kind === 'person' ? panel.back.back : panel })}
        />
      )}
      {panel?.kind === 'more' && <MoreSheet cardId={panel.cardId} onClose={close} />}
      <InstallHint />
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
