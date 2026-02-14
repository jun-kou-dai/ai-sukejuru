// Asia/Tokyo (JST, UTC+9) timezone utilities
// 重要: このアプリはブラウザで実行される。
// Date オブジェクトは内部的にUTCで保持されるため、
// 表示時は必ず timeZone: 'Asia/Tokyo' を指定し、
// 日付文字列から Date を構築する際は必ず +09:00 を付ける。

const TIMEZONE = 'Asia/Tokyo';

/**
 * 現在時刻を返す。
 * Date は内部的にUTC。表示時は formatTime/formatDate を使うこと。
 */
export function nowJST(): Date {
  return new Date();
}

/**
 * JST での時刻表示 (例: "14:30")
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('ja-JP', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * JST での日付表示 (例: "2/14(金)")
 * 「今日」「明日」ラベルは付けない。日付のみ。
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('ja-JP', {
    timeZone: TIMEZONE,
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });
}

/**
 * JST での日付表示（年付き） (例: "2026/2/14(金)")
 */
export function formatDateFull(date: Date): string {
  return date.toLocaleDateString('ja-JP', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });
}

/**
 * JST で同じ日かどうか判定
 */
export function isSameDay(a: Date, b: Date): boolean {
  return getDateKeyJST(a) === getDateKeyJST(b);
}

/**
 * JST での日付キー (例: "2026-02-14")
 * グルーピングや比較に使用。
 */
export function getDateKeyJST(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: TIMEZONE }); // YYYY-MM-DD
}

/**
 * JST でその日の 00:00:00 を返す
 */
export function startOfDayJST(date: Date): Date {
  const dateKey = getDateKeyJST(date);
  return new Date(dateKey + 'T00:00:00+09:00');
}

/**
 * JST でその日の 23:59:59.999 を返す
 */
export function endOfDayJST(date: Date): Date {
  const dateKey = getDateKeyJST(date);
  return new Date(dateKey + 'T23:59:59.999+09:00');
}

/**
 * JST基準で日数を加算する。
 * UTC の setDate() ではなく、JST の日付文字列を経由して正確に計算。
 */
export function addDays(date: Date, days: number): Date {
  const dateKey = getDateKeyJST(date);
  const [year, month, day] = dateKey.split('-').map(Number);
  const base = new Date(Date.UTC(year, month - 1, day + days));
  // JST の同じ日の 00:00:00 を返す
  const newKey = base.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  return new Date(newKey + 'T00:00:00+09:00');
}

/**
 * JST の ISO 8601 文字列を返す (例: "2026-02-14T14:30:00+09:00")
 * Google Calendar API に送る時に使用。
 */
export function toISOStringJST(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  // JST の各パーツを取得
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}+09:00`;
}

export { TIMEZONE };
