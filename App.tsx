import React, { useEffect, Component, type ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { CalendarProvider } from './src/contexts/CalendarContext';
import { TaskProvider } from './src/contexts/TaskContext';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <View style={errorStyles.card}>
            <Text style={errorStyles.title}>エラーが発生しました</Text>
            <ScrollView style={errorStyles.scroll}>
              <Text style={errorStyles.message}>{this.state.error?.message}</Text>
              <Text style={errorStyles.stack}>{this.state.error?.stack}</Text>
            </ScrollView>
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF3F3', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 500, maxHeight: '80%', borderWidth: 1, borderColor: '#F44336' },
  title: { fontSize: 20, fontWeight: '700', color: '#D32F2F', marginBottom: 12 },
  scroll: { maxHeight: 300 },
  message: { fontSize: 14, color: '#333', marginBottom: 8 },
  stack: { fontSize: 11, color: '#666', fontFamily: 'monospace' },
});

function AppContent() {
  const { loggedIn } = useAuth();

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = 'ja';
      const meta = document.createElement('meta');
      meta.name = 'google';
      meta.content = 'notranslate';
      document.head.appendChild(meta);
      // Remove loading indicator once React has mounted
      const loader = document.getElementById('loading');
      if (loader) loader.remove();
    }
  }, []);

  if (!loggedIn) {
    return <LoginScreen />;
  }

  return (
    <CalendarProvider>
      <TaskProvider>
        <HomeScreen />
      </TaskProvider>
    </CalendarProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
