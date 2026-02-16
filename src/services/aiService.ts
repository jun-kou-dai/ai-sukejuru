import { nowJST, formatDateFull, formatTime } from '../utils/timezone';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/** ビルド時の定数展開による dead-code elimination を防ぐため、実行時に取得する */
function getGeminiUrl(): string {
  const key = process.env.EXPO_PUBLIC_AI_API_KEY ?? '';
  return `${GEMINI_BASE}?key=${key}`;
}

export interface TaskAnalysis {
  title: string;
  description: string; // 元の入力内容の要約 or 生テキスト
  durationMinutes: number;
  durationExplicit?: boolean; // ローカルパーサーが明示的に検出した場合 true
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
  let durationExplicit = false; // 明示的に所要時間が検出されたか
  const timeStr = tm ? tm[0] : '';
  const endStr = endMatch ? endMatch[0] : '';
  let inputClean = timeStr ? input.replace(timeStr, '') : input;
  if (endStr) inputClean = inputClean.replace(endStr, '');
  const durHourMatch = inputClean.match(/(\d+)時間/);
  const durMinMatch = inputClean.match(/(\d+)分/);
  if (durHourMatch) {
    durationMinutes = parseInt(durHourMatch[1], 10) * 60;
    if (durMinMatch) durationMinutes += parseInt(durMinMatch[1], 10);
    durationExplicit = true;
  } else if (durMinMatch) {
    durationMinutes = parseInt(durMinMatch[1], 10);
    durationExplicit = true;
  } else if (endMinutesOfDay !== null && tm) {
    // 「4時半から6時まで」→ 差分を所要時間にする
    const startMOD = startHour * 60 + startMin;
    const diff = endMinutesOfDay - startMOD;
    if (diff > 0) { durationMinutes = diff; durationExplicit = true; }
  }

  // 簡易カテゴリ推定
  let category = 'その他';
  if (/トレーニング|運動|ジム|ランニング|散歩|筋トレ|ストレッチ|ヨガ/.test(input)) category = '運動';
  else if (/会議|仕事|ミーティング|打ち合わせ|資料|メール|報告/.test(input)) category = '仕事';
  else if (/勉強|学習|読書|復習|宿題|レポート|コーディング/.test(input)) category = '勉強';
  else if (/掃除|洗濯|料理|片付け|ゴミ|風呂|シャワー/.test(input)) category = '家事';
  else if (/買い物|スーパー|コンビニ|ショッピング/.test(input)) category = '買い物';

  // タイトル生成: 音声テキストからキーワードだけ抽出
  const title = extractTitle(input);

  // descriptionから時刻・所要時間情報を除去して簡潔にする
  let desc = input.trim();
  desc = desc.replace(/(今日の?|明日の?|明後日の?)/g, '');
  desc = desc.replace(/(午後|午前|夕方|夜|朝)/g, '');
  desc = desc.replace(/\d{1,2}時((\d{1,2})分|半)?(ごろ|頃)?(から|に|まで|までに)?/g, '');
  desc = desc.replace(/\d{1,2}分間?/g, '');
  desc = desc.replace(/\d{1,2}時間/g, '');
  desc = desc.replace(/^\s+|\s+$/g, '').replace(/\s{2,}/g, ' ');

  return {
    title,
    description: desc || input.trim(),
    durationMinutes,
    durationExplicit,
    deadline: null,
    preferredStartTime,
    category,
  };
}

/**
 * 音声テキストから簡潔なタイトルを抽出する
 * 「午後は職場に行って仕事をします」→「仕事」
 * 「瞑想をします それから着替えて職場に向かいます」→「瞑想 / 着替え・出勤」
 */
