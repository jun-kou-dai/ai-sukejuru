import React, { createContext, useContext, useState, useCallback } from 'react';
import { TaskAnalysis } from '../services/aiService';

export interface TaskItem {
  id: string;
  input: string;
  analysis: TaskAnalysis | null;
  status: 'analyzing' | 'analyzed' | 'scheduling' | 'scheduled' | 'error';
  error?: string;
  calendarEventId?: string;
  scheduledStart?: Date;
  scheduledEnd?: Date;
}

interface TaskContextType {
  tasks: TaskItem[];
  addTask: (task: TaskItem) => void;
  updateTask: (id: string, updates: Partial<TaskItem>) => void;
  removeTask: (id: string) => void;
  clearTasks: () => void;
}

const TaskContext = createContext<TaskContextType>({
  tasks: [],
  addTask: () => {},
  updateTask: () => {},
  removeTask: () => {},
  clearTasks: () => {},
});

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);

  const addTask = useCallback((task: TaskItem) => {
    setTasks(prev => [...prev, task]);
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<TaskItem>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const removeTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const clearTasks = useCallback(() => {
    setTasks([]);
  }, []);

  return (
    <TaskContext.Provider value={{ tasks, addTask, updateTask, removeTask, clearTasks }}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks() {
  return useContext(TaskContext);
}
