import React, { createContext, useContext, useState, useCallback } from 'react';
import { CalendarEvent } from '../utils/dateUtils';
import { fetchEvents, createEvent, deleteEvent, updateEvent } from '../services/googleCalendar';

interface CalendarContextType {
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
  refreshEvents: () => Promise<void>;
  addEvent: (summary: string, start: Date, end: Date, description?: string) => Promise<CalendarEvent>;
  editEvent: (eventId: string, summary: string, start: Date, end: Date, description?: string) => Promise<CalendarEvent>;
  removeEvent: (eventId: string) => Promise<void>;
}

const CalendarContext = createContext<CalendarContextType>({
  events: [],
  loading: false,
  error: null,
  refreshEvents: async () => {},
  addEvent: async () => { throw new Error('Not initialized'); },
  editEvent: async () => { throw new Error('Not initialized'); },
  removeEvent: async () => {},
});

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetched = await fetchEvents(7);
      setEvents(fetched);
    } catch (e: any) {
      setError(e.message || 'イベントの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  const addEvent = useCallback(async (summary: string, start: Date, end: Date, description?: string) => {
    const newEvent = await createEvent(summary, start, end, description);
    setEvents(prev => [...prev, newEvent].sort((a, b) => a.start.getTime() - b.start.getTime()));
    return newEvent;
  }, []);

  const editEvent = useCallback(async (eventId: string, summary: string, start: Date, end: Date, description?: string) => {
    const updated = await updateEvent(eventId, summary, start, end, description);
    setEvents(prev =>
      prev.map(e => e.id === eventId ? updated : e).sort((a, b) => a.start.getTime() - b.start.getTime())
    );
    return updated;
  }, []);

  const removeEvent = useCallback(async (eventId: string) => {
    await deleteEvent(eventId);
    setEvents(prev => prev.filter(e => e.id !== eventId));
  }, []);

  return (
    <CalendarContext.Provider value={{ events, loading, error, refreshEvents, addEvent, editEvent, removeEvent }}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  return useContext(CalendarContext);
}
