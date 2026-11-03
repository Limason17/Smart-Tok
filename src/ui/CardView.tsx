import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { Card, CardText } from '../content/card';
import { ACT_LABELS, AREA_BY_ID, STYLE_LABELS, subtopicLabel, type ActKind, type Lang } from '../content/taxonomy';
import { useT } from '../i18n/strings';
import { useStore } from '../store/store';
import { Icon } from './Icon';

/** Straight double quotes become typographic ones: „…“ in German, “…” in English. */
export function smartQuotes(text: string, lang: Lang): string {
  const [open, close] = lang === 'de' ? ['„', '“'] : ['“', '”'];
  let n = 0;
  return text.replace(/"/g, () => (n++ % 2 === 0 ? open : close));
}

/** Renders `**bold**` inside a paragraph. */
export function inline(raw: string, lang: Lang): ReactNode {
  const text = smartQuotes(raw, lang);
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>,
  );
}

export function Paragraphs({ text, lang }: { text: string; lang: Lang }) {
  return (
    <>
      {splitParagraphs(text).map((p, i) => (
        <p key={i}>{inline(p, lang)}</p>
      ))}
    </>
  );
}

const splitParagraphs = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p && p !== '---');

// ---------------------------------------------------------------- blocks

type Quote = NonNullable<CardText['quote']>;

/**
 * A card is a list of blocks. Blocks are laid out into pages that fit the screen,
 * so a card never scrolls vertically; longer cards continue on the next page (swipe sideways).
 */
export type Block =
  | { k: 'hero'; quote: Quote }
  | { k: 'title'; text: string; sub?: boolean; deep?: boolean }
  | { k: 'p'; text: string; cont?: boolean }
  | { k: 'li'; text: string; n: number }
  | { k: 'quote'; quote: Quote }
  | { k: 'example'; text: string; cont?: boolean }
  | { k: 'act'; kind: ActKind; text: string }
  | { k: 'break' };

function textBlocks(t: CardText, sub: boolean, skipQuote: boolean): Block[] {
  const out: Block[] = [{ k: 'title', text: t.title, sub }];
  for (const part of t.body.split(/\n{2,}/).map((p) => p.trim())) {
    if (part === '---') out.push({ k: 'break' });
    else if (part.startsWith('## ')) out.push({ k: 'title', text: part.slice(3), sub: true });
    else if (part) out.push({ k: 'p', text: part });
  }
  t.points?.forEach((text, i) => out.push({ k: 'li', text, n: i + 1 }));
  if (t.quote && !skipQuote) out.push({ k: 'quote', quote: t.quote });
  splitParagraphs(t.example ?? '').forEach((text, i) => out.push({ k: 'example', text, cont: i > 0 }));
  return out;
}

const DEEP_LABEL: Record<Lang, string> = { de: 'Genauer betrachtet', en: 'A closer look' };

export function cardBlocks(card: Card, lang: Lang): Block[] {
  const t = card[lang];
  const hero = card.format === 'zitat' && !!t.quote;
  const out: Block[] = hero ? [{ k: 'hero', quote: t.quote! }] : [];
  out.push(...textBlocks(t, false, hero));
  for (const slide of card.slides ?? []) {
    out.push({ k: 'break' }, ...textBlocks(slide[lang], true, false));
  }
  if (t.act) out.push({ k: 'act', kind: card.actKind ?? 'heute', text: t.act });
  // Depth comes last: the essentials and the closing section stay together up front.
  if (t.deep) {
    out.push({ k: 'break' }, { k: 'title', text: DEEP_LABEL[lang], sub: true, deep: true });
    for (const text of splitParagraphs(t.deep)) out.push({ k: 'p', text });
  }
  return out;
}

function ActBox({ kind, text, lang }: { kind: ActKind; text: string; lang: Lang }) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const steps = lines.filter((l) => l.startsWith('- '));
  const lead = lines.filter((l) => !l.startsWith('- '));
  return (
    <>
      <b className="act-label">
        <Icon name={ACT_ICONS[kind]} size={14} />
        {ACT_LABELS[kind][lang]}
      </b>
      {lead.map((l, i) => (
        <p key={i}>{inline(l, lang)}</p>
      ))}
      {steps.length > 0 && (
        <ol>
          {steps.map((s, i) => (
            <li key={i}>{inline(s.slice(2), lang)}</li>
          ))}
        </ol>
      )}
    </>
  );
}

