import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { Card, CardText } from '../content/card';
import { initials, PERSON_BY_ID } from '../content/people';
import { FIGURE_LINE, figureSvg } from '../figures';
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
  /** `cont`: continues the paragraph before it (split to fit the page). */
  | { k: 'p'; text: string; cont?: boolean }
  /** A list item: numbered (`n`) or a bullet (from `- ` lines in the text). */
  | { k: 'li'; text: string; n?: number }
  /** A key sentence (`> ` in the text), shown highlighted. */
  | { k: 'key'; text: string }
  | { k: 'quote'; quote: Quote }
  | { k: 'example'; text: string; cont?: boolean }
  | { k: 'act'; kind: ActKind; text: string }
  /** A figure (`[[grafik:id]]` in the text), see src/figures. */
  | { k: 'fig'; id: string }
  | { k: 'break' };

/** Paragraphs longer than this are split at a sentence end, so no block of text gets heavy. */
const MAX_PARAGRAPH_WORDS = 42;

function words(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Splits a long paragraph into shorter ones at sentence ends. */
export function shorten(text: string): string[] {
  if (words(text) <= MAX_PARAGRAPH_WORDS) return [text];
  const halves = halve(text);
  if (!halves || words(halves[0]) < 12 || words(halves[1]) < 12) return [text];
  return [...shorten(halves[0]), ...shorten(halves[1])];
}

/**
 * Text with simple structure:
 * blank lines separate paragraphs, `---` starts a new page, `## ` is a subheading,
 * `> ` a key sentence, lines starting with `- ` a bullet list, `1. ` a numbered list and `[[grafik:id]]` a figure.
 */
export function textToBlocks(text: string): Block[] {
  const out: Block[] = [];
  for (const part of text.split(/\n{2,}/).map((p) => p.trim())) {
    if (!part) continue;
    const fig = FIGURE_LINE.exec(part);
    if (part === '---') out.push({ k: 'break' });
    else if (fig) out.push({ k: 'fig', id: fig[1] });
    else if (part.startsWith('## ')) out.push({ k: 'title', text: part.slice(3), sub: true });
    else if (part.startsWith('> ')) out.push({ k: 'key', text: part.replace(/^> /gm, '').replace(/\n/g, ' ') });
    else if (part.split('\n').every((l) => l.trim().startsWith('- ')))
      for (const l of part.split('\n')) out.push({ k: 'li', text: l.trim().slice(2) });
    else if (part.split('\n').every((l) => /^\d+\. /.test(l.trim())))
      for (const l of part.split('\n')) out.push({ k: 'li', text: l.trim().replace(/^\d+\. /, ''), n: parseInt(l, 10) });
    else for (const p of shorten(part.replace(/\n/g, ' '))) out.push({ k: 'p', text: p });
  }
  return out;
}

function textBlocks(t: CardText, sub: boolean, skipQuote: boolean): Block[] {
  const out: Block[] = [{ k: 'title', text: t.title, sub }];
  out.push(...textToBlocks(t.body));
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
  // It follows right after; the page layout keeps its heading together with the first paragraph.
  if (t.deep) out.push({ k: 'title', text: DEEP_LABEL[lang], sub: true, deep: true }, ...textToBlocks(t.deep));
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

function Figure({ id, lang, cls }: { id: string; lang: Lang; cls: string }) {
  const html = useMemo(() => figureSvg(id, lang), [id, lang]);
  return html ? <figure className={`blk blk-fig${cls}`} dangerouslySetInnerHTML={{ __html: html }} /> : null;
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
        <div className={`blk blk-li${b.n === undefined ? ' bullet' : ''}${cls}`}>
          <span className="li-n">{b.n ?? ''}</span>
          <span>{inline(b.text, lang)}</span>
        </div>
      );
    case 'key':
      return <p className={`blk blk-key${cls}`}>{inline(b.text, lang)}</p>;
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
    case 'fig':
      return <Figure id={b.id} lang={lang} cls={cls} />;
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
    // a subheading with a list under it stays on one page when the whole list fits there,
    // so no single bullet is left alone on the next page
    if (b.k === 'title' && b.sub && next >= 0 && blocks[next].k === 'li') {
      let run = cost(i, !page.length);
      let j = next;
      while (j < blocks.length && blocks[j].k === 'li') run += cost(j++, false);
      if (run - (page.length ? sizes[i].mt : 0) <= avail) need = Math.max(need, run);
    }
    if (page.length && used + need > avail) flush();
    page.push(i);
    used += cost(i, page.length === 1);
  }
  flush();
  // a list cut across pages never leaves a single bullet alone at the top of the next page
  for (let p = 1; p < pages.length; p++) {
    const prev = pages[p - 1];
    const cur = pages[p];
    const lone = blocks[cur[0]]?.k === 'li' && blocks[cur[1]]?.k !== 'li';
    const a = prev[prev.length - 1];
    const b = prev[prev.length - 2];
    if (!lone || blocks[a]?.k !== 'li' || blocks[b]?.k !== 'li' || a !== cur[0] - 1) continue;
    const height = [a, ...cur].reduce((sum, bi, j) => sum + cost(bi, j === 0), 0);
    if (height <= avail) pages[p] = [prev.pop()!, ...cur];
  }
  return pages.length ? pages : [[]];
}

