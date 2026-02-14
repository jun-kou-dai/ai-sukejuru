import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatTime, nowJST } from '../utils/timezone';

export default function CurrentTimeLine() {
  const [now, setNow] = useState(nowJST());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(nowJST());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.dot} />
      <View style={styles.line} />
      <Text style={styles.timeText}>{formatTime(now)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
    marginHorizontal: 16,
    height: 20,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F44336',
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: '#F44336',
  },
  timeText: {
    fontSize: 11,
    color: '#F44336',
    fontWeight: '700',
    marginLeft: 6,
  },
});
