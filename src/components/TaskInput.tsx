import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { analyzeTask, TaskAnalysis } from '../services/aiService';
import { scheduleTask } from '../services/scheduler';
import { useCalendar } from '../contexts/CalendarContext';
import { useTasks, TaskItem } from '../contexts/TaskContext';
import { formatTime, formatDate } from '../utils/timezone';

export default function TaskInput() {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const { events, addEvent, refreshEvents } = useCalendar();
  const { tasks, addTask, updateTask } = useTasks();

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text || busy) return;

    const taskId = Date.now().toString();
    const task: TaskItem = {
      id: taskId,
      input: text,
      analysis: null,
      status: 'analyzing',
    };

    addTask(task);
    setInput('');
    setBusy(true);

    try {
      // Step 1: AI analysis
      const analysis = await analyzeTask(text);
      updateTask(taskId, { analysis, status: 'analyzed' });

      // Step 2: Find slot
      updateTask(taskId, { status: 'scheduling' });
      const result = scheduleTask(analysis, events);

      if (!result.slotFound) {
        updateTask(taskId, {
          status: 'error',
          error: '空き時間が見つかりませんでした。手動でスケジュールしてください。',
        });
        setBusy(false);
        return;
      }

      // Step 3: Create calendar event
      const calEvent = await addEvent(analysis.title, result.start, result.end);
      updateTask(taskId, {
        status: 'scheduled',
        calendarEventId: calEvent.id,
        scheduledStart: result.start,
        scheduledEnd: result.end,
      });

      // Refresh events
      await refreshEvents();
    } catch (e: any) {
      updateTask(taskId, {
        status: 'error',
        error: e.message || 'エラーが発生しました',
      });
    } finally {
      setBusy(false);
    }
  };

  // Get unscheduled (pending/error) tasks
  const unscheduledTasks = tasks.filter(t => t.status === 'error');

  return (
    <View style={styles.container}>
      {/* Unplaced tasks notification */}
      {unscheduledTasks.length > 0 && (
        <View style={styles.unplacedBanner}>
          <Text style={styles.unplacedText}>
            未配置のタスクが{unscheduledTasks.length}件あります
          </Text>
        </View>
      )}

      {/* Recent task status */}
      {tasks.slice(-3).reverse().map(task => (
        <View key={task.id} style={styles.taskStatus}>
          {task.status === 'analyzing' && (
            <View style={styles.taskStatusRow}>
              <ActivityIndicator size="small" color="#FF9800" />
              <Text style={styles.taskStatusText}>「{task.input}」を分析中...</Text>
            </View>
          )}
          {task.status === 'scheduling' && (
            <View style={styles.taskStatusRow}>
              <ActivityIndicator size="small" color="#2196F3" />
              <Text style={styles.taskStatusText}>空き時間を検索中...</Text>
            </View>
          )}
          {task.status === 'scheduled' && task.scheduledStart && (
            <View style={styles.taskStatusRowSuccess}>
              <Text style={styles.taskStatusTextSuccess}>
                ✓ 「{task.analysis?.title}」→ {formatDate(task.scheduledStart)} {formatTime(task.scheduledStart)}〜
              </Text>
            </View>
          )}
          {task.status === 'error' && (
            <View style={styles.taskStatusRowError}>
              <Text style={styles.taskStatusTextError}>
                ✗ 「{task.input}」: {task.error}
              </Text>
            </View>
          )}
        </View>
      ))}

      {/* Input area */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="タスクを入力... 例: 9時からトレーニング"
          placeholderTextColor="#999"
          onSubmitEditing={handleSubmit}
          editable={!busy}
        />
        <TouchableOpacity
          style={[styles.submitBtn, busy && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={busy || !input.trim()}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>追加</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingBottom: 20,
  },
  unplacedBanner: {
    backgroundColor: '#FFF3E0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0B2',
  },
  unplacedText: {
    color: '#E65100',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  taskStatus: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  taskStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskStatusText: {
    color: '#666',
    fontSize: 13,
  },
  taskStatusRowSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskStatusTextSuccess: {
    color: '#2E7D32',
    fontSize: 13,
  },
  taskStatusRowError: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskStatusTextError: {
    color: '#C62828',
    fontSize: 13,
  },
  inputRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#FAFAFA',
  },
  submitBtn: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#B0BEC5',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