const ACT_ICONS: Record<ActKind, string> = {
  heute: 'target',
  so: 'steps',
  achte: 'eye',
  langfristig: 'calendar',
  merke: 'pin',
  frage: 'question',
  gebet: 'faith',
};

function BlockView({ b, lang, exampleLabel, first }: { b: Block; lang: Lang; exampleLabel: string; first?: boolean }) {
  const cls = first ? ' first' : '';
  switch (b.k) {
    case 'hero':
      return (
        <blockquote className={`blk blk-hero${cls}`}>
          {smartQuotes(b.quote.text, lang)}
          <footer>
            — {b.quote.author}
            {b.quote.source ? `, ${b.quote.source}` : ''}
          </footer>
        </blockquote>
      );
    case 'title':
      return b.sub ? (
        <h3 className={`blk blk-sub${b.deep ? ' deep' : ''}${cls}`}>
          {b.deep && <Icon name="eye" size={15} />}
          {smartQuotes(b.text, lang)}
        </h3>
      ) : (
        <h2 className={`blk blk-title${cls}`}>{smartQuotes(b.text, lang)}</h2>
      );
    case 'p':
      return <p className={`blk blk-p${b.cont ? ' cont' : ''}${cls}`}>{inline(b.text, lang)}</p>;
    case 'li':
      return (
        <div className={`blk blk-li${cls}`}>
          <span className="li-n">{b.n}</span>
          <span>{inline(b.text, lang)}</span>
        </div>
      );
    case 'quote':
      return (
        <blockquote className={`blk blk-quote${cls}`}>
          {smartQuotes(b.quote.text, lang)}
          <footer>
            — {b.quote.author}
            {b.quote.source ? `, ${b.quote.source}` : ''}
          </footer>
        </blockquote>
      );
    case 'example':
      return (
        <div className={`blk blk-example${b.cont ? ' cont' : ''}${cls}`}>
          {!b.cont && <b className="ex-label">{exampleLabel}</b>}
          <p>{inline(b.text, lang)}</p>
        </div>
      );
    case 'act':
      return (
        <div className={`blk blk-act${cls}`}>
          <ActBox kind={b.kind} text={b.text} lang={lang} />
        </div>
      );
    case 'break':
      return null;
  }
}

// ---------------------------------------------------------------- pagination

interface Measured {
  h: number;
  mt: number;
}

/**
 * Greedy page layout: blocks fill a page until the next one no longer fits.
 * Headings stay with the block after them; `break` blocks force a new page.
 */
export function paginate(blocks: Block[], sizes: Measured[], avail: number): number[][] {
  const pages: number[][] = [];
  let page: number[] = [];
  let used = 0;
  const cost = (i: number, onEmpty: boolean) => sizes[i].h + (onEmpty ? 0 : sizes[i].mt);
  const flush = () => {
    if (page.length) pages.push(page);
    page = [];
    used = 0;
  };
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.k === 'break') {
      flush();
      continue;
    }
    let need = cost(i, !page.length);
    // keep a heading (or the start of an example) together with what follows it
    const next = i + 1 < blocks.length && blocks[i + 1].k !== 'break' ? i + 1 : -1;
    const keepWithNext = (b.k === 'title' || b.k === 'hero') && next >= 0;
    if (keepWithNext) need += cost(next, false);
    if (page.length && used + need > avail) flush();
    page.push(i);
    used += cost(i, page.length === 1);
  }
  flush();
  return pages.length ? pages : [[]];
}

