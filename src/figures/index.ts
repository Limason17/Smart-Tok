// Card figures. A card places one with a paragraph that is only `[[grafik:<id>]]`;
// standing alone between two `---` it fills a whole page.
// Rules: one statement per figure, labels on the lines instead of a legend, no grid, at most three colours,
// motion only where it explains how something works (and never with "reduce motion").
import type { Lang } from '../content/taxonomy';
import {
  arrow,
  box,
  chart,
  chev,
  col,
  dot,
  heat,
  key,
  ln,
  mix,
  padlock,
  person,
  plot,
  pth,
  r1,
  satellite,
  svg,
  txt,
} from './kit';

export const FIGURE_LINE = /^\[\[grafik:([a-z0-9-]+)\]\]$/;

interface Ctx {
  /** Picks the label in the card's language. */
  l: (de: string, en: string) => string;
  /** A document-unique id for gradients and clip paths (a figure can be on screen more than once). */
  u: (name: string) => string;
}

const FIGURES: Record<string, (c: Ctx) => string> = {
  'himmel-streuung'({ l, u }) {
    // Curved Earth with its shell of air: the light's path through the air is short at noon, long in the evening.
    const panel = (ox: number, eve: boolean) => {
      const id = u(eve ? 'e' : 'n');
      const cx = ox + (eve ? 110 : 75);
      const ey = 150;
      const R = 90;
      const A = 30;
      const cy = ey + R;
      let g = `<defs><clipPath id="${id}c"><rect x="${ox}" y="0" width="150" height="166" rx="10"/></clipPath>
        <radialGradient id="${id}a" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${R + A}">
        <stop offset="${R / (R + A)}" stop-color="${col(eve ? 'warm' : 'cold')}" stop-opacity="${eve ? 0.55 : 0.5}"/>
        <stop offset="1" stop-color="${col('cold')}" stop-opacity=".12"/></radialGradient>
        <linearGradient id="${id}r" gradientUnits="userSpaceOnUse" x1="${ox + 41}" y1="0" x2="${cx}" y2="0">
        <stop offset="0" stop-color="${col('sun')}"/><stop offset="1" stop-color="${col('warm')}"/></linearGradient></defs>
        <g clip-path="url(#${id}c)">${box(ox, 0, 150, 166, 'card2', 0)}
        <circle cx="${cx}" cy="${cy}" r="${R + A}" fill="url(#${id}a)"/><circle cx="${cx}" cy="${cy}" r="${R}" fill="${mix('text', 'card', 14)}"/>`;
      if (!eve) {
        g += dot(cx, 26, 'sun', 10) + ln(cx, 38, cx, ey - 16, 'sun', 2.5);
        for (const [y, s] of [[122, -1], [128, 1]]) g += pth(`M${cx} ${y} l${14 * s} -7`, 'cold', 2);
        g += txt(ox + 8, 158, l('Luft', 'air'), { k: 's' });
      } else {
        g += dot(ox + 10, ey - 10, 'warm', 10);
        g += `<path d="M${ox + 22} ${ey - 10} L${cx - 6} ${ey - 10}" stroke="url(#${id}r)" stroke-width="2.5" fill="none"/>`;
        for (const [x, s] of [[ox + 50, -1], [ox + 60, 1], [ox + 70, -1], [ox + 80, 1]]) g += pth(`M${x} ${ey - 10} l-5 ${12 * s}`, 'cold', 2);
      }
      return g + person(cx, ey) + '</g>';
    };
    return svg(
      320,
      200,
      panel(4, false) +
        panel(166, true) +
        txt(79, 182, l('Mittag', 'Noon'), { a: 'middle', k: 'h' }) +
        txt(79, 196, l('kurzer Weg: Blau überall', 'short path: blue everywhere'), { a: 'middle' }) +
        txt(241, 182, l('Abend', 'Evening'), { a: 'middle', k: 'h' }) +
        txt(241, 196, l('langer Weg: Rot kommt an', 'long path: red remains'), { a: 'middle' }),
      l(
        'Mittags ist der Weg des Lichts durch die Luft kurz, Blau wird überall verteilt. Abends ist er lang, das Blau ist weggestreut, Rot kommt an.',
        'At noon the light takes a short path through the air and blue is scattered everywhere. In the evening the path is long, the blue is scattered away and red gets through.',
      ),
    );
  },

  'inflation-kaufkraft': ({ l }) =>
    chart({
      x: [0, 40],
      y: [0, 100],
      xt: [0, 10, 20, 30, 40],
      yt: [0, 50, 100],
      xl: l('Jahre', 'years'),
      yl: l('Was 100 Fr. noch kaufen', 'What 100 still buys'),
      hl: [{ v: 50, label: l('die Hälfte', 'half') }],
      series: [
        { f: (t) => 100 / 1.02 ** t, end: '45', tag: { t: 4, dy: -9, text: l('2 % Inflation', '2% inflation') } },
        { f: (t) => 100 / 1.04 ** t, end: '21', tag: { t: 7, dy: 18, text: l('4 %', '4%') }, c: 'warm' },
      ],
      marks: [
        { x: 17.7, y: 50, c: 'warm', label: l('18 J.', '18 yrs') },
        { x: 35, y: 50, c: 'area', label: l('35 J.', '35 yrs'), dy: 19 },
      ],
      aria: l(
        'Kaufkraft von 100 Franken über 40 Jahre: bei 2 Prozent Inflation nach 35 Jahren halbiert, am Ende 45; bei 4 Prozent nach 18 Jahren halbiert, am Ende 21.',
        'Purchasing power of 100 over 40 years: halved after 35 years at 2 percent inflation, 45 at the end; halved after 18 years at 4 percent, 21 at the end.',
      ),
    }),

  'gewohnheit-kurve'({ l }) {
    const a = (d: number) => 100 * (1 - Math.exp(-d / 22));
    return chart({
      x: [0, 260],
      y: [0, 100],
      h: 222,
      b: 60,
      r: 16,
      l: 16,
      xt: [0, { v: 21, c: 'warm' }, { v: 66, c: 'area' }, 200],
      yl: l('läuft automatisch', 'runs on autopilot'),
      series: [{ f: a, fill: true, w: 3 }],
      marks: [
        { x: 21, y: a(21), c: 'warm', drop: true, dash: '3 3' },
        { x: 66, y: a(66), c: 'area', drop: true },
      ],
      extra: ({ X, B }) =>
        txt(128, 112, l('21 Tage: noch nicht fertig', '21 days: not there yet'), { c: 'warm', k: 'b' }) +
        txt(128, 128, l('66 Tage: läuft automatisch', '66 days: automatic'), { c: 'area', k: 'b' }) +
        box(X(18), B + 24, X(254) - X(18), 6, 'soft', 3) +
        ln(X(66), B + 22, X(66), B + 32, 'area', 2) +
        txt(X(18), B + 44, '18', { a: 'middle', k: 's' }) +
        txt(X(254), B + 44, l('254 Tage', '254 days'), { a: 'end', k: 's' }) +
        txt(X(136), B + 44, l('so verschieden waren die Menschen', 'that is how much people differed'), { a: 'middle', k: 's' }),
      aria: l(
        'Kurve, wie automatisch eine Gewohnheit wird: nach 21 Tagen noch nicht fertig, im Mittel nach 66 Tagen automatisch. Je nach Person zwischen 18 und 254 Tagen.',
        'Curve of how automatic a habit becomes: not there after 21 days, automatic after 66 days on average. Between 18 and 254 days depending on the person.',
      ),
    });
  },

  'gps-kreise'({ l, u }) {
    const P = [140, 222] as const;
    const S: [number, number, string, string][] = [
      [46, 44, 'area', '1'],
      [232, 36, 'accent', '2'],
      [258, 140, 'warm', '3'],
    ];
    const clip = u('gps');
    let g = `<defs><clipPath id="${clip}"><rect width="280" height="250" rx="12"/></clipPath></defs>
      <g clip-path="url(#${clip})"><path d="M0 236 Q140 196 280 236 L280 250 L0 250Z" fill="${col('soft')}"/>${S.map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="${r1(Math.hypot(P[0] - x, P[1] - y))}" fill="none" stroke="${col(c)}" stroke-width="1.6" stroke-dasharray="5 5"/>`).join('')}</g>`;
    g += `<circle cx="${P[0]}" cy="${P[1]}" r="24" fill="${col('text')}" opacity=".12"/>` + box(P[0] - 7, P[1] - 12, 14, 24, 'text', 3);
    g += S.map(([x, y, c, n], i) => satellite(x, y, c, n, i * 0.9)).join('') + satellite(24, 128, 't2', '4', 2.7);
    g += txt(8, 152, l('korrigiert die Uhr', 'fixes the clock'), { k: 's' });
    g += txt(P[0], 266, l('Du', 'You'), { a: 'middle', k: 'h' });
    g += txt(P[0], 284, l('Abstand = Laufzeit × Lichtgeschwindigkeit', 'distance = travel time × speed of light'), { a: 'middle', k: 's' });
    return svg(
      280,
      296,
      g,
      l(
        'Drei Satelliten, jeder mit einem Kreis für seinen Abstand. Die Kreise schneiden sich an einem Punkt, dort ist das Handy. Ein vierter Satellit korrigiert die Uhr.',
        'Three satellites, each with a circle for its distance. The circles meet at one point, where the phone is. A fourth satellite fixes the clock.',
      ),
    );
  },

  'kuehlschrank-kreislauf'({ l, u }) {
    // One loop in flow order: up through the cold coil inside, over the compressor,
    // down through the warm grid at the back, back through the narrow point.
    const loop =
      'M62 196 L62 140 l14 -8 l-28 -12 l28 -12 l-28 -12 l28 -12 l-14 -8 L62 60 Q62 52 70 52 L232 52 Q240 52 240 60 L240 120 l14 6 l-28 10 l28 10 l-28 10 l28 10 l-14 6 L240 196 Q240 204 232 204 L70 204 Q62 204 62 196';
    const [cl, cr] = [u('fl'), u('fr')];
    let g = `<defs><clipPath id="${cl}"><rect width="150" height="240"/></clipPath><clipPath id="${cr}"><rect x="150" width="150" height="240"/></clipPath></defs>`;
    g += box(6, 20, 112, 204, mix('cold', 'card', 10), 12, `stroke="${col('cold')}" stroke-dasharray="4 4"`) + box(182, 20, 112, 204, mix('warm', 'card', 8), 12);
    g += txt(14, 36, l('Innenraum', 'Inside'), { c: 'cold', k: 'b' }) + txt(286, 36, l('Küche', 'Kitchen'), { a: 'end', c: 'warm', k: 'b' });
    g += `<g clip-path="url(#${cl})">${pth(loop, 'cold', 4.5)}</g><g clip-path="url(#${cr})">${pth(loop, 'warm', 4.5)}</g>`;
    g += pth(loop, 'card', 2, 'class="fig-flow" stroke-dasharray="3 13" opacity=".9"');
    g += heat(18, 104, 1) + heat(18, 128, 1) + heat(262, 140, 1) + heat(262, 162, 1);
    g += txt(18, 152, l('Wärme rein', 'heat in'), { k: 's' }) + txt(290, 188, l('Wärme raus', 'heat out'), { a: 'end', k: 's' });
    g += `<circle cx="156" cy="52" r="18" fill="${col('card2')}" stroke="${col('t2')}" stroke-width="2"/>` + pth('M148 52 h14 m-5 -5 l5 5 l-5 5', 'text', 2);
    g += box(140, 196, 32, 16, 'card', 0) + pth('M140 199 Q156 206 172 199 M140 209 Q156 202 172 209', 't2', 2);
    g += chev(62, 168, -90, 'cold') + chev(240, 96, 90, 'warm');
    const step = (x: number, y: number, c: string, n: number) => dot(x, y, c, 9) + txt(x, y + 4, n, { a: 'middle', k: 'b n', c: 'card' });
    g += step(96, 78, 'cold', 1) + step(156, 18, 't2', 2) + step(212, 130, 'warm', 3) + step(156, 232, 't2', 4);
    return svg(
      300,
      250,
      g,
      l(
        'Kreislauf: Im Innenraum verdampft das Kältemittel und nimmt Wärme auf. Der Kompressor macht es heiss. Hinten gibt es die Wärme an die Küche ab. Eine Engstelle kühlt es wieder ab.',
        'The loop: inside, the refrigerant evaporates and takes up heat. The compressor makes it hot. At the back it gives the heat off to the kitchen. A narrow point cools it down again.',
      ),
    );
  },

  'gegenschall'({ l, u }) {
    // Both waves drift together, so they keep cancelling; the sum stays flat.
    const clip = u('nz');
    const wave = (y: number, s: number, c: string) =>
      `<g clip-path="url(#${clip})"><g class="fig-drift">${pth(plot((x) => y - s * 16 * Math.sin(((x - 80) / 76) * 2 * Math.PI), 4, 390, (x) => x, (v) => v, 160), c, 2.6)}</g></g>`;
    const g =
      `<defs><clipPath id="${clip}"><rect x="80" y="0" width="230" height="150"/></clipPath></defs>` +
      txt(0, 36, l('Lärm', 'Noise'), { k: 'h' }) +
      wave(32, 1, 'warm') +
      txt(58, 66, '+', { a: 'middle', k: 'h' }) +
      txt(0, 92, l('Gegenwelle', 'Anti-wave'), { c: 'area', k: 'b' }) +
      wave(88, -1, 'area') +
      txt(58, 120, '=', { a: 'middle', k: 'h' }) +
      txt(0, 140, l('Im Ohr', 'In your ear'), { k: 'h' }) +
      ln(80, 136, 310, 136, 'text', 2.6) +
      txt(310, 127, l('fast Stille', 'near silence'), { a: 'end', k: 's' });
    return svg(
      320,
      150,
      g,
      l(
        'Oben die Welle des Lärms, darunter die gespiegelte Gegenwelle. Zusammen ergeben sie eine flache Linie: Stille.',
        'At the top the wave of the noise, below it the mirrored anti-wave. Together they add up to a flat line: silence.',
      ),
    );
  },

  'mikrowelle-waerme'({ l, u }) {
    const blur = u('mwb');
    const block = (x: number, outer: string, inner: string) => {
      const clip = u(`mw${x}`);
      return `<clipPath id="${clip}"><rect x="${x}" y="30" width="122" height="88" rx="16"/></clipPath>
        <g clip-path="url(#${clip})">${box(x, 30, 122, 88, outer, 0)}${box(x + 26, 56, 70, 36, inner, 12, `filter="url(#${blur})"`)}</g>`;
    };
    let g = `<defs><filter id="${blur}" x="-40%" y="-60%" width="180%" height="220%"><feGaussianBlur stdDeviation="9"/></filter></defs>`;
    g += block(22, 'warm', 'cold') + block(190, mix('warm', 'cold', 88), mix('warm', 'cold', 62));
    g += heat(0, 74, 1) + heat(166, 74, -1) + `<g transform="rotate(90 83 6)">${heat(75, 6, 1)}</g>`;
    g += txt(83, 78, l('kalt', 'cold'), { a: 'middle', k: 'b n', c: 'card' }) + txt(251, 78, l('warm', 'warm'), { a: 'middle', k: 'b n', c: 'card' });
    g += ln(22, 126, 40, 126, 't2', 1.2) + ln(22, 122, 22, 130, 't2', 1.2) + ln(40, 122, 40, 130, 't2', 1.2);
    g += txt(46, 130, l('wenige cm', 'a few cm'), { k: 's' });
    g += arrow(164, 74, 180, 74);
    for (const [x, y, d] of [[200, 74, 0], [302, 74, 180], [251, 38, 90], [251, 110, -90]]) g += chev(x, y, d, 'card', 4);
    g += txt(83, 148, l('Direkt danach', 'Right after'), { a: 'middle', k: 'h' }) + txt(83, 162, l('Rand heiss, Kern kalt', 'hot edge, cold core'), { a: 'middle' });
    g += txt(251, 148, l('1 Min. ruhen', '1 min. rest'), { a: 'middle', k: 'h' }) + txt(251, 162, l('Wärme zieht nach innen', 'heat moves inwards'), { a: 'middle' });
    return svg(
      320,
      168,
      g,
      l(
        'Querschnitt durch eine Portion: direkt nach dem Erhitzen ist der Rand heiss und der Kern kalt. Nach einer Minute Ruhen ist die Wärme bis in die Mitte gewandert.',
        'Cross-section of a portion: right after heating the edge is hot and the core cold. After a minute of rest the heat has moved to the middle.',
      ),
    );
  },

  'verlust-aufholen'({ l }) {
    const B = 150;
    const k = 1.1; // px per unit
    const bars: [number, string, string, string][] = [
      [100, mix('text', 'card', 30), l('Start', 'Start'), ''],
      [50, 'warm', '−50 %', ''],
      [75, mix('text', 'card', 45), l('dann +50 %', 'then +50%'), l('reicht nicht', 'not enough')],
      [100, 'area', l('nötig: +100 %', 'needed: +100%'), l('zurück am Start', 'back to start')],
    ];
    let g = ln(10, B - 100 * k, 310, B - 100 * k, 't3', 1, '3 4') + ln(10, B, 310, B, 't3');
    bars.forEach(([v, c, a, b], i) => {
      const x = 22 + i * 74;
      g += box(x, B - v * k, 50, v * k, c, 4) + txt(x + 25, B - v * k - 6, v, { a: 'middle', k: 'h' });
      g += txt(x + 25, B + 16, a, { a: 'middle', k: 'b', c: i === 1 ? 'warm' : i === 3 ? 'area' : undefined });
      if (b) g += txt(x + 25, B + 30, b, { a: 'middle', k: 's' });
    });
    return svg(
      320,
      186,
      g,
      l(
        'Von 100 auf 50 ist ein Verlust von 50 Prozent. Plus 50 Prozent bringen dich nur auf 75 zurück. Erst plus 100 Prozent bringen dich wieder auf 100.',
        'Going from 100 to 50 is a 50 percent loss. Plus 50 percent only gets you back to 75. It takes plus 100 percent to reach 100 again.',
      ),
    );
  },

  'test-1000-menschen'({ l }) {
    // 1000 people as dots, ordered: 9 ill and positive, 89 healthy but positive, 1 ill and missed, 902 healthy and negative.
    let g = '';
    for (let i = 0; i < 1000; i++) {
      const x = 8 + (i % 50) * 5.9;
      const y = 8 + Math.floor(i / 50) * 5.9;
      if (i < 9) g += dot(x, y, 'area', 2.3);
      else if (i < 98) g += dot(x, y, 'warm', 2.1);
      else if (i === 98) g += `<circle cx="${r1(x)}" cy="${r1(y)}" r="1.9" fill="none" stroke="${col('area')}" stroke-width="1"/>`;
      else g += `<circle cx="${r1(x)}" cy="${r1(y)}" r="1.7" fill="${col('t3')}" opacity=".35"/>`;
    }
    const row = (y: number, c: string, s: string) => dot(14, y - 4, c, 4) + txt(26, y, s, c === 't3' ? {} : { c, k: 'b' });
    g += row(144, 'area', l('9 krank und positiv getestet', '9 ill and tested positive'));
    g += row(162, 'warm', l('89 gesund, aber positiv: Fehlalarm', '89 healthy but positive: false alarm'));
    g += row(180, 't3', l('902 negativ (1 Kranker übersehen)', '902 negative (1 ill person missed)'));
    g += txt(8, 204, l('Positiv: 98. Wirklich krank davon: 9.', 'Positive: 98. Actually ill: 9.'), { k: 'h' });
    return svg(
      310,
      212,
      g,
      l(
        '1000 Menschen als Punkte. 98 werden positiv getestet, davon sind nur 9 wirklich krank, 89 sind Fehlalarme.',
        '1000 people as dots. 98 test positive, only 9 of them are actually ill, 89 are false alarms.',
      ),
    );
  },

  'schloss-und-schluessel'({ l }) {
    const ys = 62;
    let g = '';
    g += txt(50, 20, l('öffentlich', 'public'), { a: 'middle', k: 's' }) + txt(250, 20, l('geheim', 'secret'), { a: 'middle', k: 's' });
    g += padlock(50, ys, 'area', true);
    g += box(128, ys - 14, 44, 32, mix('text', 'card', 22), 5) + padlock(150, ys + 2, 'accent');
    g += key(250, ys + 4, 'area');
    g += arrow(78, ys + 4, 112, ys + 4) + arrow(186, ys + 4, 220, ys + 4);
    const label = (x: number, a: string, b: string, c: string) =>
      txt(x, 112, a, { a: 'middle', k: 'h' }) + txt(x, 127, b, { a: 'middle', k: 's' }) + txt(x, 139, c, { a: 'middle', k: 's' });
    g += label(50, l('Bob verteilt', 'Bob hands out'), l('offene Schlösser', 'open padlocks'), l('an alle', 'to everyone'));
    g += label(150, l('Alice schliesst', 'Alice locks'), l('ihre Nachricht', 'her message'), l('damit ein', 'with one'));
    g += label(250, l('Nur Bob öffnet', 'Only Bob opens'), l('mit seinem', 'with his'), l('Schlüssel', 'secret key'));
    g += txt(150, 166, l('Abschliessen kann jeder, öffnen nur Bob.', 'Anyone can lock it. Only Bob can open it.'), { a: 'middle', c: 'area', k: 'b' });
    return svg(
      300,
      174,
      g,
      l(
        'Bob verteilt offene Schlösser an alle. Alice schliesst ihre Nachricht mit einem davon ein. Öffnen kann sie nur Bob mit seinem geheimen Schlüssel.',
        'Bob hands out open padlocks to everyone. Alice locks her message with one of them. Only Bob can open it, with his secret key.',
      ),
    );
  },

  'bank-bilanz'({ l }) {
    const top = 46;
    let g = txt(150, 16, l('Bilanz der Bank', 'The bank’s balance sheet'), { a: 'middle', k: 'h' });
    g += txt(78, 38, l('Was die Bank hat', 'What the bank owns'), { a: 'middle', k: 's' }) + txt(222, 38, l('Was die Bank schuldet', 'What the bank owes'), { a: 'middle', k: 's' });
    g += ln(10, top, 290, top, 't3') + ln(150, top, 150, 178, 't3');
    g += box(18, top + 8, 120, 46, mix('text', 'card', 18), 5) + box(162, top + 8, 120, 46, mix('text', 'card', 18), 5);
    g += txt(78, top + 35, l('bisher', 'before'), { a: 'middle', k: 'n' }) + txt(222, top + 35, l('bisher', 'before'), { a: 'middle', k: 'n' });
    g += box(18, top + 60, 120, 58, 'area', 5) + box(162, top + 60, 120, 58, 'area', 5);
    g += txt(78, top + 84, l('Kredit an dich', 'Loan to you'), { a: 'middle', k: 'b n', c: 'card' }) + txt(78, top + 100, '+ 100 000', { a: 'middle', k: 'b n', c: 'card' });
    g += txt(222, top + 84, l('Guthaben auf', 'Balance in'), { a: 'middle', k: 'b n', c: 'card' }) + txt(222, top + 100, l('deinem Konto', 'your account'), { a: 'middle', k: 'b n', c: 'card' });
    g += txt(150, 196, l('Beide Seiten wachsen gleichzeitig.', 'Both sides grow at once.'), { a: 'middle', c: 'area', k: 'b' });
    g += txt(150, 212, l('Das Guthaben ist neues Geld.', 'The balance is new money.'), { a: 'middle', c: 'area', k: 'b' });
    return svg(
      300,
      220,
      g,
      l(
        'Bilanz einer Bank: Vergibt sie einen Kredit von 100 000, wächst die linke Seite um den Kredit und die rechte um das Guthaben auf deinem Konto. Das Guthaben ist neu geschaffenes Geld.',
        'A bank’s balance sheet: when it grants a loan of 100,000, the left side grows by the loan and the right side by the balance in your account. That balance is newly created money.',
      ),
    );
  },

  'jahreszeiten-achse'({ l }) {
    const tilt = 23.4;
    const earth = (x: number, litRight: boolean) => {
      const dx = Math.sin((tilt * Math.PI) / 180) * 24;
      const dy = Math.cos((tilt * Math.PI) / 180) * 24;
      const half = litRight ? `M${x} ${90 - 14} A14 14 0 0 1 ${x} ${90 + 14}Z` : `M${x} ${90 - 14} A14 14 0 0 0 ${x} ${90 + 14}Z`;
      return (
        dot(x, 90, mix('text', 'card', 22), 14) +
        `<path d="${half}" fill="${col('sun')}" opacity=".85"/>` +
        ln(x - dx, 90 + dy, x + dx, 90 - dy, 'text', 1.6) +
        txt(x + dx + 2, 90 - dy - 4, 'N', { k: 's' })
      );
    };
    let g = `<ellipse cx="160" cy="90" rx="120" ry="44" fill="none" stroke="${col('t3')}" stroke-dasharray="3 5"/>`;
    g += dot(160, 90, 'sun', 16);
    g += earth(40, true) + earth(280, false);
    g += txt(8, 142, l('Juni', 'June'), { k: 'h' }) + txt(8, 157, l('Norden zur Sonne geneigt:', 'North tilted towards the sun:'), { k: 's' });
    g += txt(8, 170, l('Sommer im Norden', 'summer in the north'), { c: 'warm', k: 'b' });
    g += txt(312, 142, l('Dezember', 'December'), { a: 'end', k: 'h' }) + txt(312, 157, l('Norden abgewandt:', 'North tilted away:'), { a: 'end', k: 's' });
    g += txt(312, 170, l('Winter im Norden', 'winter in the north'), { a: 'end', c: 'cold', k: 'b' });
    g += txt(160, 28, l('Die Achse zeigt immer in dieselbe Richtung', 'The axis always points the same way'), { a: 'middle', k: 's' });
    return svg(
      320,
      178,
      g,
      l(
        'Die Erde kreist um die Sonne, ihre Achse ist immer gleich geneigt. Im Juni ist der Norden zur Sonne geneigt, dort ist Sommer. Im Dezember ist er abgewandt, dort ist Winter.',
        'The Earth circles the sun with its axis always tilted the same way. In June the north leans towards the sun and has summer. In December it leans away and has winter.',
      ),
    );
  },
};

export const FIGURE_IDS = Object.keys(FIGURES);

let instance = 0;

/** The figure as an SVG string in the given language, or '' for an unknown id. */
export function figureSvg(id: string, lang: Lang): string {
  const make = FIGURES[id];
  if (!make) return '';
  const n = ++instance;
  return make({ l: (de, en) => (lang === 'de' ? de : en), u: (name) => `fig${n}-${name}` });
}

/** Figure ids placed in a text (body, example or deep). */
export function figuresIn(text: string | undefined): string[] {
  return (text ?? '')
    .split(/\n{2,}/)
    .map((p) => FIGURE_LINE.exec(p.trim())?.[1])
    .filter((id): id is string => !!id);
}
