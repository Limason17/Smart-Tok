import Dexie, { type Table } from 'dexie';

/** Per-card history. Compact on purpose: this is what gets synced later. */
export interface CardRecord {
  id: string;
  firstSeen: number;
  lastSeen: number;
  views: number;
  /** Total dwell time in milliseconds. */
  dwellMs: number;
  reaction: -1 | 0 | 1;
  saved: boolean;
  savedAt?: number;
  /** Spaced review of saved cards: reviews done so far (0 to 4) and when the next one is due. */
  reviewStep?: number;
  reviewDue?: number;
  more: boolean;
  shared: boolean;
  /** Language the card was last read in. */
  lang: 'de' | 'en';
  updatedAt: number;
}

export interface DayRecord {
  /** Local date, YYYY-MM-DD. */
  date: string;
  count: number;
}

/** Outbox of interactions, kept for the export and for the account sync. */
export interface EventRecord {
  id: string;
  t: number;
  card: string;
  type: 'view' | 'like' | 'dislike' | 'save' | 'more' | 'share';
  value?: number;
}

export interface KvRecord {
  key: string;
  value: unknown;
}

class SmartTokDb extends Dexie {
  cards!: Table<CardRecord, string>;
  days!: Table<DayRecord, string>;
  events!: Table<EventRecord, string>;
  kv!: Table<KvRecord, string>;

  constructor() {
    super('smart-tok');
    this.version(1).stores({
      cards: 'id, lastSeen, saved',
      days: 'date',
      events: 'id, t',
      kv: 'key',
    });
  }
}

export const db = new SmartTokDb();
