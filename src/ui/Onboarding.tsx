import { useState, type CSSProperties } from 'react';
import { ACTIVE_AREAS, cardsInArea } from '../content';
import type { Lang } from '../content/taxonomy';
import { useT, type StringKey } from '../i18n/strings';
import { finishOnboarding, setSettings, useStore } from '../store/store';
import { inline } from './CardView';
import { Icon } from './Icon';
import { useDesktop } from './useDesktop';
import { Segmented } from './Sheet';

/** On a computer, the gestures are explained as scrolling, keys and clicks. */
const DESKTOP_KEYS: Partial<Record<StringKey, StringKey>> = {
  onbSwipeUp: 'onbSwipeUpDesktop',
  onbSwipeSide: 'onbSwipeSideDesktop',
  onbLike: 'onbLikeDesktop',
};

const GESTURES: { icon: string; key: StringKey }[] = [
  { icon: 'arrowUp', key: 'onbSwipeUp' },
  { icon: 'arrowSide', key: 'onbSwipeSide' },
  { icon: 'heart', key: 'onbLike' },
  { icon: 'dislike', key: 'onbDislike' },
  { icon: 'bookmark', key: 'onbSave' },
  { icon: 'target', key: 'onbPlan' },
  { icon: 'info', key: 'onbInfo' },
];

/** First start: language, topics, how the feed works. */
export function Onboarding() {
  const tr = useT();
  const lang = useStore((s) => s.settings.lang);
  const disabled = useStore((s) => s.prefs.disabledAreas);
  const [step, setStep] = useState(0);
  const desktop = useDesktop();
  const [picked, setPicked] = useState<string[]>(() => ACTIVE_AREAS.map((a) => a.id).filter((id) => !disabled.includes(id)));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const done = () => finishOnboarding(picked, ACTIVE_AREAS.map((a) => a.id));

  return (
    <div className="onb" role="dialog" aria-modal="true" aria-label={tr('onbWelcome')}>
      <div className="onb-dots" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <i key={i} className={i === step ? 'on' : ''} />
        ))}
      </div>

      {step === 0 && (
        <div className="onb-step" key="welcome">
          <img className="onb-logo" src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width={84} height={84} />
          <h1>{tr('onbWelcome')}</h1>
          <p>{tr('onbWelcomeText')}</p>
          <div className="onb-lang">
            <Segmented<Lang>
              value={lang}
              options={[
                { value: 'de', label: 'Deutsch' },
                { value: 'en', label: 'English' },
              ]}
              onChange={(l) => setSettings({ lang: l })}
            />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="onb-step" key="topics">
          <h1>{tr('onbTopics')}</h1>
          <p>{tr('onbTopicsText')}</p>
          <div className="onb-topics">
            {ACTIVE_AREAS.map((a) => {
              const on = picked.includes(a.id);
              return (
                <button
                  key={a.id}
                  className={`onb-topic ${on ? 'on' : ''}`}
                  style={{ '--area': a.color } as CSSProperties}
                  aria-pressed={on}
                  onClick={() => toggle(a.id)}
                >
                  <span className="topic-icon">
                    <Icon name={a.icon} size={20} />
                  </span>
                  <span className="onb-topic-text">
                    {a.label[lang]}
                    <small>
                      {cardsInArea(a.id).length} {tr('cardMany')}
                    </small>
                  </span>
                  <span className="onb-check">{on && <Icon name="check" size={16} />}</span>
                </button>
              );
            })}
          </div>
          <p className="onb-soon">{tr('onbMoreSoon')}</p>
        </div>
      )}

      {step === 2 && (
        <div className="onb-step" key="how">
          <h1>{tr('onbHow')}</h1>
          <ul className="onb-gestures">
            {GESTURES.map((g) => (
              <li key={g.key}>
                <span className="onb-g-icon">
                  <Icon name={g.icon} size={20} />
                </span>
                <span>{inline(tr((desktop && DESKTOP_KEYS[g.key]) || g.key), lang)}</span>
              </li>
            ))}
          </ul>
          <p>{tr('onbAlgo')}</p>
        </div>
      )}

      <div className="onb-actions">
        {step > 0 && (
          <button className="btn ghost" onClick={() => setStep(step - 1)}>
            {tr('back')}
          </button>
        )}
        {step < 2 ? (
          <button className="btn" disabled={step === 1 && picked.length === 0} onClick={() => setStep(step + 1)}>
            {tr('onbNext')}
          </button>
        ) : (
          <button className="btn" onClick={done}>
            {tr('onbStart')}
          </button>
        )}
      </div>
    </div>
  );
}
