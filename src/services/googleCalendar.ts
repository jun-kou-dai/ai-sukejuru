import { getAccessToken } from './googleAuth';
import { CalendarEvent } from '../utils/dateUtils';
import { TIMEZONE, addDays, startOfDayJST, endOfDayJST, nowJST } from '../utils/timezone';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

export async function fetchEvents(daysAhead: number = 7): Promise<CalendarEvent[]> {
  const now = nowJST();
  const timeMin = startOfDayJST(now).toISOString();
  const timeMax = endOfDayJST(addDays(now, daysAhead)).toISOString();

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    timeZone: TIMEZONE,
  });

  const res = await fetchWithAuth(`${CALENDAR_API}/calendars/primary/events?${params}`);
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Calendar API error: ${res.status} ${error}`);
  }

  const data = await res.json();
  return (data.items || []).map(parseEvent);
}

function parseEvent(item: any): CalendarEvent {
  const isAllDay = !!item.start?.date;
  let start: Date;
  let end: Date;

  if (isAllDay) {
    start = new Date(item.start.date + 'T00:00:00+09:00');
    end = new Date(item.end.date + 'T00:00:00+09:00');
  } else {
    start = new Date(item.start.dateTime);
    end = new Date(item.end.dateTime);
  }

  return {
    id: item.id,
    summary: item.summary || '(無題)',
    start,
    end,
    isAllDay,
    isAIScheduled: item.description?.includes('[AI-SCHEDULED]') ?? false,
  };
}

export async function createEvent(
  summary: string,
  startTime: Date,
  endTime: Date
): Promise<CalendarEvent> {
  const body = {
    summary,
    description: '[AI-SCHEDULED] このイベントはAIスケジューラーが自動作成しました。',
    start: {
      dateTime: startTime.toISOString(),
      timeZone: TIMEZONE,
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: TIMEZONE,
    },
  };

  const res = await fetchWithAuth(`${CALENDAR_API}/calendars/primary/events`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Create event failed: ${res.status} ${error}`);
  }

  return parseEvent(await res.json());
}

export async function deleteEvent(eventId: string): Promise<void> {
  const res = await fetchWithAuth(
    `${CALENDAR_API}/calendars/primary/events/${eventId}`,
    { method: 'DELETE' }
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(`Delete event failed: ${res.status}`);
  }
}

export interface FreeSlot {
  start: Date;
  end: Date;
  durationMinutes: number;
}

export function findFreeSlots(
  events: CalendarEvent[],
  dayStart: Date,
  dayEnd: Date,
  minMinutes: number = 30
): FreeSlot[] {
  // Filter non-all-day events for the day and sort
  const dayEvents = events
    .filter(e => !e.isAllDay && e.start < dayEnd && e.end > dayStart)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const slots: FreeSlot[] = [];
  let cursor = dayStart;

  for (const event of dayEvents) {
    if (event.start > cursor) {
      const duration = (event.start.getTime() - cursor.getTime()) / 60000;
      if (duration >= minMinutes) {
        slots.push({ start: new Date(cursor), end: new Date(event.start), durationMinutes: duration });
      }
    }
    if (event.end > cursor) {
      cursor = event.end;
    }
  }

  // After last event
  if (dayEnd > cursor) {
    const duration = (dayEnd.getTime() - cursor.getTime()) / 60000;
    if (duration >= minMinutes) {
      slots.push({ start: new Date(cursor), end: new Date(dayEnd), durationMinutes: duration });
    }
  }

  return slots;
}
