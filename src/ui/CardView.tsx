import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Card, CardText } from '../content/card';
import { AREA_BY_ID, STYLE_LABELS, subtopicLabel, type Lang } from '../content/taxonomy';
import { useT } from '../i18n/strings';
import { Icon } from './Icon';

/** Straight double quotes become typographic ones: „…“ in German, “…” in English. */
export function smartQuotes(text: string, lang: Lang): string {
  const [open, close] = lang === 'de' ? ['\u201e', '\u201c'] : ['\u201c', '\u201d'];
  let n = 0;
  return text.replace(/"/g, () => (n++ % 2 === 0 ? open : close));
}

/** Renders `**bold**` inside a paragraph. */
function inline(raw: string, lang: Lang): ReactNode {
  const text = smartQuotes(raw, lang);
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>,
  );
}

export function Paragraphs({ text, lang }: { text: string; lang: Lang }) {
  return (
    <>
      {text
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i}>{inline(p, lang)}</p>
        ))}
    </>
  );
}

function CardContent({ t, quoteFirst, isLast, applyLabel, lang }: { t: CardText; quoteFirst: boolean; isLast: boolean; applyLabel: string; lang: Lang }) {
  const quote = t.quote && (
    <blockquote className="card-quote">
      {smartQuotes(t.quote.text, lang)}
      <footer>
        — {t.quote.author}
        {t.quote.source ? `, ${t.quote.source}` : ''}
      </footer>
    </blockquote>
  );
  return (
    <div className="card-inner">
      {quoteFirst && quote}
      <h2 className="card-title">{smartQuotes(t.title, lang)}</h2>
      {t.body && (
        <div className="card-body">
          <Paragraphs text={t.body} lang={lang} />
        </div>
      )}
      {t.points && (
        <ol className="card-points">
          {t.points.map((p, i) => (
            <li key={i}>{inline(p, lang)}</li>
          ))}
        </ol>
      )}
      {!quoteFirst && quote}
      {t.apply && isLast && (
        <div className="card-apply">
          <b>{applyLabel}</b>
          {smartQuotes(t.apply, lang)}
        </div>
      )}
    </div>
  );
}

function Meta({ card }: { card: Card }) {
  const tr = useT();
  const area = AREA_BY_ID[card.area];
  return (
    <header className="card-meta">
      <Icon name={area.icon} size={16} />
      <span className="crumb">
        {area.label[tr.lang]} <span>· {subtopicLabel(card.area, card.sub, tr.lang)}</span>
      </span>
      <span className="chip">{STYLE_LABELS[card.style][tr.lang]}</span>
    </header>
  );
}

function Stack({ card, onSlide }: { card: Card; onSlide?: (index: number) => void }) {
  const tr = useT();
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const slides: CardText[] = [card[tr.lang], ...(card.slides ?? []).map((s) => s[tr.lang])];

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => {
      const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
      setIndex((prev) => (prev === i ? prev : i));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => onSlide?.(index), [index, onSlide]);

  return (
    <div className="stack">
      <div className="stack-progress" aria-label={`${index + 1} ${tr('of')} ${slides.length}`}>
        <div className="stack-bars">
          {slides.map((_, i) => (
            <i key={i} className={i <= index ? 'on' : ''} />
          ))}
        </div>
        <span className="stack-count">
          {index + 1}/{slides.length}
        </span>
      </div>
      <div className="stack-track" ref={track}>
        {slides.map((t, i) => (
          <section className="stack-slide" key={i} aria-roledescription="slide">
            <div className="card-scroll">
              <CardContent t={t} quoteFirst={false} isLast={i === slides.length - 1} applyLabel={tr('apply')} lang={tr.lang} />
              {i === 0 && (
                <span className="stack-next">
                  {tr('stackHint')} <Icon name="chevron" size={14} />
                </span>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function CardView({ card }: { card: Card }) {
  const tr = useT();
  const area = AREA_BY_ID[card.area];
  const style = { '--area': area.color } as CSSProperties;
  return (
    <article className={`card card--${card.format}`} style={style} data-card={card.id}>
      <Meta card={card} />
      {card.slides ? (
        <Stack card={card} />
      ) : (
        <div className="card-scroll">
          <CardContent t={card[tr.lang]} quoteFirst={card.format === 'zitat'} isLast applyLabel={tr('apply')} lang={tr.lang} />
        </div>
      )}
    </article>
  );
}
