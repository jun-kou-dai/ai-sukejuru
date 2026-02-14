import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useCalendar } from '../contexts/CalendarContext';
import { groupEventsByDate, getSummaryText, formatSectionDate, getEventStatus } from '../utils/dateUtils';
import { nowJST, getDateKeyJST } from '../utils/timezone';
import EventCard from './EventCard';
import CurrentTimeLine from './CurrentTimeLine';

export default function CalendarView() {
  const { events, loading, error, refreshEvents, removeEvent } = useCalendar();

  useEffect(() => {
    refreshEvents();
  }, [refreshEvents]);

  const grouped = groupEventsByDate(events);
  const todayKey = getDateKeyJST(nowJST());
  const sortedKeys = Array.from(grouped.keys()).sort();

  // Summary for today
  const todayEvents = grouped.get(todayKey) ?? [];
  const summaryText = todayEvents.length > 0 ? getSummaryText(todayEvents) : null;

  const handleDelete = async (eventId: string) => {
    try {
      await removeEvent(eventId);
    } catch (e: any) {
      alert('削除に失敗しました: ' + e.message);
    }
  };

  if (loading && events.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>カレンダーを読み込み中...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refreshEvents} />
      }
    >
      {/* Today's summary */}
      {summaryText && (
        <View style={styles.summaryBanner}>
          <Text style={styles.summaryText}>{summaryText}</Text>
        </View>
      )}

      {sortedKeys.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>予定がありません</Text>
        </View>
      ) : (
        sortedKeys.map(dateKey => {
          const dayEvents = grouped.get(dateKey)!;
          const isToday = dateKey === todayKey;

          // Find where to insert current time line
          const now = nowJST();
          let timeLineInserted = false;

          return (
            <View key={dateKey} style={styles.dateSection}>
              {/* Date header - date only, NO "今日"/"明日" labels */}
              <View style={styles.dateHeader}>
                <Text style={styles.dateHeaderText}>{formatSectionDate(dateKey)}</Text>
              </View>

              {dayEvents.map((event, idx) => {
                const elements: React.ReactNode[] = [];

                // Insert current time line at the right position (today only)
                if (isToday && !timeLineInserted) {
                  const status = getEventStatus(event);
                  if (status === 'current' || status === 'future') {
                    elements.push(<CurrentTimeLine key="timeLine" />);
                    timeLineInserted = true;
                  }
                }

                elements.push(
                  <EventCard
                    key={event.id}
                    event={event}
                    onDelete={event.isAIScheduled ? handleDelete : undefined}
                  />
                );

                return <React.Fragment key={event.id}>{elements}</React.Fragment>;
              })}

              {/* If all events are past and we haven't inserted the time line */}
              {isToday && !timeLineInserted && <CurrentTimeLine />}
            </View>
          );
        })
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    textAlign: 'center',
  },
  summaryBanner: {
    backgroundColor: '#E8F5E9',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  summaryText: {
    color: '#2E7D32',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 15,
  },
  dateSection: {
    marginTop: 12,
  },
  dateHeader: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  dateHeaderText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#555',
  },
});
