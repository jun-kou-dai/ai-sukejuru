import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CalendarEvent, getEventStatus, EventStatus } from '../utils/dateUtils';
import { formatTime } from '../utils/timezone';

interface Props {
  event: CalendarEvent;
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (eventId: string) => void;
}

export default function EventCard({ event, onEdit, onDelete }: Props) {
  const status = getEventStatus(event);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onEdit?.(event)}
      disabled={!onEdit}
    >
      <View style={[styles.card, statusStyles[status]]}>
        <View style={styles.timeColumn}>
          {event.isAllDay ? (
            <Text style={[styles.timeText, status === 'past' && styles.pastText]}>終日</Text>
          ) : (
            <>
              <Text style={[styles.timeText, status === 'past' && styles.pastText]}>
                {formatTime(event.start)}
              </Text>
              <Text style={[styles.timeSeparator, status === 'past' && styles.pastText]}>↓</Text>
              <Text style={[styles.timeText, status === 'past' && styles.pastText]}>
                {formatTime(event.end)}
              </Text>
            </>
          )}
        </View>
        <View style={styles.contentColumn}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, status === 'past' && styles.pastText]} numberOfLines={2}>
              {event.summary}
            </Text>
            {status === 'past' && (
              <View style={styles.badgePast}>
                <Text style={styles.badgeText}>済</Text>
              </View>
            )}
            {status === 'current' && (
              <View style={styles.badgeCurrent}>
                <Text style={styles.badgeTextCurrent}>進行中</Text>
              </View>
            )}
          </View>
          {event.isAIScheduled && (
            <Text style={styles.aiLabel}>AI配置</Text>
          )}
        </View>
        <View style={styles.actions}>
          {onEdit && (
            <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(event)}>
              <Text style={styles.editBtnText}>✎</Text>
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(event.id)}>
              <Text style={styles.deleteBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const statusStyles: Record<EventStatus, any> = {
  past: {
    opacity: 0.5,
    borderLeftColor: '#ccc',
  },
  current: {
    borderLeftColor: '#2196F3',
    borderLeftWidth: 4,
    backgroundColor: '#E3F2FD',
  },
  future: {
    borderLeftColor: '#4CAF50',
  },
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginVertical: 4,
    marginHorizontal: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  timeColumn: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  timeSeparator: {
    fontSize: 10,
    color: '#999',
  },
  pastText: {
    color: '#999',
  },
  contentColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  badgePast: {
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    color: '#777',
    fontWeight: '600',
  },
  badgeCurrent: {
    backgroundColor: '#2196F3',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeTextCurrent: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  aiLabel: {
    fontSize: 11,
    color: '#FF9800',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editBtn: {
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  editBtnText: {
    fontSize: 16,
    color: '#2196F3',
  },
  deleteBtn: {
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  deleteBtnText: {
    fontSize: 16,
    color: '#F44336',
  },
});
