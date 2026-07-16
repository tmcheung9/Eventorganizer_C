/**
 * Parse a date-only string ("YYYY-MM-DD", as stored in Postgres `date`
 * columns) into a local-time Date object.
 *
 * `new Date("YYYY-MM-DD")` parses the string as UTC midnight, but callers
 * almost always then format or compare it using the browser's local
 * timezone — for any viewer west of UTC that silently rolls the date back
 * by one day. Building the Date from explicit year/month/day components
 * instead makes the JS Date constructor treat them as local time, so the
 * displayed/compared date always matches the stored calendar date.
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}
