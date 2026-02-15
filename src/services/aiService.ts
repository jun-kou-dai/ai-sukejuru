import { nowJST, formatDateFull, formatTime } from '../utils/timezone';

const API_KEY = process.env.EXPO_PUBLIC_AI_API_KEY ?? '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

export interface TaskAnalysis {
  title: string;
  durationMinutes: number;
  priority: 'high' | 'medium' | 'low';
  deadline: string | null; // ISO string or null
  preferredStartTime: string | null; // ISO string or null - 「9時から〜」の場合
  category: string;
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

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  // Extract JSON from response (handle possible markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`AIからの応答をパースできませんでした: ${text.substring(0, 200)}`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error(`AIの応答JSONが不正です: ${jsonMatch[0].substring(0, 200)}`);
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
