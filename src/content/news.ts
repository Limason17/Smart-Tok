/**
 * News cards ("Aktuelles"), written twice a day by the routine (docs/routine.md).
 * Live news sits in content/cards/aktuelles.json and fades out of the feed within 7 days.
 * Expired news moves to public/news-archive/YYYY-MM.json, so saved news cards stay readable
 * in the profile without making the app bundle grow forever.
 */
/** Area of the news cards. */
export const NEWS_AREA = 'aktuelles';
/** News cards leave the feed after at most this many days. */
export const NEWS_MAX_DAYS = 7;
/** News ids start with the publishing date, so archived cards can be found by month. */
export const NEWS_ID = /^news-(\d{4}-\d{2})-\d{2}-[a-z0-9]+(-[a-z0-9]+)*$/;

/** Month of an archived news card ("2026-11"), or null for any other id. */
export function newsMonth(id: string): string | null {
  return NEWS_ID.exec(id)?.[1] ?? null;
}
