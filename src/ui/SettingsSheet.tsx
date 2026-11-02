import { useT } from '../i18n/strings';
import { downloadCsv, downloadJson } from '../store/export';
import { setSettings, useStore, type FontSize, type Theme } from '../store/store';
import type { Lang } from '../content/taxonomy';
import { Segmented, Sheet } from './Sheet';

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const tr = useT();
  const settings = useStore((s) => s.settings);
  return (
    <Sheet title={tr('settings')} onClose={onClose}>
      <div className="section-label">{tr('language')}</div>
      <Segmented<Lang>
        value={settings.lang}
        options={[
          { value: 'de', label: 'Deutsch' },
          { value: 'en', label: 'English' },
        ]}
        onChange={(lang) => setSettings({ lang })}
      />

      <div className="section-label">{tr('appearance')}</div>
      <Segmented<Theme>
        value={settings.theme}
        options={[
          { value: 'dark', label: tr('dark') },
          { value: 'light', label: tr('light') },
          { value: 'system', label: tr('system') },
        ]}
        onChange={(theme) => setSettings({ theme })}
      />

      <div className="section-label">{tr('fontSize')}</div>
      <Segmented<FontSize>
        value={settings.fontSize}
        options={[
          { value: 's', label: 'A−' },
          { value: 'm', label: 'A' },
          { value: 'l', label: 'A+' },
        ]}
        onChange={(fontSize) => setSettings({ fontSize })}
      />

      <div className="section-label">{tr('data')}</div>
      <p className="hint" style={{ marginTop: 0 }}>
        {tr('dataHint')}
      </p>
      <div className="btn-row">
        <button className="btn ghost" onClick={() => void downloadJson()}>
          {tr('downloadJson')}
        </button>
        <button className="btn ghost" onClick={() => void downloadCsv()}>
          {tr('downloadCsv')}
        </button>
      </div>

      <div className="section-label">{tr('about')}</div>
      <p className="hint" style={{ marginTop: 0 }}>
        {tr('aboutText')}
      </p>
      <p className="hint">
        {tr('version')} {__APP_VERSION__}
      </p>
    </Sheet>
  );
}