/** Splits a paragraph roughly in half at a sentence end. Returns null when it is a single sentence. */
function halve(text: string): [string, string] | null {
  const sentences = text.match(/[^.!?…]+(?:[.!?…]+["“”»«']?\s*|$)/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
  if (sentences.length < 2) return null;
  const mid = Math.ceil(sentences.length / 2);
  return [sentences.slice(0, mid).join(' '), sentences.slice(mid).join(' ')];
}

function usePages(source: Block[], fontKey: string) {
  const viewport = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const [blocks, setBlocks] = useState(source);
  const [pages, setPages] = useState<number[][] | null>(null);
  const [tick, setTick] = useState(0);

  const firstSource = useRef(source);
  useEffect(() => {
    if (source === firstSource.current) return;
    firstSource.current = source;
    setBlocks(source);
  }, [source]);

  useLayoutEffect(() => {
    const vp = viewport.current;
    const col = measure.current;
    if (!vp || !col) return;
    const style = getComputedStyle(col.parentElement!);
    const avail = vp.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    if (avail <= 40) return;
    const els = Array.from(col.children) as HTMLElement[];
    const visible = blocks.map((b, i) => (b.k === 'break' ? -1 : i)).filter((i) => i >= 0);
    const sizes: Measured[] = blocks.map(() => ({ h: 0, mt: 0 }));
    visible.forEach((bi, ei) => {
      const el = els[ei];
      if (!el) return;
      sizes[bi] = { h: el.getBoundingClientRect().height, mt: parseFloat(getComputedStyle(el).marginTop) || 0 };
    });
    // A paragraph taller than a page is split at a sentence end and measured again.
    const tooTall = blocks.findIndex((b, i) => (b.k === 'p' || b.k === 'example') && sizes[i].h > avail && halve(b.text));
    if (tooTall >= 0) {
      const b = blocks[tooTall] as Extract<Block, { k: 'p' | 'example' }>;
      const [a, c] = halve(b.text)!;
      setBlocks([...blocks.slice(0, tooTall), { ...b, text: a }, { ...b, text: c, cont: true }, ...blocks.slice(tooTall + 1)]);
      return;
    }
    const next = paginate(blocks, sizes, avail);
    setPages((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, [blocks, tick, fontKey]);

  // Re-measure when the size changes or the reading font has loaded.
  useEffect(() => {
    const vp = viewport.current;
    if (!vp) return;
    let w = vp.clientWidth;
    let h = vp.clientHeight;
    const ro = new ResizeObserver(() => {
      if (vp.clientWidth === w && vp.clientHeight === h) return;
      w = vp.clientWidth;
      h = vp.clientHeight;
      setBlocks(source);
      setTick((t) => t + 1);
    });
    ro.observe(vp);
    const fonts = document.fonts;
    const onFonts = () => setTick((t) => t + 1);
    void fonts?.ready.then(onFonts);
    fonts?.addEventListener?.('loadingdone', onFonts);
    return () => {
      ro.disconnect();
      fonts?.removeEventListener?.('loadingdone', onFonts);
    };
  }, [source]);

  return { viewport, measure, blocks, pages };
}

// ---------------------------------------------------------------- card

function Meta({ card, badge }: { card: Card; badge?: string }) {
  const tr = useT();
  const area = AREA_BY_ID[card.area];
  return (
    <header className="card-meta">
      <Icon name={area.icon} size={16} />
      <span className="crumb">
        {area.label[tr.lang]} <span>· {subtopicLabel(card.area, card.sub, tr.lang)}</span>
      </span>
      <span className={`chip ${badge ? 'chip-badge' : ''}`}>
        {badge ??
          (card.publishedAt
            ? // News show their date instead of the card style.
              new Date(card.publishedAt).toLocaleDateString(tr.lang === 'de' ? 'de-CH' : 'en-US', { day: 'numeric', month: 'short' })
            : STYLE_LABELS[card.style][tr.lang])}
      </span>
    </header>
  );
}

export interface CardViewProps {
  card: Card;
  /** The card on screen: arrow keys turn its pages. */
  active?: boolean;
  /** Action bar, part of the card: it moves with the card but stays put while paging sideways. */
  actions?: ReactNode;
  /** Note above the content, e.g. the "Umsetzen" check-in. */
  banner?: ReactNode;
  /** Small label instead of the style chip (e.g. "Wiederholung"). */
  badge?: string;
  onPage?: (index: number, count: number) => void;
}

export function CardView({ card, active, actions, banner, badge, onPage }: CardViewProps) {
  const tr = useT();
  const fontSize = useStore((s) => s.settings.fontSize);
  const area = AREA_BY_ID[card.area];
  const [source, setSource] = useState(() => cardBlocks(card, tr.lang));
  const lastKey = useRef(`${card.id}:${tr.lang}`);
  useEffect(() => {
    const key = `${card.id}:${tr.lang}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    setSource(cardBlocks(card, tr.lang));
  }, [card, tr.lang]);

  const { viewport, measure, blocks, pages } = usePages(source, `${fontSize}:${!!banner}`);
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const count = pages?.length ?? 1;

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => {
      const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
      setIndex((prev) => (prev === i ? prev : i));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [pages]);

  useEffect(() => onPage?.(index, count), [index, count, onPage]);

  const go = useCallback((i: number) => {
    const el = track.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('.sheet')) return;
      if (e.key === 'ArrowRight') go(Math.min(count - 1, index + 1));
      if (e.key === 'ArrowLeft') go(Math.max(0, index - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, count, index, go]);

  const exampleLabel = tr('example');
  const style = { '--area': area.color } as CSSProperties;

  return (
    <article className={`card card--${card.format}`} style={style} data-card={card.id}>
      <Meta card={card} badge={badge} />
      {banner}
      <div className={`pager-progress ${count > 1 ? '' : 'single'}`} aria-label={`${index + 1} ${tr('of')} ${count}`}>
        {count > 1 && (
          <>
            <div className="pager-bars">
              {Array.from({ length: count }, (_, i) => (
                <i key={i} className={i <= index ? 'on' : ''} onClick={() => go(i)} />
              ))}
            </div>
            <span className="pager-count">
              {index + 1}/{count}
            </span>
          </>
        )}
      </div>
      <div className="pager" ref={viewport}>
        <div className="pager-measure" aria-hidden="true">
          <div className="page-col" ref={measure}>
            {blocks.map((b, i) => (b.k === 'break' ? null : <BlockView key={i} b={b} lang={tr.lang} exampleLabel={exampleLabel} first={i === 0} />))}
          </div>
        </div>
        {pages && (
          <div className="pager-track" ref={track}>
            {pages.map((ids, p) => (
              <section className="page" key={p} aria-roledescription="page" aria-label={`${p + 1}/${count}`}>
                <div className={`page-col ${count === 1 || ids.every((bi) => blocks[bi].k === 'act') ? 'center' : ''}`}>
                  {ids.map((bi, j) => (
                    <BlockView key={bi} b={blocks[bi]} lang={tr.lang} exampleLabel={exampleLabel} first={j === 0} />
                  ))}
                </div>
                {p > 0 && (
                  <button className="page-prev" onClick={() => go(p - 1)} aria-label={tr('prevPage')}>
                    <Icon name="chevron" size={16} />
                    <span>{tr('prevPage')}</span>
                  </button>
                )}
                {p < count - 1 && (
                  <button className="page-next" onClick={() => go(p + 1)} aria-label={tr('nextPage')}>
                    {p === 0 && <span>{tr('pageHint')}</span>}
                    <Icon name="chevron" size={16} />
                  </button>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
      {actions}
    </article>
  );
}

// ---------------------------------------------------------------- detail

/** A whole card in one column, for the profile (saved cards, history, "Umsetzen"). */
export function CardDetail({ card }: { card: Card }) {
  const tr = useT();
  const area = AREA_BY_ID[card.area];
  const blocks = cardBlocks(card, tr.lang);
  return (
    <article className={`detail card--${card.format}`} style={{ '--area': area.color } as CSSProperties}>
      <Meta card={card} />
      <div className="page-col">
        {blocks.map((b, i) =>
          b.k === 'break' ? null : <BlockView key={i} b={b} lang={tr.lang} exampleLabel={tr('example')} first={i === 0} />,
        )}
      </div>
    </article>
  );
}

/** Heading and text of a card's closing section, for lists. */
export function actOf(card: Card, lang: Lang): { label: string; text: string } | null {
  const text = card[lang].act;
  if (!text) return null;
  return { label: ACT_LABELS[card.actKind ?? 'heute'][lang], text: text.replace(/^- /gm, '• ') };
}