function extractTitle(input: string): string {
  let t = input;

  // 1. 時刻・日付表現を除去
  t = t.replace(/(今日の?|明日の?|明後日の?|今から|今すぐ)/g, '');
  t = t.replace(/(午後|午前|夕方|夜|朝)は?/g, '');
  t = t.replace(/\d{1,2}時((\d{1,2})分|半)?(ごろ|頃)?(から|に|まで|までに)?/g, '');
  t = t.replace(/\d{1,2}分間?/g, '');
  t = t.replace(/\d{1,2}時間/g, '');

  // 2. フィラー除去
  t = t.replace(/(えっと|えーと|まあ|ちょっと|なんか|やっぱり|とりあえず|一応)/g, '');

  // 3. 複合表現を先に処理（分割前に）
  t = t.replace(/かどうかの?/g, 'の');
  t = t.replace(/その後/g, '|');
  t = t.replace(/、/g, '|');

  // 4. 文末動詞パターンを区切り「|」に置換（文の切れ目を検出）
  //    長いパターンから順に。直前の助詞も一緒に除去。
  t = t.replace(/(を|に|が|は|で|と)?(行い|行な|おこない)ます/g, '|');
  t = t.replace(/(を|に|が)?(します|しました|したい(です)?|するつもり|する予定|する(?![たてな]))/g, '|');
  t = t.replace(/(を|に|が|は|で|と)?(行う|行った)(予定|つもり|こと)?/g, '|');
  t = t.replace(/(に|へ|を)?(行きます|行きたい(です)?|行く|向かいます|向かう|出かけます|出かける)/g, '|');
  t = t.replace(/(を|が)?(やります|やりたい(です)?|やる)/g, '|');
  t = t.replace(/(を|が)?(始めます|始める|終わらせます|終わらせる|終えます|終える)/g, '|');
  t = t.replace(/(を|が)?(できます|できる)/g, '|');
  t = t.replace(/(を)?(浴びます|浴びる|浴びて)/g, '|');
  t = t.replace(/(を)?(買います|買う|買いに)/g, '|');
  t = t.replace(/(を)?(食べます|食べる|飲みます|飲む|読みます|読む|見ます|見る|聞きます|聞く|書きます|書く|作ります|作る|洗います|洗う)/g, '|');
  t = t.replace(/(に)?(励み|励め|頑張り|頑張れ|取り組み|努め)(ます|ました)?/g, '|');
  t = t.replace(/(ます|ました|ません)/g, '|');
  t = t.replace(/(です|でした)/g, '|');

  // 5. 接続表現も区切りに（「か」は単独では危険なので「〜か〜」のパターンのみ）
  t = t.replace(/(それか|または|もしくは)/g, '|');
  t = t.replace(/(それから|それと|それで|そして|あと(?=\s))/g, '|');
  // 「AかB」パターン: 前後に名詞があるときのみ
  t = t.replace(/(?<=[\u3040-\u9fff])か(?=[\u3040-\u9fff])/g, '|');

  // 6. 区切りで分割
  const segments = t.split('|');

  const keywords: string[] = [];
  for (let seg of segments) {
    // 空白整理
    seg = seg.replace(/\s+/g, '').trim();
    if (!seg) continue;

    // 7. 移動表現除去: 「職場に行って」→ 後続のタスクが本題
    seg = seg.replace(/.{1,6}(に行って|へ行って|に向かって|へ向かって)/g, '');

    // 8. 中間の「〜て」接続を「・」に分割: 「着替えて職場」→「着替え・職場」
    seg = seg.replace(/(?<=[\u3040-\u9fff]{2,})て(?=[\u3040-\u9fff]{2,})/g, '・');

    // 9. 末尾の動詞語幹・て形を除去
    seg = seg.replace(/(して|って|て)$/g, '');
    seg = seg.replace(/(を|が)?(買い|売り|洗い|浴び|書き|読み|飲み|食べ|見|聞き|作り|直っ?た|行っ?た|なっ?た)$/g, '');

    // 9b. 助詞+動詞語幹の残骸を除去（ます除去やて分割後に残るもの）
    seg = seg.replace(/(を|に)(し|やり|行い|行ない|励み|励め|頑張り|取り組み|努め)$/g, '');
    seg = seg.replace(/(をし|にし)・/g, '・');

    // 10. 中間の修飾節を簡略化: 「修正が直ったの確認」→「修正確認」
    seg = seg.replace(/(が|を|は).{1,6}(った|った|ている|てる|ない)の/g, '');

    // 11. 末尾の助詞除去
    seg = seg.replace(/(を|に|が|は|で|と|も|へ)$/g, '');
    // 先頭のゴミ・助詞除去
    seg = seg.replace(/^(を|に|が|は|で|と|も|へ|の|それ|これ|あれ|ら|。|\s|、)+/g, '');

    seg = seg.trim();
    if (seg && seg.length > 0) {
      keywords.push(seg);
    }
  }

  // 重複除去
  const unique = [...new Set(keywords)];
  const result = unique.join(' / ');
  return result || input.trim();
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
  "description": "元の入力内容を自然な日本語で要約（何をするか・補足情報）",
  "durationMinutes": 所要時間（分・整数）,
  "deadline": "締切がある場合はISO 8601形式、なければnull",
  "preferredStartTime": "開始時刻が指定されている場合はISO 8601形式、なければnull",
  "category": "仕事/勉強/運動/家事/買い物/その他 のいずれか"
}

