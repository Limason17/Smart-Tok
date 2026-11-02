import { useCallback, useEffect, useState } from 'react';
import { useT } from '../i18n/strings';
import { setSettings, useStore } from '../store/store';
import { CardSheet, MoreSheet } from './CardSheet';
import { Feed } from './Feed';
import { Icon } from './Icon';
import { Onboarding } from './Onboarding';
import { ProfileSheet } from './ProfileSheet';
import { SettingsSheet } from './SettingsSheet';
import { TopicSheet } from './TopicSheet';

type Panel =
  | { kind: 'topics' }
  | { kind: 'settings'; fromProfile?: boolean }
  | { kind: 'profile' }
  | { kind: 'card'; cardId: string }
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
  useThemeAttributes();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const close = useCallback(() => setPanel(null), []);
  const openTopics = useCallback(() => setPanel({ kind: 'topics' }), []);
  const onMore = useCallback((cardId: string) => setPanel({ kind: 'more', cardId }), []);
  const openProfile = useCallback(() => setPanel({ kind: 'profile' }), []);

  if (!ready) return null;
  // The feed is built after onboarding, so the first cards already follow the picked topics.
  if (!onboarded) return <Onboarding />;

  return (
    <>
      <Feed onMore={onMore} onToast={setToast} onOpenTopics={openTopics} />
      <div className="topbar">
        <div className="topbar-inner">
          <button className="glass-btn" aria-label={tr('topics')} onClick={openTopics}>
            <Icon name="layers" size={20} />
          </button>
          <button className="glass-btn" aria-label={tr('profile')} onClick={openProfile}>
            <Icon name="user" size={20} />
          </button>
        </div>
      </div>
      {panel?.kind === 'topics' && <TopicSheet onClose={close} />}
      {panel?.kind === 'settings' && <SettingsSheet onClose={panel.fromProfile ? openProfile : close} />}
      {panel?.kind === 'profile' && (
        <ProfileSheet
          onClose={close}
          onOpenCard={(cardId) => setPanel({ kind: 'card', cardId })}
          onOpenSettings={() => setPanel({ kind: 'settings', fromProfile: true })}
          onOpenTopics={openTopics}
          onToast={setToast}
        />
      )}
      {panel?.kind === 'card' && <CardSheet cardId={panel.cardId} onClose={openProfile} />}
      {panel?.kind === 'more' && <MoreSheet cardId={panel.cardId} onClose={close} />}
      <InstallHint />
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