/** Splits a paragraph roughly in half at a sentence end. Returns null when it is a single sentence. */
/** The sentences of a paragraph; a quotation in straight quotes is never cut apart. */
function sentencesOf(text: string): string[] {
  const raw = text.match(/[^.!?…]+(?:[.!?…]+["“”»«']?\s*|$)/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
  const out: string[] = [];
  let open = false;
  for (const piece of raw) {
    if (open) out[out.length - 1] += ` ${piece}`;
    else out.push(piece);
    if ((piece.match(/"/g)?.length ?? 0) % 2 === 1) open = !open;
  }
  return out;
}

function halve(text: string): [string, string] | null {
  const sentences = sentencesOf(text);
  if (sentences.length < 2) return null;
  const mid = Math.ceil(sentences.length / 2);
  return [sentences.slice(0, mid).join(' '), sentences.slice(mid).join(' ')];
}

function usePages(source: Block[], fontKey: string) {
  const viewport = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const [blocks, setBlocks] = useState(source);
  // pages always come with the block list they index into, so a re-layout never mixes the two
  const [layout, setLayout] = useState<{ blocks: Block[]; pages: number[][] } | null>(null);
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
    // A page left half empty because the next paragraph didn't fit: start that paragraph here
    // and continue it on the next page, so pages are full and cards no longer than they need to be.
    for (let p = 0; p < next.length - 1; p++) {
      const ids = next[p];
      const first = next[p + 1][0];
      const b = blocks[first];
      if (!ids.length || b?.k !== 'p' || blocks[first - 1]?.k === 'break' || blocks[first - 1]?.k === 'title') continue;
      const used = ids.reduce((sum, bi, j) => sum + sizes[bi].h + (j ? sizes[bi].mt : 0), 0);
      const free = avail - used - sizes[first].mt;
      if (free < avail * 0.22 || free < 60) continue;
      const parts = sentencesOf(b.text);
      const total = b.text.length;
      let take = 0;
      let chars = 0;
      // estimate by text length, with a margin; a wrong guess only moves the piece to the next page
      while (take < parts.length - 1 && ((chars + parts[take].length + 1) / total) * sizes[first].h <= free * 0.85) {
        chars += parts[take].length + 1;
        take++;
      }
      if (take === 0) continue;
      setBlocks([
        ...blocks.slice(0, first),
        { ...b, text: parts.slice(0, take).join(' ') },
        { ...b, text: parts.slice(take).join(' '), cont: true },
        ...blocks.slice(first + 1),
      ]);
      return;
    }
    setLayout((prev) => (prev && prev.blocks === blocks && JSON.stringify(prev.pages) === JSON.stringify(next) ? prev : { blocks, pages: next }));
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

  return { viewport, measure, blocks, pages: layout?.pages ?? null, pageBlocks: layout?.blocks ?? blocks };
}

// ---------------------------------------------------------------- card

/** Round avatar with a person's initials, in the colour of the person's area. */
export function Avatar({ personId, size = 22 }: { personId: string; size?: number }) {
  const p = PERSON_BY_ID[personId];
  if (!p) return null;
  const color = AREA_BY_ID[p.area]?.color;
  return (
    <span className="avatar" style={{ '--area': color, width: size, height: size, fontSize: size * 0.4 } as CSSProperties} aria-hidden="true">
      {initials(p.name)}
    </span>
  );
}

function Meta({ card, badge, onPerson }: { card: Card; badge?: string; onPerson?: (personId: string) => void }) {
  const tr = useT();
  const area = AREA_BY_ID[card.area];
  const person = card.people?.[0] ? PERSON_BY_ID[card.people[0]] : undefined;
  return (
    <header className="card-meta">
      {person ? (
        // A card about someone shows who it is about; tapping opens the person's profile.
        <button
          className="person-chip"
          disabled={!onPerson}
          onClick={() => onPerson?.(person.id)}
          aria-label={`${person.name}: ${tr('openProfile')}`}
        >
          <Avatar personId={person.id} />
          <span className="crumb">
            <b>{person.name}</b> <span>· {area.label[tr.lang]}</span>
          </span>
        </button>
      ) : (
        <>
          <Icon name={area.icon} size={16} />
          <span className="crumb">
            {area.label[tr.lang]} <span>· {subtopicLabel(card.area, card.sub, tr.lang)}</span>
          </span>
        </>
      )}
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
  /** Open the profile of the person the card is about. */
  onPerson?: (personId: string) => void;
  onPage?: (index: number, count: number) => void;
}

export function CardView({ card, active, actions, banner, badge, onPerson, onPage }: CardViewProps) {
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

  const { viewport, measure, blocks, pages, pageBlocks } = usePages(source, `${fontSize}:${!!banner}`);
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
      <Meta card={card} badge={badge} onPerson={onPerson} />
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
                <div className={`page-col ${count === 1 || ids.every((bi) => pageBlocks[bi].k === 'act') ? 'center' : ''}`}>
                  {ids.map((bi, j) => (
                    <BlockView key={bi} b={pageBlocks[bi]} lang={tr.lang} exampleLabel={exampleLabel} first={j === 0} />
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
export function CardDetail({ card, onPerson }: { card: Card; onPerson?: (personId: string) => void }) {
  const tr = useT();
  const area = AREA_BY_ID[card.area];
  const blocks = cardBlocks(card, tr.lang);
  return (
    <article className={`detail card--${card.format}`} style={{ '--area': area.color } as CSSProperties}>
      <Meta card={card} onPerson={onPerson} />
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