重要なルール:

1. title（タイトル）:
- 名詞・名詞句のみ。動詞・文末表現・助詞は絶対に入れない。
- 「〜します」「〜したい」「〜に行く」「〜に励む」「〜を行う予定」等は全て除去し、核となるキーワードだけ残す。
- 複数のタスクは「/」で区切る。
- 例:
  「バイブコーディングをします」→ 「バイブコーディング」
  「床屋に行きたい」→ 「床屋」
  「午後は職場に行って仕事をします」→ 「仕事」
  「勉強します」→ 「勉強」
  「瞑想をします それから着替えて職場に向かいます」→ 「瞑想 / 着替え / 出勤」
  「夕方19時からバイブコーディングかアンチグラビティの勉強」→ 「バイブコーディング / アンチグラビティ勉強」
  「今からバイブコーディングのテストをします 修正が直ったかどうかの確認をします」→ 「バイブコーディング テスト / 修正確認」
  「ストレッチをして柔軟に励みます」→ 「ストレッチ / 柔軟体操」
  「20時からランニングを行う予定です」→ 「ランニング」
  「筋トレとヨガをやります」→ 「筋トレ / ヨガ」

2. description（詳細）:
- ユーザーが言った内容を自然で簡潔な文にまとめる。時刻や所要時間の情報は含めない。
- 例:
  「バイブコーディング、またはアンチグラビティの勉強をする予定」
  「ストレッチと柔軟体操を行う」
  「ランニングで体を動かす」

3. preferredStartTime（開始時刻）:
- 「9時から〜」「14時に〜」「4時半に〜」→ preferredStartTimeを設定。
- 「明日の4時半から」→ 明日の04:30をpreferredStartTimeに設定。
- 「明後日9時から」→ 明後日の09:00をpreferredStartTimeに設定。
- 日付指定がなければ今日の日付を使う。
- 「X時半」は X:30 を意味する。

4. durationMinutes（所要時間）:
- 「4時半から6時まで」→ 開始=4:30、終了=6:00、durationMinutes=90。preferredStartTimeは4:30。
- 「15分間ランニング」→ durationMinutes=15。
- 「1時間勉強」→ durationMinutes=60。
- 「〜まで」は終了時刻。開始時刻との差をdurationMinutesにする。
- 明示的な時間指定がなければ常識的に推定（トレーニング→60分、買い物→30分、会議→60分など）。

5. deadline（締切）:
- 「〜時までに完成させる」「〜日が期限」→ deadlineを設定。
- 「〜まで」が終了時刻の意味（「6時まで勉強」）の場合はdeadlineではなくdurationMinutesの計算に使う。

6. 時刻の午前/午後:
- 1〜11の数字は午前として扱う。「5時」→ 05:00。
- 「午後」「夜」「夕方」が付く場合、または13以上は午後。「午後5時」→ 17:00。`;

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
    description: parsed.description || input,
    durationMinutes: parseInt(parsed.durationMinutes, 10) || 30,
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
  if (local.durationExplicit) {
    aiResult.durationMinutes = local.durationMinutes;
  }

  return aiResult;
}
