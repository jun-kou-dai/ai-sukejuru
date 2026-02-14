import { TIMEZONE, isSameDay, nowJST } from './timezone';

export interface CalendarEvent {
  id: string;
  summary: string;
  start: Date;
  end: Date;
  isAllDay?: boolean;
  isAIScheduled?: boolean;
}

export type EventStatus = 'past' | 'current' | 'future';

export function getEventStatus(event: CalendarEvent): EventStatus {
  const now = nowJST();
  if (event.end <= now) return 'past';
  if (event.start <= now && event.end > now) return 'current';
  return 'future';
}

export function groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = event.start.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
    const list = groups.get(key) ?? [];
    list.push(event);
    groups.set(key, list);
  }
  // Sort each group by start time
  for (const [key, list] of groups) {
    groups.set(key, list.sort((a, b) => a.start.getTime() - b.start.getTime()));
  }
  return groups;
}

export function getSummaryText(events: CalendarEvent[]): string {
  const now = nowJST();
  const finished = events.filter(e => e.end <= now).length;
  const remaining = events.length - finished;
  return `${finished}件終了 ・ 残り${remaining}件`;
}

export function formatSectionDate(dateKey: string): string {
  // dateKey is YYYY-MM-DD
  const d = new Date(dateKey + 'T00:00:00+09:00');
  return d.toLocaleDateString('ja-JP', {
    timeZone: TIMEZONE,
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });
}
