/**
 * UI出力の検証テスト
 * ブラウザなしで、コンポーネントが正しいデータを出力するか確認
 * 実行: npx tsx tests/ui-output.test.ts
 */

import { formatSectionDate, getEventStatus, getSummaryText, CalendarEvent } from '../src/utils/dateUtils';
import { formatTime, formatDate, getDateKeyJST } from '../src/utils/timezone';

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

// ============================================================
console.log('\n=== 1. セクション見出し — 「今日」「明日」ラベルが絶対にない ===');

// 今日・明日・昨日・来週の日付全てで確認
const dates = [
  '2026-02-14', '2026-02-15', '2026-02-13', '2026-02-20',
  '2026-01-01', '2026-12-31', '2026-03-01',
];
for (const d of dates) {
  const label = formatSectionDate(d);
  assert(!label.includes('今日'), `${d}: 「今日」なし → "${label}"`);
  assert(!label.includes('明日'), `${d}: 「明日」なし → "${label}"`);
  assert(!label.includes('昨日'), `${d}: 「昨日」なし → "${label}"`);
  assert(!label.includes('Today'), `${d}: "Today" なし`);
  assert(!label.includes('Tomorrow'), `${d}: "Tomorrow" なし`);
}

// ============================================================
console.log('\n=== 2. 時刻表示 — 24時間形式・JST ===');
const times = [
  { utc: '2026-02-14T00:00:00Z', expected: '09:00' },  // UTC 0:00 = JST 9:00
  { utc: '2026-02-14T03:30:00Z', expected: '12:30' },   // UTC 3:30 = JST 12:30
  { utc: '2026-02-14T15:00:00Z', expected: '00:00' },   // UTC 15:00 = JST 翌0:00
  { utc: '2026-02-13T22:00:00Z', expected: '07:00' },   // UTC 22:00 = JST 翌7:00
];
for (const t of times) {
  const result = formatTime(new Date(t.utc));
  assert(result === t.expected, `UTC ${t.utc.slice(11,16)} → JST ${t.expected} (got: ${result})`);
}

// ============================================================
console.log('\n=== 3. イベントステータス — 過去/進行中/未来 ===');
const now = Date.now();

const statusTests: { event: CalendarEvent; expected: string }[] = [
  {
    event: { id: '1', summary: '過去', start: new Date(now - 7200000), end: new Date(now - 3600000) },
    expected: 'past',
  },
  {
    event: { id: '2', summary: '進行中', start: new Date(now - 1800000), end: new Date(now + 1800000) },
    expected: 'current',
  },
  {
    event: { id: '3', summary: '未来', start: new Date(now + 3600000), end: new Date(now + 7200000) },
    expected: 'future',
  },
];
for (const t of statusTests) {
  const status = getEventStatus(t.event);
  assert(status === t.expected, `${t.event.summary}: ${t.expected} (got: ${status})`);
}

// ============================================================
console.log('\n=== 4. サマリーテキスト — 「今日」なし ===');
const summaryEvents: CalendarEvent[] = [
  { id: '1', summary: 'A', start: new Date(now - 7200000), end: new Date(now - 3600000) },
  { id: '2', summary: 'B', start: new Date(now - 1800000), end: new Date(now + 1800000) },
  { id: '3', summary: 'C', start: new Date(now + 3600000), end: new Date(now + 7200000) },
];
const summary = getSummaryText(summaryEvents);
assert(summary.includes('1件終了'), `"1件終了" が含まれる (got: ${summary})`);
assert(summary.includes('残り2件'), `"残り2件" が含まれる (got: ${summary})`);
assert(!summary.includes('今日'), '「今日」なし');

// ============================================================
console.log('\n=== 5. Google翻訳抑制 — HTMLの確認 ===');
const fs = require('fs');
const html = fs.readFileSync('./dist/index.html', 'utf-8');
assert(html.includes('lang="ja"'), 'HTML に lang="ja" がある');
assert(html.includes('notranslate'), 'HTML に notranslate がある');
assert(html.includes('translate="no"'), 'HTML に translate="no" がある');

// ============================================================
console.log('\n==============================');
console.log(`結果: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('テスト失敗あり！');
  process.exit(1);
} else {
  console.log('全テスト合格');
}
