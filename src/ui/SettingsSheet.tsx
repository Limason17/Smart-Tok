import { useState } from 'react';
import { useT } from '../i18n/strings';
import { downloadCsv, downloadJson } from '../store/export';
import { getState, resetAll, setSettings, useStore, type FontSize, type Theme } from '../store/store';
import { push } from '../sync/account';
import type { Lang } from '../content/taxonomy';
import { Segmented, Sheet, Switch } from './Sheet';

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const tr = useT();
  const settings = useStore((s) => s.settings);
  const [resetOpen, setResetOpen] = useState(false);
  const [keepSaved, setKeepSaved] = useState(true);
  const [resetting, setResetting] = useState(false);

  const doReset = async () => {
    setResetting(true);
    await resetAll(keepSaved);
    // Write the fresh state to the account right away, so other devices pick up the reset.
    // The app now shows the introduction again and closes this sheet.
    if (getState().account) await push();
  };
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

      <div className="btn-row">
        {!resetOpen ? (
          <button className="btn danger" onClick={() => setResetOpen(true)}>
            {tr('resetAll')}
          </button>
        ) : null}
      </div>
      {resetOpen && (
        <div className="reset-box">
          <p className="hint" style={{ marginTop: 0 }}>
            {tr('resetAllHint')}
          </p>
          <label className="reset-keep">
            <span>{tr('resetKeepSaved')}</span>
            <Switch on={keepSaved} onChange={() => setKeepSaved(!keepSaved)} label={tr('resetKeepSaved')} />
          </label>
          <p className="hint">{tr('resetAllWarn')}</p>
          <div className="btn-row">
            <button className="btn danger" disabled={resetting} onClick={() => void doReset()}>
              {tr('resetAllGo')}
            </button>
            <button className="btn ghost" disabled={resetting} onClick={() => setResetOpen(false)}>
              {tr('cancel2')}
            </button>
          </div>
        </div>
      )}

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
