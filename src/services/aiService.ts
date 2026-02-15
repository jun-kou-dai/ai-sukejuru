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

  // 簡易的な時刻パース: 「9時から」「14時に」など
  let preferredStartTime: string | null = null;
  const timeMatch = input.match(/(午後|午前|夕方|夜)?(\d{1,2})時/);
  if (timeMatch) {
    let hour = parseInt(timeMatch[2], 10);
    const prefix = timeMatch[1];
    if (prefix === '午後' || prefix === '夕方' || prefix === '夜') {
      if (hour < 12) hour += 12;
    }
    const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
    preferredStartTime = `${dateStr}T${String(hour).padStart(2, '0')}:00:00+09:00`;
  }

  // 簡易カテゴリ推定
  let category = 'その他';
  if (/トレーニング|運動|ジム|ランニング|散歩|筋トレ|ストレッチ/.test(input)) category = '運動';
  else if (/会議|仕事|ミーティング|打ち合わせ|資料|メール|報告/.test(input)) category = '仕事';
  else if (/勉強|学習|読書|復習|宿題|レポート/.test(input)) category = '勉強';
  else if (/掃除|洗濯|料理|片付け|ゴミ/.test(input)) category = '家事';
  else if (/買い物|スーパー|コンビニ|ショッピング/.test(input)) category = '買い物';

  return {
    title: input,
    durationMinutes: 30,
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
  "title": "タスクの簡潔なタイトル",
  "durationMinutes": 所要時間（分・整数）,
  "priority": "high" または "medium" または "low",
  "deadline": "締切がある場合はISO 8601形式（例: 2026-02-14T17:00:00+09:00）、なければnull",
  "preferredStartTime": "「〜時から」のように開始時刻が指定されている場合はISO 8601形式、なければnull",
  "category": "仕事/勉強/運動/家事/買い物/その他 のいずれか"
}

重要なルール:
- 「9時からトレーニング」→ preferredStartTime を 9:00 に設定。deadline は null。
- 「〜時までに」→ deadline に設定。preferredStartTime は null。
- 所要時間は常識的に推定すること（トレーニング→60分、買い物→30分、会議→60分など）。
- priority は締切の近さやタスクの性質から推定。
- 時刻の午前/午後の判定: 「5時」「6時」のように午前/午後の指定がない場合、1〜11の数字は午前（AM）として扱う。「午後」「夜」「夕方」と明示された場合、または「13時」以上の場合のみ午後として扱う。例: 「5時」→ 05:00、「午後5時」→ 17:00、「17時」→ 17:00。`;

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
  return {
    title: parsed.title || input,
    durationMinutes: parseInt(parsed.durationMinutes, 10) || 30,
    priority: ['high', 'medium', 'low'].includes(parsed.priority) ? parsed.priority : 'medium',
    deadline: parsed.deadline || null,
    preferredStartTime: parsed.preferredStartTime || null,
    category: parsed.category || 'その他',
  };
}
