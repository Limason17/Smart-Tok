import { useCallback, useEffect, useState } from 'react';
import { CARD_BY_ID } from '../content';
import { useT } from '../i18n/strings';
import { setSettings, useStore } from '../store/store';
import { Paragraphs } from './CardView';
import { Feed } from './Feed';
import { Icon } from './Icon';
import { SettingsSheet } from './SettingsSheet';
import { Sheet } from './Sheet';
import { TopicSheet } from './TopicSheet';

type Panel = { kind: 'topics' } | { kind: 'settings' } | { kind: 'more'; cardId: string } | null;

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

function MoreSheet({ cardId, onClose }: { cardId: string; onClose: () => void }) {
  const tr = useT();
  const card = CARD_BY_ID[cardId];
  const parts = [card[tr.lang], ...(card.slides ?? []).map((s) => s[tr.lang])].filter((t) => t.more || t.source);
  return (
    <Sheet title={tr('more')} onClose={onClose}>
      {parts.length === 0 && <p className="hint">{tr('noMore')}</p>}
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
    </Sheet>
  );
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

  if (!ready) return null;

  return (
    <>
      <Feed onMore={onMore} onToast={setToast} onOpenTopics={openTopics} />
      <div className="topbar">
        <div className="topbar-inner">
          <button className="glass-btn" aria-label={tr('topics')} onClick={openTopics}>
            <Icon name="layers" size={20} />
          </button>
          <button className="glass-btn" aria-label={tr('settings')} onClick={() => setPanel({ kind: 'settings' })}>
            <Icon name="settings" size={20} />
          </button>
        </div>
      </div>
      {panel?.kind === 'topics' && <TopicSheet onClose={close} />}
      {panel?.kind === 'settings' && <SettingsSheet onClose={close} />}
      {panel?.kind === 'more' && <MoreSheet cardId={panel.cardId} onClose={close} />}
      <InstallHint />
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
