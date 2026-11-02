import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useT } from '../i18n/strings';
import { Icon } from './Icon';

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const tr = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="sheet-close" onClick={onClose} aria-label={tr('close')}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </>
  );
}

/** Percentage ring: the bar eases to the new value and the number counts up. */
export function ProgressRing({ value, from }: { value: number; from?: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const start = from ?? value;
  const [shown, setShown] = useState(start);
  const [bar, setBar] = useState(start);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setBar(value));
    const t0 = performance.now();
    const dur = 900;
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(start + (value - start) * eased);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(frame);
    };
  }, [value, start]);
  return (
    <div className="ring" role="img" aria-label={`${Math.round(value)} %`}>
      <svg width="44" height="44" viewBox="0 0 44 44">
        <circle className="track" cx="22" cy="22" r={r} fill="none" strokeWidth="3.5" />
        <circle
          className="bar"
          cx="22"
          cy="22"
          r={r}
          fill="none"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(100, bar) / 100)}
        />
      </svg>
      <span className={Math.round(shown) >= 100 ? 'full' : ''}>{Math.round(shown)}%</span>
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return <button className={`switch ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={onChange} />;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  small,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  small?: boolean;
}) {
  return (
    <div className={`segmented ${small ? 'small' : ''}`} role="radiogroup">
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
