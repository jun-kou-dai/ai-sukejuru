import { nowJST, formatDateFull, formatTime } from '../utils/timezone';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/** ビルド時の定数展開による dead-code elimination を防ぐため、実行時に取得する */
function getGeminiUrl(): string {
  const key = process.env.EXPO_PUBLIC_AI_API_KEY ?? '';
  return `${GEMINI_BASE}?key=${key}`;
}

export interface TaskAnalysis {
  title: string;
  durationMinutes: number;
  priority: 'high' | 'medium' | 'low';
  deadline: string | null; // ISO string or null
  preferredStartTime: string | null; // ISO string or null - 「9時から〜」の場合
  category: string;
}

/**
 * AIなしでタスクをデフォルト値で作成するフォールバック
 */
export function createFallbackAnalysis(input: string): TaskAnalysis {
  const now = nowJST();

  // 日付パース: 「明日」「明後日」
  let dayOffset = 0;
  if (/明後日/.test(input)) dayOffset = 2;
  else if (/明日/.test(input)) dayOffset = 1;

  // 時刻パース（統一正規表現）: 「9時」「14時45分」「4時半」にマッチ（「1時間」は除外）
  // 入力中の最初のマッチを開始時刻とする
  let preferredStartTime: string | null = null;
  const timeRe = /(午後|午前|夕方|夜)?(\d{1,2})時(?!間)((\d{1,2})分(?!間)|半)?/;
  const tm = input.match(timeRe);
  let startHour = 0, startMin = 0;
  if (tm) {
    startHour = parseInt(tm[2], 10);
    const prefix = tm[1];
    startMin = tm[3] === '半' ? 30 : tm[4] ? parseInt(tm[4], 10) : 0;
    if (prefix === '午後' || prefix === '夕方' || prefix === '夜') {
      if (startHour < 12) startHour += 12;
    }
    const baseDate = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const dateStr = baseDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
    preferredStartTime = `${dateStr}T${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00+09:00`;
  }

  // 終了時刻パース: 「6時まで」「8時半まで」→ 開始時刻との差を所要時間にする
  const endMatch = input.match(/(\d{1,2})時(半|(\d{1,2})分)?まで/);
  let endMinutesOfDay: number | null = null;
  if (endMatch) {
    const endH = parseInt(endMatch[1], 10);
    const endM = endMatch[2] === '半' ? 30 : endMatch[3] ? parseInt(endMatch[3], 10) : 0;
    endMinutesOfDay = endH * 60 + endM;
  }

  // 所要時間パース: 「15分間」「1時間」「90分」など
  // 時刻部分を除外してからパース
  let durationMinutes = 30;
  const timeStr = tm ? tm[0] : '';
  const endStr = endMatch ? endMatch[0] : '';
  let inputClean = timeStr ? input.replace(timeStr, '') : input;
  if (endStr) inputClean = inputClean.replace(endStr, '');
  const durHourMatch = inputClean.match(/(\d+)時間/);
  const durMinMatch = inputClean.match(/(\d+)分/);
  if (durHourMatch) {
    durationMinutes = parseInt(durHourMatch[1], 10) * 60;
    if (durMinMatch) durationMinutes += parseInt(durMinMatch[1], 10);
  } else if (durMinMatch) {
    durationMinutes = parseInt(durMinMatch[1], 10);
  } else if (endMinutesOfDay !== null && tm) {
    // 「4時半から6時まで」→ 差分を所要時間にする
    const startMOD = startHour * 60 + startMin;
    const diff = endMinutesOfDay - startMOD;
    if (diff > 0) durationMinutes = diff;
  }

  // 簡易カテゴリ推定
  let category = 'その他';
  if (/トレーニング|運動|ジム|ランニング|散歩|筋トレ|ストレッチ|ヨガ/.test(input)) category = '運動';
  else if (/会議|仕事|ミーティング|打ち合わせ|資料|メール|報告/.test(input)) category = '仕事';
  else if (/勉強|学習|読書|復習|宿題|レポート|コーディング/.test(input)) category = '勉強';
  else if (/掃除|洗濯|料理|片付け|ゴミ|風呂|シャワー/.test(input)) category = '家事';
  else if (/買い物|スーパー|コンビニ|ショッピング/.test(input)) category = '買い物';

  return {
    title: input,
    durationMinutes,
    priority: 'medium',
    deadline: null,
    preferredStartTime,
    category,
  };
}

