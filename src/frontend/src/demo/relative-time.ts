const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * How long ago a timestamp was, in the fewest words: "just now", "2 min
 * ago", "3 h ago", "5 d ago". After 30 days it is the date, written as it is
 * across the family: "21 Nov 2026". The exact time is kept beside it for
 * hover and focus.
 */
export function relativeTime(iso: string, now: number): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;

  const elapsed = Math.max(0, now - then);
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h ago`;
  if (elapsed < 30 * DAY) return `${Math.floor(elapsed / DAY)} d ago`;

  const date = new Date(then);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
