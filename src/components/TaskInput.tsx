import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { analyzeTask } from '../services/aiService';
import { scheduleTask } from '../services/scheduler';
import { useCalendar } from '../contexts/CalendarContext';
import { useTasks, TaskItem } from '../contexts/TaskContext';
import { formatTime, formatDate } from '../utils/timezone';

const SpeechRecognition = typeof window !== 'undefined'
  ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  : null;

export default function TaskInput() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [busy, setBusy] = useState(false);
  const recognitionRef = useRef<any>(null);
  const listeningRef = useRef(false);
  const { events, addEvent, refreshEvents } = useCalendar();
  const { tasks, addTask, updateTask } = useTasks();

  const startListening = () => {
    if (!SpeechRecognition) {
      alert('このブラウザは音声入力に対応していません。Chrome を使ってください。');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event: any) => {
      let final = '';
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          final += r[0].transcript;
        } else {
          interim += r[0].transcript;
        }
      }
      setTranscript(final + interim);
    };

    recognition.onend = () => {
      // continuous モードでもブラウザが勝手に止める場合がある
      // listening 中なら自動で再開する（ref を使って最新の状態を参照）
      if (recognitionRef.current && listeningRef.current) {
        try {
          recognitionRef.current.start();
        } catch (_) {
          listeningRef.current = false;
          setListening(false);
        }
      } else {
        setListening(false);
      }
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    listeningRef.current = true;
    setListening(true);
    setTranscript('');
  };

  const stopListening = () => {
    listeningRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setListening(false);
  };

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
      updateTask(taskId, { analysis, status: 'analyzed' });

      updateTask(taskId, { status: 'scheduling' });
      const result = scheduleTask(analysis, events);

      if (!result.slotFound) {
        updateTask(taskId, {
          status: 'error',
          error: '空き時間が見つかりませんでした。',
        });
        setBusy(false);
        return;
      }

      const calEvent = await addEvent(analysis.title, result.start, result.end);
      updateTask(taskId, {
        status: 'scheduled',
        calendarEventId: calEvent.id,
        scheduledStart: result.start,
        scheduledEnd: result.end,
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

  const handleMicPress = () => {
    if (busy) return;
    if (listening) {
      stopListening();
    } else {
      startListening();
    }
  };

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

      {/* Voice input area */}
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
