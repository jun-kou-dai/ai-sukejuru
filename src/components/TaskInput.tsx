import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { analyzeTask, createFallbackAnalysis, TaskAnalysis } from '../services/aiService';
import { ScheduleResult } from '../services/scheduler';
import { useCalendar } from '../contexts/CalendarContext';
import { useTasks, TaskItem } from '../contexts/TaskContext';
import { formatTime, formatDate } from '../utils/timezone';
import TaskConfirmCard from './TaskConfirmCard';

const SpeechRecognition = typeof window !== 'undefined'
  ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  : null;

export default function TaskInput() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [busy, setBusy] = useState(false);
  const recognitionRef = useRef<any>(null);
  const listeningRef = useRef(false);
  const savedTextRef = useRef('');
  const transcriptRef = useRef('');
  const { events, addEvent, refreshEvents } = useCalendar();
  const { tasks, addTask, updateTask, removeTask } = useTasks();

  const updateTranscript = (text: string) => {
    transcriptRef.current = text;
    setTranscript(text);
  };

  const launchRecognition = () => {
    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event: any) => {
      let sessionFinal = '';
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          sessionFinal += r[0].transcript;
        } else {
          interim += r[0].transcript;
        }
      }
      updateTranscript(savedTextRef.current + sessionFinal + interim);
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      if (!listeningRef.current) {
        setListening(false);
        return;
      }
      savedTextRef.current = transcriptRef.current;
      setTimeout(() => {
        if (listeningRef.current) {
          try {
            launchRecognition();
          } catch (_) {
            listeningRef.current = false;
            setListening(false);
          }
        }
      }, 200);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        listeningRef.current = false;
        setListening(false);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const startListening = () => {
    if (!SpeechRecognition) {
      alert('このブラウザは音声入力に対応していません。Chrome を使ってください。');
      return;
    }
    savedTextRef.current = '';
    transcriptRef.current = '';
    listeningRef.current = true;
    setListening(true);
    setTranscript('');
    launchRecognition();
  };

  const stopListening = () => {
    listeningRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setListening(false);
  };

  // Phase 1: AI分析 → 確認画面を表示
  const handleSubmit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const taskId = Date.now().toString();
    const task: TaskItem = {
      id: taskId,
      input: trimmed,
      analysis: null,
      status: 'analyzing',
    };

    addTask(task);
    setTranscript('');
    setBusy(true);

    try {
      const analysis = await analyzeTask(trimmed);
      updateTask(taskId, { analysis, status: 'confirming' });
    } catch (e: any) {
      updateTask(taskId, {
        status: 'error',
        error: e.message || 'エラーが発生しました',
      });
    } finally {
      setBusy(false);
    }
  };

  // Phase 2: ユーザーが確認 → カレンダーに登録
  const handleConfirm = async (
    taskId: string,
    editedAnalysis: TaskAnalysis,
    scheduleResult: ScheduleResult
  ) => {
    setBusy(true);
    updateTask(taskId, { analysis: editedAnalysis, status: 'scheduling' });

    try {
      const calEvent = await addEvent(
        editedAnalysis.title,
        scheduleResult.start,
        scheduleResult.end
      );
      updateTask(taskId, {
        status: 'scheduled',
        calendarEventId: calEvent.id,
        scheduledStart: scheduleResult.start,
        scheduledEnd: scheduleResult.end,
      });
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

  // 確認をキャンセル → タスクを削除
  const handleCancelConfirm = (taskId: string) => {
    removeTask(taskId);
  };

  // エラータスクをリトライ
  const handleRetry = async (task: TaskItem) => {
    if (busy) return;
    updateTask(task.id, { status: 'analyzing', error: undefined });
    setBusy(true);
    try {
      const analysis = await analyzeTask(task.input);
      updateTask(task.id, { analysis, status: 'confirming' });
    } catch (e: any) {
      updateTask(task.id, {
        status: 'error',
        error: e.message || 'エラーが発生しました',
      });
    } finally {
      setBusy(false);
    }
  };

  // AI失敗時にフォールバック（手動追加）
  const handleManualAdd = (task: TaskItem) => {
    const analysis = createFallbackAnalysis(task.input);
    updateTask(task.id, { analysis, status: 'confirming', error: undefined });
  };

  // エラータスクを削除
  const handleDismissError = (taskId: string) => {
    removeTask(taskId);
  };

  const handleMicPress = () => {
    if (busy) return;
    if (listening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const confirmingTask = tasks.find(t => t.status === 'confirming');
  const unscheduledTasks = tasks.filter(t => t.status === 'error');

  return (
    <View style={styles.container}>
      {unscheduledTasks.length > 0 && (
        <View style={styles.unplacedBanner}>
          <Text style={styles.unplacedText}>
            未配置のタスクが{unscheduledTasks.length}件あります
          </Text>
        </View>
      )}

      {tasks.filter(t => t.status !== 'confirming').slice(-3).reverse().map(task => (
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
              <Text style={styles.taskStatusText}>カレンダーに登録中...</Text>
            </View>
          )}
          {task.status === 'scheduled' && task.scheduledStart && (
            <View style={styles.taskStatusRowSuccess}>
              <Text style={styles.taskStatusTextSuccess}>
                「{task.analysis?.title}」→ {formatDate(task.scheduledStart)} {formatTime(task.scheduledStart)}〜
              </Text>
            </View>
          )}
          {task.status === 'error' && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorInputText}>「{task.input}」</Text>
              <Text style={styles.taskStatusTextError}>
                {task.error}
              </Text>
              <View style={styles.errorActions}>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => handleRetry(task)}
                  disabled={busy}
                >
                  <Text style={styles.retryBtnText}>リトライ</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.manualBtn}
                  onPress={() => handleManualAdd(task)}
                >
                  <Text style={styles.manualBtnText}>手動で追加</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dismissBtn}
                  onPress={() => handleDismissError(task.id)}
                >
                  <Text style={styles.dismissBtnText}>消す</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      ))}

      {/* 確認カード: AI分析後にユーザーが内容を確認・編集 */}
      {confirmingTask && confirmingTask.analysis && (
        <TaskConfirmCard
          analysis={confirmingTask.analysis}
          events={events}
          onConfirm={(editedAnalysis, scheduleResult) =>
            handleConfirm(confirmingTask.id, editedAnalysis, scheduleResult)
          }
          onCancel={() => handleCancelConfirm(confirmingTask.id)}
        />
      )}

      {/* 音声入力エリア: 確認中は非表示 */}
      {!confirmingTask && (
        <View style={styles.voiceArea}>
          {transcript ? (
            <View style={styles.transcriptArea}>
              <Text style={styles.transcriptText}>{transcript}</Text>
              {!listening && (
                <TouchableOpacity
                  style={styles.sendBtn}
                  onPress={() => handleSubmit(transcript)}
                  disabled={busy}
                >
                  <Text style={styles.sendBtnText}>追加</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <Text style={styles.hintText}>
              {listening ? '話してください...' : 'マイクを押して話しかけてください'}
            </Text>
          )}

          <TouchableOpacity
            style={[
              styles.micBtn,
              listening && styles.micBtnActive,
              busy && styles.micBtnDisabled,
            ]}
            onPress={handleMicPress}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : (
              <Text style={styles.micIcon}>{listening ? '⏹' : '🎤'}</Text>
            )}
          </TouchableOpacity>

          {listening && (
            <Text style={styles.listeningText}>聞き取り中...</Text>
          )}
        </View>
      )}
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
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 10,
  },
  errorInputText: {
    color: '#555',
    fontSize: 13,
    marginBottom: 2,
  },
  taskStatusTextError: {
    color: '#C62828',
    fontSize: 13,
    marginBottom: 8,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 8,
  },
  retryBtn: {
    backgroundColor: '#2196F3',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  manualBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  manualBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  dismissBtn: {
    backgroundColor: '#E0E0E0',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dismissBtnText: {
    color: '#555',
    fontSize: 12,
    fontWeight: '600',
  },
  voiceArea: {
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  hintText: {
    color: '#999',
    fontSize: 14,
    marginBottom: 12,
  },
  transcriptArea: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    width: '100%',
    gap: 8,
  },
  transcriptText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  sendBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sendBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  micBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  micBtnActive: {
    backgroundColor: '#F44336',
  },
  micBtnDisabled: {
    backgroundColor: '#B0BEC5',
  },
  micIcon: {
    fontSize: 32,
  },
  listeningText: {
    color: '#F44336',
    fontSize: 13,
    marginTop: 8,
    fontWeight: '600',
  },
});
