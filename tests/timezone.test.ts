/**
 * タイムゾーン・日付処理のテスト
 * 実行: npx tsx tests/timezone.test.ts
 */

import {
  nowJST,
  formatTime,
  formatDate,
  formatDateFull,
  isSameDay,
  getDateKeyJST,
  startOfDayJST,
  endOfDayJST,
  addDays,
  toISOStringJST,
  TIMEZONE,
} from '../src/utils/timezone';

import {
  formatSectionDate,
  getEventStatus,
  groupEventsByDate,
  getSummaryText,
  CalendarEvent,
} from '../src/utils/dateUtils';

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
console.log('\n=== 1. TIMEZONE定数 ===');
assertEqual(TIMEZONE, 'Asia/Tokyo', 'TIMEZONE は Asia/Tokyo');

// ============================================================
console.log('\n=== 2. nowJST() ===');
const now = nowJST();
assert(now instanceof Date, 'Date オブジェクトを返す');
assert(!isNaN(now.getTime()), '有効な日時');

// ============================================================
console.log('\n=== 3. formatTime() ===');
// 2026-02-14 14:30:00 JST = 2026-02-14 05:30:00 UTC
const testDate = new Date('2026-02-14T05:30:00Z');
assertEqual(formatTime(testDate), '14:30', 'UTC 05:30 → JST 14:30');

const testMidnight = new Date('2026-02-14T15:00:00Z'); // JST 00:00 on 2/15
assertEqual(formatTime(testMidnight), '00:00', 'UTC 15:00 → JST 翌日 00:00');

const testMorning = new Date('2026-02-13T23:00:00Z'); // JST 08:00 on 2/14
assertEqual(formatTime(testMorning), '08:00', 'UTC 23:00 → JST 翌日 08:00');

// ============================================================
console.log('\n=== 4. formatDate() — 「今日」「明日」ラベルなし ===');
const dateStr = formatDate(testDate);
assert(!dateStr.includes('今日'), '「今日」ラベルがない');
assert(!dateStr.includes('明日'), '「明日」ラベルがない');
assert(dateStr.includes('2'), '月が含まれる');
assert(dateStr.includes('14'), '日が含まれる');
assert(dateStr.includes('(') || dateStr.includes('('), '曜日が含まれる');

// ============================================================
console.log('\n=== 5. formatSectionDate() — 日付のみ表示 ===');
const sectionDate = formatSectionDate('2026-02-14');
assert(!sectionDate.includes('今日'), '「今日」ラベルがない');
assert(!sectionDate.includes('明日'), '「明日」ラベルがない');
assert(sectionDate.includes('14'), '日が含まれる');
console.log(`    表示: "${sectionDate}"`);

// ============================================================
console.log('\n=== 6. getDateKeyJST() — JST基準の日付キー ===');
// UTC 2026-02-13 20:00 = JST 2026-02-14 05:00
const crossMidnight = new Date('2026-02-13T20:00:00Z');
assertEqual(getDateKeyJST(crossMidnight), '2026-02-14', 'UTC 2/13 20:00 → JST 2/14');

// UTC 2026-02-14 14:59 = JST 2026-02-14 23:59
const beforeMidnight = new Date('2026-02-14T14:59:00Z');
assertEqual(getDateKeyJST(beforeMidnight), '2026-02-14', 'UTC 2/14 14:59 → JST 2/14');

// UTC 2026-02-14 15:00 = JST 2026-02-15 00:00
const afterMidnight = new Date('2026-02-14T15:00:00Z');
assertEqual(getDateKeyJST(afterMidnight), '2026-02-15', 'UTC 2/14 15:00 → JST 2/15');

// ============================================================
console.log('\n=== 7. isSameDay() — JST基準 ===');
assert(isSameDay(crossMidnight, beforeMidnight), 'JST同日: 05:00 と 23:59');
assert(!isSameDay(beforeMidnight, afterMidnight), 'JST跨ぎ: 23:59 と 翌00:00');

// ============================================================
console.log('\n=== 8. startOfDayJST() / endOfDayJST() ===');
const sod = startOfDayJST(testDate);
assertEqual(getDateKeyJST(sod), '2026-02-14', '開始日のキーが同じ');
assertEqual(formatTime(sod), '00:00', '00:00 始まり');

