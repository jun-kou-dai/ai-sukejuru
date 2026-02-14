import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { CalendarProvider } from './src/contexts/CalendarContext';
import { TaskProvider } from './src/contexts/TaskContext';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';

function AppContent() {
  const { loggedIn } = useAuth();

  // Set lang=ja on html element to suppress Google Translate
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = 'ja';
      // Also add meta tag to prevent translation
      const meta = document.createElement('meta');
      meta.name = 'google';
      meta.content = 'notranslate';
      document.head.appendChild(meta);
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
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
