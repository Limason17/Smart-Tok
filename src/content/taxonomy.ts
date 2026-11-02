// Areas (Bereiche) and their subtopics. Ids are stable: they key the user's
// history and algorithm scores, so never rename an id once cards use it.

export type Lang = 'de' | 'en';
export type Label = Record<Lang, string>;

export interface Subtopic {
  id: string;
  label: Label;
}

export interface Area {
  id: string;
  label: Label;
  /** Base hue for the area, tuned for dark backgrounds. */
  color: string;
  icon: string;
  subtopics: Subtopic[];
}

const s = (id: string, de: string, en: string): Subtopic => ({ id, label: { de, en } });

export const AREAS: Area[] = [
  {
    id: 'mindset',
    label: { de: 'Mindset & Persönlichkeit', en: 'Mindset & Character' },
    color: '#8f9df5',
    icon: 'mindset',
    subtopics: [
      s('selbstvertrauen', 'Selbstvertrauen', 'Confidence'),
      s('mentalitaet', 'Starke Mentalität', 'Mental strength'),
      s('disziplin', 'Disziplin', 'Discipline'),
      s('aura', 'Aura & Ausstrahlung', 'Presence & aura'),
      s('lernen', 'Smarter werden', 'Getting smarter'),
      s('gewohnheiten', 'Gewohnheiten', 'Habits'),
      s('fokus', 'Fokus', 'Focus'),
      s('stoizismus', 'Stoizismus', 'Stoicism'),
      s('rueckschlaege', 'Umgang mit Rückschlägen', 'Handling setbacks'),
      s('verantwortung', 'Männlichkeit & Verantwortung', 'Manhood & responsibility'),
    ],
  },
  {
    id: 'rede',
    label: { de: 'Reden & Wirkung', en: 'Speaking & Presence' },
    color: '#5cc4b5',
    icon: 'speech',
    subtopics: [
      s('rhetorik', 'Rhetorik', 'Rhetoric'),
      s('sprache', 'Sprache & Wortschatz', 'Language & vocabulary'),
      s('wirkung', 'Smarter wirken', 'Coming across sharp'),
      s('koerpersprache', 'Blickkontakt & Körpersprache', 'Eye contact & body language'),
      s('stimme', 'Stimme', 'Voice'),
      s('storytelling', 'Storytelling', 'Storytelling'),
      s('schlagfertigkeit', 'Schlagfertigkeit', 'Quick wit'),
    ],
  },
  {
    id: 'menschen',
    label: { de: 'Menschen', en: 'People' },
    color: '#ee8b7f',
    icon: 'people',
    subtopics: [
      s('umgang', 'Mit Menschen umgehen', 'Dealing with people'),
      s('lesen', 'Menschen lesen', 'Reading people'),
      s('beziehungen', 'Frauen & Beziehungen', 'Women & relationships'),
      s('versuchung', 'Lust & Versuchung', 'Desire & temptation'),
      s('freundschaft', 'Freundschaft', 'Friendship'),
      s('fuehrung', 'Führung', 'Leadership'),
      s('verhandeln', 'Verhandeln', 'Negotiation'),
      s('konflikte', 'Konflikte lösen', 'Resolving conflict'),
      s('psychologie', 'Psychologie', 'Psychology'),
    ],
  },
  {
    id: 'geld',
    label: { de: 'Geld & Business', en: 'Money & Business' },
    color: '#7cc690',
    icon: 'money',
    subtopics: [
      s('finanzen', 'Persönliche Finanzen', 'Personal finance'),
      s('sparen', 'Sparen & Budget', 'Saving & budgeting'),
      s('investment', 'Investment', 'Investing'),
      s('vermoegen', 'Erfolg & Vermögen', 'Success & wealth'),
      s('business', 'Business', 'Business'),
      s('sales', 'Sales', 'Sales'),
      s('unternehmertum', 'Unternehmertum', 'Entrepreneurship'),
      s('marketing', 'Marketing', 'Marketing'),
    ],
  },
  {
    id: 'glaube',
    label: { de: 'Glaube', en: 'Faith' },
    color: '#c29fe0',
    icon: 'faith',
    subtopics: [
      s('mann-gottes', 'Mann Gottes', 'Man of God'),
      s('nt', 'Neues Testament', 'New Testament'),
      s('personen', 'Biblische Personen', 'People of the Bible'),
      s('gebet', 'Gebet', 'Prayer'),
      s('gleichnisse', 'Gleichnisse', 'Parables'),
      s('werte', 'Christliche Werte im Alltag', 'Christian values in daily life'),
    ],
  },
  {
    id: 'wissen',
    label: { de: 'Wissen', en: 'Knowledge' },
    color: '#6fb2e6',
    icon: 'knowledge',
    subtopics: [
      s('allgemein', 'Allgemeinwissen', 'General knowledge'),
      s('politik', 'Politik', 'Politics'),
      s('informatik', 'Informatik', 'Computer science'),
      s('wirtschaft', 'Wirtschaft', 'Economics'),
      s('wissenschaft', 'Wissenschaft', 'Science'),
      s('ki', 'KI & Technologie', 'AI & technology'),
      s('geografie', 'Geografie', 'Geography'),
      s('philosophie', 'Philosophie', 'Philosophy'),
    ],
  },
  {
    id: 'geschichte',
    label: { de: 'Geschichte', en: 'History' },
    color: '#d69c6c',
    icon: 'history',
    subtopics: [
      s('ereignisse', 'Wichtige Ereignisse', 'Key events'),
      s('krisen', 'Krisen & Crashes', 'Crises & crashes'),
      s('persoenlichkeiten', 'Persönlichkeiten', 'Great figures'),
      s('imperien', 'Imperien & Kriege', 'Empires & wars'),
      s('erfindungen', 'Erfindungen', 'Inventions'),
    ],
  },
  {
    id: 'zitate',
    label: { de: 'Zitate', en: 'Quotes' },
    color: '#e4a8bf',
    icon: 'quote',
    subtopics: [
      s('stoiker', 'Stoiker', 'Stoics'),
      s('denker', 'Denker & Philosophen', 'Thinkers'),
      s('macher', 'Macher & Unternehmer', 'Builders & founders'),
      s('strategen', 'Strategen & Anführer', 'Strategists & leaders'),
      s('glaube', 'Heilige & Glaube', 'Saints & faith'),
    ],
  },
  {
    id: 'koerper',
    label: { de: 'Körper & Gesundheit', en: 'Body & Health' },
    color: '#ef8c5c',
    icon: 'body',
    subtopics: [
      s('hormone', 'Hormone', 'Hormones'),
      s('training', 'Training & Muskelaufbau', 'Training & muscle'),
      s('ausdauer', 'Ausdauer', 'Endurance'),
      s('ernaehrung', 'Ernährung & Nährwerte', 'Nutrition'),
      s('vitamine', 'Vitamine & Mineralstoffe', 'Vitamins & minerals'),
      s('schlaf', 'Schlaf & Erholung', 'Sleep & recovery'),
      s('stress', 'Stress', 'Stress'),
    ],
  },
  {
    id: 'aktuelles',
    label: { de: 'Aktuelles', en: 'Current events' },
    color: '#9db3c8',
    icon: 'news',
    subtopics: [
      s('welt', 'Weltgeschehen', 'World'),
      s('wirtschaft', 'Wirtschaft & Märkte', 'Economy & markets'),
      s('tech', 'Tech & Wissenschaft', 'Tech & science'),
      s('termine', 'Was bevorsteht', 'Coming up'),
    ],
  },
];

export const AREA_BY_ID: Record<string, Area> = Object.fromEntries(AREAS.map((a) => [a.id, a]));

export function subtopicLabel(areaId: string, subId: string, lang: Lang): string {
  const sub = AREA_BY_ID[areaId]?.subtopics.find((x) => x.id === subId);
  return sub ? sub.label[lang] : subId;
}

export const STYLES = ['fakt', 'tipp', 'zitat', 'geschichte', 'bibelvers', 'erklaerung'] as const;
export type Style = (typeof STYLES)[number];

export const STYLE_LABELS: Record<Style, Label> = {
  fakt: { de: 'Fakt', en: 'Fact' },
  tipp: { de: 'Tipp', en: 'Tip' },
  zitat: { de: 'Zitat', en: 'Quote' },
  geschichte: { de: 'Geschichte', en: 'Story' },
  bibelvers: { de: 'Bibelvers', en: 'Bible verse' },
  erklaerung: { de: 'Erklärung', en: 'Explainer' },
};
