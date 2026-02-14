// Asia/Tokyo timezone utilities
const TIMEZONE = 'Asia/Tokyo';

export function nowJST(): Date {
  return new Date();
}

export function toJSTString(date: Date): string {
  return date.toLocaleString('ja-JP', { timeZone: TIMEZONE });
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('ja-JP', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('ja-JP', {
    timeZone: TIMEZONE,
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });
}

export function formatDateFull(date: Date): string {
  return date.toLocaleDateString('ja-JP', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });
}

export function isSameDay(a: Date, b: Date): boolean {
  const opts: Intl.DateTimeFormatOptions = { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' };
  return a.toLocaleDateString('ja-JP', opts) === b.toLocaleDateString('ja-JP', opts);
}

export function startOfDayJST(date: Date): Date {
  const s = date.toLocaleDateString('en-CA', { timeZone: TIMEZONE }); // YYYY-MM-DD
  return new Date(s + 'T00:00:00+09:00');
}

export function endOfDayJST(date: Date): Date {
  const s = date.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
  return new Date(s + 'T23:59:59+09:00');
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function toISOStringJST(date: Date): string {
  return date.toISOString();
}

export function getDateKeyJST(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: TIMEZONE }); // YYYY-MM-DD
}

export { TIMEZONE };
