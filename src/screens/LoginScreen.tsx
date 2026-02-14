import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>AI スケジューラー</Text>
        <Text style={styles.subtitle}>
          タスクを入力するだけで{'\n'}
          AIが最適な時間に自動配置します
        </Text>
        <TouchableOpacity style={styles.loginBtn} onPress={login}>
          <Text style={styles.loginBtnText}>Googleでログイン</Text>
        </TouchableOpacity>
        <Text style={styles.note}>
          Googleカレンダーへのアクセス許可が必要です
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  loginBtn: {
    backgroundColor: '#4285F4',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  note: {
    marginTop: 16,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});
