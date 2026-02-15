/**
 * 確認画面フローのテスト
 * TaskConfirmCard が使う scheduleTask プレビューの正確性を検証
 * 実行: npx tsx tests/confirm-flow.test.ts
 */

import { scheduleTask, ScheduleResult } from '../src/services/scheduler';
import { CalendarEvent } from '../src/utils/dateUtils';
import { TaskAnalysis } from '../src/services/aiService';
import { formatTime, formatDate } from '../src/utils/timezone';

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
console.log('\n=== 1. 確認画面: タイトル編集後もスケジュール結果が正しい ===');
{
  const analysis: TaskAnalysis = {
    title: 'トレーニング',
    durationMinutes: 60,
    priority: 'medium',
    deadline: null,
    preferredStartTime: '2026-02-14T09:00:00+09:00',
    category: '運動',
  };

  // ユーザーがタイトルを変更しても、スケジュール結果は変わらない
  const editedAnalysis: TaskAnalysis = { ...analysis, title: '筋トレ' };
  const result = scheduleTask(editedAnalysis, []);
  assert(result.slotFound, 'タイトル変更後もスロットが見つかる');
  assertEqual(
    result.start.toISOString(),
    new Date('2026-02-14T09:00:00+09:00').toISOString(),
    'タイトル変更後も開始時刻は 9:00 JST'
  );
}

// ============================================================
console.log('\n=== 2. 確認画面: 所要時間変更でスケジュール結果が更新される ===');
{
  const analysis: TaskAnalysis = {
    title: 'ミーティング',
    durationMinutes: 60,
    priority: 'high',
    deadline: null,
    preferredStartTime: '2026-02-14T10:00:00+09:00',
    category: '仕事',
  };

  const result60 = scheduleTask(analysis, []);
  assert(result60.slotFound, '60分でスロットが見つかる');
  assertEqual(
    formatTime(result60.end),
    '11:00',
    '60分 → 10:00-11:00'
  );

  // ユーザーが90分に変更
  const edited90 = { ...analysis, durationMinutes: 90 };
  const result90 = scheduleTask(edited90, []);
  assert(result90.slotFound, '90分でスロットが見つかる');
  assertEqual(
    formatTime(result90.end),
    '11:30',
    '90分 → 10:00-11:30'
  );

  // ユーザーが30分に変更
  const edited30 = { ...analysis, durationMinutes: 30 };
  const result30 = scheduleTask(edited30, []);
  assert(result30.slotFound, '30分でスロットが見つかる');
  assertEqual(
    formatTime(result30.end),
    '10:30',
    '30分 → 10:00-10:30'
  );
}

// ============================================================
console.log('\n=== 3. 確認画面: 競合時に別のスロットがプレビューされる ===');
{
  const events: CalendarEvent[] = [
    {
      id: '1',
      summary: '既存会議',
      start: new Date('2026-02-14T10:00:00+09:00'),
      end: new Date('2026-02-14T11:00:00+09:00'),
    },
    {
      id: '2',
      summary: 'ランチ',
      start: new Date('2026-02-14T12:00:00+09:00'),
      end: new Date('2026-02-14T13:00:00+09:00'),
    },
  ];

  const analysis: TaskAnalysis = {
    title: '作業',
    durationMinutes: 60,
    priority: 'medium',
    deadline: null,
    preferredStartTime: '2026-02-14T10:00:00+09:00', // 競合あり
    category: '仕事',
  };

  const result = scheduleTask(analysis, events);
  assert(result.slotFound, '競合でも別の空きが見つかる');
  assert(
    result.start.toISOString() !== new Date('2026-02-14T10:00:00+09:00').toISOString(),
    '10:00 以外の時間に配置'
  );
}

// ============================================================
console.log('\n=== 4. 確認画面: 所要時間の全プリセットでプレビューが正確 ===');
{
  const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];
  const baseAnalysis: TaskAnalysis = {
    title: 'テスト',
    durationMinutes: 60,
    priority: 'low',
    deadline: null,
    preferredStartTime: '2026-02-14T08:00:00+09:00',
    category: 'その他',
  };

  for (const d of DURATION_PRESETS) {
    const edited = { ...baseAnalysis, durationMinutes: d };
    const result = scheduleTask(edited, []);
    assert(result.slotFound, `${d}分でスロットが見つかる`);

    const actualDuration = (result.end.getTime() - result.start.getTime()) / 60000;
    assertEqual(actualDuration, d, `${d}分 → 実際の所要時間が${d}分`);
  }
}

// ============================================================
console.log('\n=== 5. 確認画面: formatDate/formatTime でプレビュー表示が正確 ===');
{
  const start = new Date('2026-02-16T09:00:00+09:00');
  const end = new Date('2026-02-16T10:30:00+09:00');

  assertEqual(formatTime(start), '09:00', '開始時刻の表示');
  assertEqual(formatTime(end), '10:30', '終了時刻の表示');
  assert(formatDate(start).includes('16'), '日付に16が含まれる');
  assert(formatDate(start).includes('2'), '日付に月(2)が含まれる');
}

// ============================================================
console.log('\n=== 6. 確認画面: 空き時間なしの場合 slotFound=false ===');
{
  // scheduleTask は nowJST() から7日間を検索するため、現在日時基準でイベントを生成
  const now = new Date();
  const events: CalendarEvent[] = [];
  for (let i = 0; i < 8; i++) {
    const dayKey = new Date(now.getTime() + i * 86400000)
      .toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
    events.push({
      id: `block-${i}`,
      summary: '終日作業',
      start: new Date(`${dayKey}T08:00:00+09:00`),
      end: new Date(`${dayKey}T22:00:00+09:00`),
    });
  }

  const analysis: TaskAnalysis = {
    title: '予定',
    durationMinutes: 60,
    priority: 'low',
    deadline: null,
    preferredStartTime: null,
    category: 'その他',
  };

  const result = scheduleTask(analysis, events);
  assert(!result.slotFound, '空きがない場合 slotFound=false');
}

// ============================================================
console.log('\n==============================');
console.log(`結果: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('テスト失敗あり！');
  process.exit(1);
} else {
  console.log('全テスト合格');
}
