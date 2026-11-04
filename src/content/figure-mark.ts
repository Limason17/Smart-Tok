// Figures: small drawings that explain how something works, placed inside a card's text.
// Each one is a hand-written SVG in content/figures/<name>.svg (a few KB, no image files, no cost).
// Colours come from CSS classes (fg-*), so a figure follows dark and light mode and the topic colour.
// Labels are German in the SVG; the English version sits in a data-en attribute on the same element.
// In a card text, a paragraph `[[fig:name]]` places the figure there; `[[fig:name|full]]` gives it a page of
// its own; any other `|text` part is the caption. scripts/validate-content.ts checks every figure.
import type { Lang } from './taxonomy';
// This file has no Vite-only code, so the build scripts can use it too.

export const FIGURE_MARK = /^\[\[fig:([a-z0-9]+(?:-[a-z0-9]+)*)((?:\|[^|\]]+)*)\]\]$/;

export interface FigureRef {
  name: string;
  full: boolean;
  caption?: string;
}

export function parseFigure(paragraph: string): FigureRef | null {
  const m = FIGURE_MARK.exec(paragraph.trim());
  if (!m) return null;
  const parts = m[2].split('|').map((s) => s.trim()).filter(Boolean);
  return { name: m[1], full: parts.includes('full'), caption: parts.filter((p) => p !== 'full').join(' ') || undefined };
}

/** The SVG with its labels in the given language (English from data-en where present). */
export function localiseSvg(svg: string, lang: Lang): string {
  const clean = svg.replace(/<\?xml[^>]*>\s*/, '');
  if (lang !== 'en') return clean;
  return clean.replace(/<(text|tspan)([^>]*?)\sdata-en="([^"]*)"([^>]*)>[^<]*<\/\1>/g, '<$1$2$4>$3</$1>');
}
