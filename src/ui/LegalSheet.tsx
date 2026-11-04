import { Fragment, type ReactNode } from 'react';
import { LEGAL, LEGAL_UPDATED, OWNER } from '../content/legal';
import type { Lang } from '../content/taxonomy';
import { useT } from '../i18n/strings';
import { useStore } from '../store/store';
import { inline } from './CardView';
import { Sheet } from './Sheet';

/** One line of legal text: **bold**, [links](https://…), {name} and {email}. */
function line(raw: string, lang: Lang): ReactNode {
  const text = raw.replace(/\{name\}/g, OWNER.name);
  return text.split(/(\[[^\]]+\]\(https:\/\/[^)\s]+\)|\{email\})/g).map((part, i) => {
    if (part === '{email}') {
      return (
        <a key={i} href={`mailto:${OWNER.email}`}>
          {OWNER.email}
        </a>
      );
    }
    const link = /^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/.exec(part);
    if (link) {
      return (
        <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">
          {link[1]}
        </a>
      );
    }
    return <Fragment key={i}>{inline(part, lang)}</Fragment>;
  });
}

function Block({ text, lang }: { text: string; lang: Lang }) {
  const lines = text.split('\n');
  if (lines.every((l) => l.startsWith('- '))) {
    return (
      <ul>
        {lines.map((l, i) => (
          <li key={i}>{line(l.slice(2), lang)}</li>
        ))}
      </ul>
    );
  }
  return (
    <p>
      {lines.map((l, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line(l, lang)}
        </Fragment>
      ))}
    </p>
  );
}

export function LegalSheet({ onClose }: { onClose: () => void }) {
  const tr = useT();
  const lang = useStore((s) => s.settings.lang);
  return (
    <Sheet title={tr('legal')} onClose={onClose}>
      <div className="legal">
        {LEGAL[lang].map((s) => (
          <section key={s.h}>
            <h3>{s.h}</h3>
            {s.text.split('\n\n').map((b, i) => (
              <Block key={i} text={b} lang={lang} />
            ))}
          </section>
        ))}
        <p className="hint">
          {tr('legalUpdated')} {LEGAL_UPDATED[lang]}
        </p>
      </div>
    </Sheet>
  );
}
