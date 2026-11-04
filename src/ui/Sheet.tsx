import { createContext, useCallback, useContext, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useT } from '../i18n/strings';
import { Icon } from './Icon';

/** How long the sheet takes to slide away; matches `.sheet.closing` in styles.css. */
const CLOSE_MS = 220;
/** Movement (px) before a press on the header counts as a drag and not as a tap. */
const DRAG_SLOP = 6;

/**
 * Where a sheet sits when several are stacked (e.g. Profil → Einstellungen → Datenschutz):
 * only the top one is active; the ones below wait unchanged until it is closed.
 */
export const SheetLevel = createContext({ level: 0, top: true });

interface Drag {
  id: number;
  x0: number;
  y0: number;
  dy: number;
  active: boolean;
  /** Recent positions, to measure how fast the header is moving when it is let go. */
  samples: { y: number; t: number }[];
}

/** Speed in px/ms over the last ~100 ms before release; 0 when the finger rested before letting go. */
function releaseSpeed(samples: { y: number; t: number }[], now: number): number {
  const last = samples[samples.length - 1];
  if (!last || now - last.t > 100) return 0;
  const first = samples.find((s) => last.t - s.t <= 100) ?? last;
  const dt = last.t - first.t;
  return dt > 0 ? (last.y - first.y) / dt : 0;
}

/**
 * A panel that rises from the bottom (a centred dialog on large screens).
 * It closes with the X, with Escape, with a tap on the dimmed area around it, and by pulling
 * its header (handle, title, X) downwards. Scrolling the content never closes it.
 */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const tr = useT();
  const { level, top } = useContext(SheetLevel);
  const ref = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const timer = useRef(0);
  const drag = useRef<Drag | null>(null);
  const justDragged = useRef(false);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    timer.current = window.setTimeout(() => onCloseRef.current(), reduce ? 0 : CLOSE_MS);
  }, []);

  useEffect(() => {
    if (!top) return;
    // Focus moves here when the sheet opens and again when the sheet above it closes.
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && requestClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [top, requestClose]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const setOffset = (dy: number, dragging: boolean) => {
    const sheet = ref.current;
    const backdrop = backdropRef.current;
    if (!sheet) return;
    sheet.style.setProperty('--drag', `${dy}px`);
    sheet.classList.toggle('dragging', dragging);
    backdrop?.classList.toggle('dragging', dragging);
    backdrop?.style.setProperty('--dim', String(Math.min(1, Math.max(0, 1 - dy / (sheet.offsetHeight || 1)))));
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    justDragged.current = false;
    if (closingRef.current || drag.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dy: 0, active: false, samples: [] };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.active) {
      if (Math.abs(dx) < DRAG_SLOP && Math.abs(dy) < DRAG_SLOP) return;
      // Only a pull downwards starts a drag; sideways or upwards stays a normal touch.
      if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) {
        drag.current = null;
        return;
      }
      d.active = true;
      justDragged.current = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already gone */
      }
    }
    d.samples.push({ y: e.clientY, t: e.timeStamp });
    if (d.samples.length > 12) d.samples.shift();
    // Upwards it only gives a little, like a rubber band.
    d.dy = dy >= 0 ? dy : -Math.min(16, Math.sqrt(-dy) * 2);
    setOffset(d.dy, true);
  };

  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.active) return;
    // Clear the guard once the click that may follow this release has passed (keyboard use of the X stays unaffected).
    window.setTimeout(() => (justDragged.current = false), 400);
    const height = ref.current?.offsetHeight ?? 600;
    const v = releaseSpeed(d.samples, e.timeStamp);
    // Far enough, or a quick flick downwards that would carry it far enough; a flick back up keeps it open.
    const projected = d.dy + Math.max(0, v) * 200;
    const shouldClose = e.type !== 'pointercancel' && v > -0.1 && (projected > Math.min(130, height * 0.28) || (v > 0.5 && d.dy > 20));
    if (shouldClose) {
      setOffset(d.dy, false);
      requestClose();
    } else {
      setOffset(0, false);
    }
  };

  return (
    <>
      <div
        ref={backdropRef}
        className={`sheet-backdrop${level > 0 ? ' stacked' : ''}${closing ? ' closing' : ''}`}
        style={{ zIndex: 40 + level * 2 }}
        onClick={requestClose}
        aria-hidden="true"
      />
      <div
        className={`sheet${closing ? ' closing' : ''}`}
        style={{ zIndex: 41 + level * 2 }}
        role="dialog"
        aria-modal={top}
        aria-hidden={top ? undefined : true}
        inert={!top}
        aria-label={title}
        ref={ref}
        tabIndex={-1}
      >
        <div
          className="sheet-head"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onClickCapture={(e) => {
            // The release after a pull must not count as a tap on the X.
            if (justDragged.current) {
              e.stopPropagation();
              e.preventDefault();
              justDragged.current = false;
            }
          }}
        >
          <h2>{title}</h2>
          <button className="sheet-close" onClick={requestClose} aria-label={tr('close')}>
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
  className = '',
}: {
  className?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  small?: boolean;
}) {
  return (
    <div className={`segmented ${small ? 'small' : ''} ${className}`} role="radiogroup">
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
