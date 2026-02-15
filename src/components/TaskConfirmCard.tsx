import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { TaskAnalysis } from '../services/aiService';
import { scheduleTask, ScheduleResult } from '../services/scheduler';
import { CalendarEvent } from '../utils/dateUtils';
import { formatTime, formatDate } from '../utils/timezone';

const CATEGORY_COLORS: Record<string, string> = {
  '仕事': '#2196F3',
  '勉強': '#9C27B0',
  '運動': '#4CAF50',
  '家事': '#FF9800',
  '買い物': '#E91E63',
  'その他': '#9E9E9E',
};

const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  high: { color: '#F44336', label: '高' },
  medium: { color: '#FF9800', label: '中' },
  low: { color: '#4CAF50', label: '低' },
};

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

interface Props {
  analysis: TaskAnalysis;
  events: CalendarEvent[];
  onConfirm: (editedAnalysis: TaskAnalysis, scheduleResult: ScheduleResult) => void;
  onCancel: () => void;
}

export default function TaskConfirmCard({ analysis, events, onConfirm, onCancel }: Props) {
  const [title, setTitle] = useState(analysis.title);
  const [duration, setDuration] = useState(analysis.durationMinutes);

  const editedAnalysis: TaskAnalysis = useMemo(() => ({
    ...analysis,
    title,
    durationMinutes: duration,
  }), [analysis, title, duration]);

  const preview: ScheduleResult = useMemo(() => {
    return scheduleTask(editedAnalysis, events);
  }, [editedAnalysis, events]);

  const categoryColor = CATEGORY_COLORS[analysis.category] || CATEGORY_COLORS['その他'];
  const priorityConfig = PRIORITY_CONFIG[analysis.priority] || PRIORITY_CONFIG.medium;
  const canConfirm = preview.slotFound && title.trim().length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>内容を確認</Text>
        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: categoryColor }]}>
            <Text style={styles.badgeText}>{analysis.category}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: priorityConfig.color }]}>
            <Text style={styles.badgeText}>優先度: {priorityConfig.label}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.label}>タイトル</Text>
      <TextInput
        style={styles.titleInput}
        value={title}
        onChangeText={setTitle}
        selectTextOnFocus
      />

      <Text style={styles.label}>所要時間</Text>
      <View style={styles.durationRow}>
        {DURATION_PRESETS.map(d => (
          <TouchableOpacity
            key={d}
            style={[styles.durationBtn, duration === d && styles.durationBtnActive]}
            onPress={() => setDuration(d)}
          >
            <Text style={[styles.durationBtnText, duration === d && styles.durationBtnTextActive]}>
              {d}分
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>配置先</Text>
      {preview.slotFound ? (
        <View style={styles.previewCard}>
          <Text style={styles.previewDate}>{formatDate(preview.start)}</Text>
          <Text style={styles.previewTime}>
            {formatTime(preview.start)} 〜 {formatTime(preview.end)}
          </Text>
        </View>
      ) : (
        <View style={styles.previewCardError}>
          <Text style={styles.previewErrorText}>空き時間が見つかりません</Text>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>キャンセル</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
          onPress={() => onConfirm(editedAnalysis, preview)}
          disabled={!canConfirm}
        >
          <Text style={styles.confirmBtnText}>スケジュールに追加</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  header: {
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
    marginTop: 12,
  },
  titleInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FAFAFA',
  },
  durationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  durationBtn: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#FAFAFA',
  },
  durationBtnActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  durationBtnText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
  },
  durationBtnTextActive: {
    color: '#fff',
  },
  previewCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
  previewTime: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E7D32',
  },
  previewCardError: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 12,
  },
  previewErrorText: {
    color: '#E65100',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
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
  confirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
  },
  confirmBtnDisabled: {
    backgroundColor: '#C8E6C9',
  },
  confirmBtnText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
});