export async function analyzeTask(input: string): Promise<TaskAnalysis> {
  const now = nowJST();
  const todayStr = formatDateFull(now);
  const currentTime = formatTime(now);

  const prompt = `あなたはタスク分析AIです。ユーザーが入力したタスクを分析し、JSONで返してください。

現在: ${todayStr} ${currentTime} (JST)

入力: "${input}"

以下のJSON形式で返してください（コードブロックなし、純粋なJSONのみ）:
{
  "title": "タスクの簡潔なタイトル（時刻情報は含めない）",
  "durationMinutes": 所要時間（分・整数）,
  "priority": "high" または "medium" または "low",
  "deadline": "締切がある場合はISO 8601形式、なければnull",
  "preferredStartTime": "開始時刻が指定されている場合はISO 8601形式、なければnull",
  "category": "仕事/勉強/運動/家事/買い物/その他 のいずれか"
}

重要なルール:

1. preferredStartTime（開始時刻）:
- 「9時から〜」「14時に〜」「4時半に〜」→ preferredStartTimeを設定。
- 「明日の4時半から」→ 明日の04:30をpreferredStartTimeに設定。
- 「明後日9時から」→ 明後日の09:00をpreferredStartTimeに設定。
- 日付指定がなければ今日の日付を使う。
- 「X時半」は X:30 を意味する。

2. durationMinutes（所要時間）:
- 「4時半から6時まで」→ 開始=4:30、終了=6:00、durationMinutes=90。preferredStartTimeは4:30。
- 「15分間ランニング」→ durationMinutes=15。
- 「1時間勉強」→ durationMinutes=60。
- 「〜まで」は終了時刻。開始時刻との差をdurationMinutesにする。
- 明示的な時間指定がなければ常識的に推定（トレーニング→60分、買い物→30分、会議→60分など）。

3. deadline（締切）:
- 「〜時までに完成させる」「〜日が期限」→ deadlineを設定。
- 「〜まで」が終了時刻の意味（「6時まで勉強」）の場合はdeadlineではなくdurationMinutesの計算に使う。

4. 時刻の午前/午後:
- 1〜11の数字は午前として扱う。「5時」→ 05:00。
- 「午後」「夜」「夕方」が付く場合、または13以上は午後。「午後5時」→ 17:00。

5. priority は締切の近さやタスクの性質から推定。`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 500,
    },
  };

  let res: Response;
  try {
    res = await fetch(getGeminiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e: any) {
    throw new Error('ネットワークエラー: AI分析に接続できません');
  }

  if (!res.ok) {
    const status = res.status;
    if (status === 403 || status === 401) {
      throw new Error('APIキーエラー: AI機能が利用できません');
    }
    if (status === 429) {
      throw new Error('API制限: しばらく待ってからお試しください');
    }
    throw new Error(`AIサーバーエラー (${status})`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI応答の解析に失敗しました');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error('AI応答の解析に失敗しました');
  }

  const aiResult: TaskAnalysis = {
    title: parsed.title || input,
    durationMinutes: parseInt(parsed.durationMinutes, 10) || 30,
    priority: ['high', 'medium', 'low'].includes(parsed.priority) ? parsed.priority : 'medium',
    deadline: parsed.deadline || null,
    preferredStartTime: parsed.preferredStartTime || null,
    category: parsed.category || 'その他',
  };

  // ローカルパーサーの結果で時刻・所要時間を補正する
  // ローカルパーサーは正規表現ベースで確実なため、AIより優先
  const local = createFallbackAnalysis(input);
  if (local.preferredStartTime) {
    aiResult.preferredStartTime = local.preferredStartTime;
  }
  if (local.durationMinutes !== 30) {
    // デフォルト値(30)でない = ローカルパーサーが明示的に検出した
    aiResult.durationMinutes = local.durationMinutes;
  }

  return aiResult;
}
