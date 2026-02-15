import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Modal, TextInput, TouchableOpacity } from 'react-native';
import { useCalendar } from '../contexts/CalendarContext';
import { CalendarEvent, groupEventsByDate, getSummaryText, formatSectionDate, getEventStatus } from '../utils/dateUtils';
import { nowJST, getDateKeyJST, formatTime, TIMEZONE } from '../utils/timezone';
import EventCard from './EventCard';
import CurrentTimeLine from './CurrentTimeLine';

function formatDateTimeLocal(date: Date): string {
  const d = new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE }));
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseDateTimeLocal(str: string): Date {
  return new Date(str + ':00+09:00');
}

export default function CalendarView() {
  const { events, loading, error, refreshEvents, removeEvent, editEvent } = useCalendar();
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editSummary, setEditSummary] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    refreshEvents();
  }, [refreshEvents]);

  const grouped = groupEventsByDate(events);
  const todayKey = getDateKeyJST(nowJST());
  const sortedKeys = Array.from(grouped.keys()).sort();

  const todayEvents = grouped.get(todayKey) ?? [];
  const summaryText = todayEvents.length > 0 ? getSummaryText(todayEvents) : null;

  const handleDelete = async (eventId: string) => {
    if (!confirm('このイベントを削除しますか？')) return;
    try {
      await removeEvent(eventId);
    } catch (e: any) {
      alert('削除に失敗しました: ' + e.message);
    }
  };

  const handleEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    setEditSummary(event.summary);
    setEditStart(formatDateTimeLocal(event.start));
    setEditEnd(formatDateTimeLocal(event.end));
  };

  const handleSaveEdit = async () => {
    if (!editingEvent) return;
    setSaving(true);
    try {
      await editEvent(
        editingEvent.id,
        editSummary,
        parseDateTimeLocal(editStart),
        parseDateTimeLocal(editEnd)
      );
      setEditingEvent(null);
    } catch (e: any) {
      alert('更新に失敗しました: ' + e.message);
    } finally {
      setSaving(false);
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
    <>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refreshEvents} />
        }
      >
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

            const now = nowJST();
            let timeLineInserted = false;

            return (
              <View key={dateKey} style={styles.dateSection}>
                <View style={styles.dateHeader}>
                  <Text style={styles.dateHeaderText}>{formatSectionDate(dateKey)}</Text>
                </View>

                {dayEvents.map((event, idx) => {
                  const elements: React.ReactNode[] = [];

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
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  );

                  return <React.Fragment key={event.id}>{elements}</React.Fragment>;
                })}

                {isToday && !timeLineInserted && <CurrentTimeLine />}
              </View>
            );
          })
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={!!editingEvent} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>イベントを編集</Text>

            <Text style={styles.inputLabel}>タイトル</Text>
            <TextInput
              style={styles.input}
              value={editSummary}
              onChangeText={setEditSummary}
            />

            <Text style={styles.inputLabel}>開始</Text>
            <TextInput
              style={styles.input}
              value={editStart}
              onChangeText={setEditStart}
              placeholder="2026-02-15T09:00"
            />

            <Text style={styles.inputLabel}>終了</Text>
            <TextInput
              style={styles.input}
              value={editEnd}
              onChangeText={setEditEnd}
              placeholder="2026-02-15T10:00"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditingEvent(null)}
              >
                <Text style={styles.cancelBtnText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.5 }]}
                onPress={handleSaveEdit}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>{saving ? '保存中...' : '保存'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    color: '#333',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 20,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
  },
  cancelBtnText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '600',
  },
  saveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#2196F3',
  },
  saveBtnText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
});
