import { CalendarEvent } from '../utils/dateUtils';
import { FreeSlot, findFreeSlots } from './googleCalendar';
import { TaskAnalysis } from './aiService';
import { nowJST, addDays, TIMEZONE } from '../utils/timezone';

export interface ScheduleResult {
  start: Date;
  end: Date;
  slotFound: boolean;
}

/**
 * Find the best time slot for a task based on AI analysis and calendar availability.
 */
export function scheduleTask(
  analysis: TaskAnalysis,
  existingEvents: CalendarEvent[],
  workStartHour: number = 8,
  workEndHour: number = 22
): ScheduleResult {
  const now = nowJST();

  // If a preferred start time is specified (e.g., "9時から〜", "明日の4時半から〜")
  if (analysis.preferredStartTime) {
    const preferred = new Date(analysis.preferredStartTime);
    const end = new Date(preferred.getTime() + analysis.durationMinutes * 60000);

    // Check if the preferred slot is free
    const conflicts = existingEvents.filter(
      e => !e.isAllDay && e.start < end && e.end > preferred
    );

    if (conflicts.length === 0) {
      return { start: preferred, end, slotFound: true };
    }

    // Even with conflicts, try to find the nearest free slot on the same day
    // starting from the preferred time (not from workStartHour)
    const prefDateStr = preferred.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
    const prefDayEnd = new Date(`${prefDateStr}T${String(workEndHour).padStart(2, '0')}:00:00+09:00`);
    const nearbySlots = findFreeSlots(existingEvents, preferred, prefDayEnd, analysis.durationMinutes);
    if (nearbySlots.length > 0) {
      const slot = nearbySlots[0];
      return {
        start: slot.start,
        end: new Date(slot.start.getTime() + analysis.durationMinutes * 60000),
        slotFound: true,
      };
    }
  }

  // Search for free slots in the next 7 days
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const day = addDays(now, dayOffset);
    const dateStr = day.toLocaleDateString('en-CA', { timeZone: TIMEZONE });

    let dayStart = new Date(`${dateStr}T${String(workStartHour).padStart(2, '0')}:00:00+09:00`);
    const dayEnd = new Date(`${dateStr}T${String(workEndHour).padStart(2, '0')}:00:00+09:00`);

    // For today, don't schedule before now
    if (dayOffset === 0 && dayStart < now) {
      // Round up to next 15-minute interval
      const ms = now.getTime();
      const rounded = new Date(Math.ceil(ms / (15 * 60000)) * (15 * 60000));
      dayStart = rounded > dayStart ? rounded : dayStart;
    }

    if (dayStart >= dayEnd) continue;

    const slots = findFreeSlots(existingEvents, dayStart, dayEnd, analysis.durationMinutes);

    // If deadline exists, prefer slots before the deadline
    if (analysis.deadline) {
      const deadline = new Date(analysis.deadline);
      const beforeDeadline = slots.filter(s => {
        const end = new Date(s.start.getTime() + analysis.durationMinutes * 60000);
        return end <= deadline;
      });

      if (beforeDeadline.length > 0) {
        const slot = beforeDeadline[0];
        return {
          start: slot.start,
          end: new Date(slot.start.getTime() + analysis.durationMinutes * 60000),
          slotFound: true,
        };
      }
    }

    // Use first available slot
    if (slots.length > 0) {
      const slot = slots[0];
      return {
        start: slot.start,
        end: new Date(slot.start.getTime() + analysis.durationMinutes * 60000),
        slotFound: true,
      };
    }
  }

  // No slot found - return a default
  return {
    start: now,
    end: new Date(now.getTime() + analysis.durationMinutes * 60000),
    slotFound: false,
  };
}
