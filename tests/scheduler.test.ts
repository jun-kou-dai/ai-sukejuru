/**
 * スケジューラー・空き時間検索のテスト
 * 実行: npx tsx tests/scheduler.test.ts
 */

import { findFreeSlots } from '../src/services/googleCalendar';
import { scheduleTask } from '../src/services/scheduler';
import { CalendarEvent } from '../src/utils/dateUtils';
import { TaskAnalysis } from '../src/services/aiService';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${name}`);
    failed++;
  }
}

function assertEqual(actual: any, expected: any, name: string) {
  if (actual === expected) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${name} — got "${actual}", expected "${expected}"`);
    failed++;
  }
}

// ============================================================
console.log('\n=== 1. findFreeSlots() — 空き時間検索 ===');

const dayStart = new Date('2026-02-14T08:00:00+09:00'); // JST 8:00
const dayEnd = new Date('2026-02-14T22:00:00+09:00');   // JST 22:00

// イベント: 9:00-10:00, 14:00-15:00
const events: CalendarEvent[] = [
  { id: '1', summary: 'A', start: new Date('2026-02-14T09:00:00+09:00'), end: new Date('2026-02-14T10:00:00+09:00') },
  { id: '2', summary: 'B', start: new Date('2026-02-14T14:00:00+09:00'), end: new Date('2026-02-14T15:00:00+09:00') },
];

const slots = findFreeSlots(events, dayStart, dayEnd, 30);
// 空き: 8:00-9:00 (60min), 10:00-14:00 (240min), 15:00-22:00 (420min)
assertEqual(slots.length, 3, '3つの空き時間');
assertEqual(slots[0].durationMinutes, 60, '最初の空き: 60分 (8:00-9:00)');
assertEqual(slots[1].durationMinutes, 240, '2番目の空き: 240分 (10:00-14:00)');
assertEqual(slots[2].durationMinutes, 420, '3番目の空き: 420分 (15:00-22:00)');

// ============================================================
console.log('\n=== 2. findFreeSlots() — 短い空きはスキップ ===');
const events2: CalendarEvent[] = [
  { id: '1', summary: 'A', start: new Date('2026-02-14T08:00:00+09:00'), end: new Date('2026-02-14T08:20:00+09:00') },
  { id: '2', summary: 'B', start: new Date('2026-02-14T08:30:00+09:00'), end: new Date('2026-02-14T22:00:00+09:00') },
];
const slots2 = findFreeSlots(events2, dayStart, dayEnd, 30);
// 8:20-8:30 は10分 → 30分未満なのでスキップ
assertEqual(slots2.length, 0, '30分未満の空きはスキップ');

// ============================================================
console.log('\n=== 3. findFreeSlots() — All-dayイベントは無視 ===');
const events3: CalendarEvent[] = [
  { id: '1', summary: '終日', start: new Date('2026-02-14T00:00:00+09:00'), end: new Date('2026-02-15T00:00:00+09:00'), isAllDay: true },
  { id: '2', summary: 'B', start: new Date('2026-02-14T10:00:00+09:00'), end: new Date('2026-02-14T11:00:00+09:00') },
];
const slots3 = findFreeSlots(events3, dayStart, dayEnd, 30);
// All-dayは無視 → 空き: 8:00-10:00, 11:00-22:00
assertEqual(slots3.length, 2, 'All-dayイベントは空き時間計算に影響しない');

// ============================================================
console.log('\n=== 4. scheduleTask() — preferredStartTime ===');
const analysis1: TaskAnalysis = {
  title: 'トレーニング',
  durationMinutes: 60,
  priority: 'medium',
  deadline: null,
  preferredStartTime: '2026-02-14T09:00:00+09:00',
  category: '運動',
};
// 9:00-10:00 は空いている（eventsには9:00-10:00にイベントがあるが、空のリストで渡す）
const result1 = scheduleTask(analysis1, []);
assert(result1.slotFound, 'preferredStartTime で空きが見つかる');
assertEqual(result1.start.toISOString(), new Date('2026-02-14T09:00:00+09:00').toISOString(), '開始時刻が 9:00 JST');

// ============================================================
console.log('\n=== 5. scheduleTask() — preferredStartTime に競合あり ===');
const conflictEvents: CalendarEvent[] = [
  { id: '1', summary: '既存', start: new Date('2026-02-14T09:00:00+09:00'), end: new Date('2026-02-14T10:00:00+09:00') },
];
const result2 = scheduleTask(analysis1, conflictEvents);
// 9:00 は競合 → 別の空きを探す
assert(result2.slotFound, '競合時は別の空きを探す');
assert(result2.start.toISOString() !== new Date('2026-02-14T09:00:00+09:00').toISOString(), '9:00以外の時間に配置');

// ============================================================
console.log('\n==============================');
console.log(`結果: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('テスト失敗あり！');
  process.exit(1);
} else {
  console.log('全テスト合格');
}