const eod = endOfDayJST(testDate);
assertEqual(getDateKeyJST(eod), '2026-02-14', '終了日のキーが同じ');
assertEqual(formatTime(eod), '23:59', '23:59 終わり');

// ============================================================
console.log('\n=== 9. addDays() — JST基準 ===');
const day0 = new Date('2026-02-14T05:00:00Z'); // JST 2/14 14:00
const day1 = addDays(day0, 1);
assertEqual(getDateKeyJST(day1), '2026-02-15', '+1日 → 2/15');
const day3 = addDays(day0, 3);
assertEqual(getDateKeyJST(day3), '2026-02-17', '+3日 → 2/17');
const dayMinus1 = addDays(day0, -1);
assertEqual(getDateKeyJST(dayMinus1), '2026-02-13', '-1日 → 2/13');

// 月末跨ぎ
const monthEnd = new Date('2026-02-28T10:00:00Z'); // JST 2/28 19:00
const marchFirst = addDays(monthEnd, 1);
assertEqual(getDateKeyJST(marchFirst), '2026-03-01', '2月末+1日 → 3/1');

// ============================================================
console.log('\n=== 10. toISOStringJST() — +09:00形式 ===');
const iso = toISOStringJST(testDate);
assert(iso.includes('+09:00'), '+09:00 が含まれる');
assert(iso.startsWith('2026-02-14'), 'JST日付 2026-02-14');
assert(iso.includes('14:30'), 'JST時刻 14:30');
console.log(`    出力: "${iso}"`);

// ============================================================
console.log('\n=== 11. getEventStatus() — 過去/進行中/未来 ===');
const nowMs = Date.now();
const pastEvent: CalendarEvent = {
  id: '1', summary: '過去', start: new Date(nowMs - 7200000), end: new Date(nowMs - 3600000),
};
const currentEvent: CalendarEvent = {
  id: '2', summary: '進行中', start: new Date(nowMs - 1800000), end: new Date(nowMs + 1800000),
};
const futureEvent: CalendarEvent = {
  id: '3', summary: '未来', start: new Date(nowMs + 3600000), end: new Date(nowMs + 7200000),
};
assertEqual(getEventStatus(pastEvent), 'past', '終了イベント → past');
assertEqual(getEventStatus(currentEvent), 'current', '進行中イベント → current');
assertEqual(getEventStatus(futureEvent), 'future', '未来イベント → future');

// ============================================================
console.log('\n=== 12. groupEventsByDate() ===');
const events: CalendarEvent[] = [
  { id: '1', summary: 'A', start: new Date('2026-02-14T01:00:00Z'), end: new Date('2026-02-14T02:00:00Z') },
  { id: '2', summary: 'B', start: new Date('2026-02-14T05:00:00Z'), end: new Date('2026-02-14T06:00:00Z') },
  { id: '3', summary: 'C', start: new Date('2026-02-14T16:00:00Z'), end: new Date('2026-02-14T17:00:00Z') },
];
const grouped = groupEventsByDate(events);
// Event 1: UTC 01:00 = JST 10:00 → 2/14
// Event 2: UTC 05:00 = JST 14:00 → 2/14
// Event 3: UTC 16:00 = JST 01:00 → 2/15
assert(grouped.has('2026-02-14'), '2/14 グループがある');
assert(grouped.has('2026-02-15'), '2/15 グループがある');
assertEqual(grouped.get('2026-02-14')?.length, 2, '2/14 に2件');
assertEqual(grouped.get('2026-02-15')?.length, 1, '2/15 に1件');

// ============================================================
console.log('\n=== 13. getSummaryText() ===');
const summaryText = getSummaryText([pastEvent, currentEvent, futureEvent]);
assert(summaryText.includes('1件終了'), '1件終了が含まれる');
assert(summaryText.includes('残り2件'), '残り2件が含まれる');
assert(!summaryText.includes('今日'), '「今日」が含まれない');

// ============================================================
console.log('\n==============================');
console.log(`結果: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('テスト失敗あり！');
  process.exit(1);
} else {
  console.log('全テスト合格');
}
