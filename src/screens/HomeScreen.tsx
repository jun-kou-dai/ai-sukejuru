import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import CalendarView from '../components/CalendarView';
import TaskInput from '../components/TaskInput';

export default function HomeScreen() {
  const { logout } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI スケジューラー</Text>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>ログアウト</Text>
        </TouchableOpacity>
      </View>

      {/* Calendar */}
      <View style={styles.calendarContainer}>
        <CalendarView />
      </View>

      {/* Task input at bottom */}
      <TaskInput />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  logoutBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  logoutText: {
    color: '#F44336',
    fontSize: 14,
  },
  calendarContainer: {
    flex: 1,
  },
});
