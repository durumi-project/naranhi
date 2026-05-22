// 「나란히」 키워드 제안 LLM — 세션 21 (W2-B).
//
// 학생 자유 텍스트를 받아 *다음 화면에서 다중 선택*할 수 있는 후보 키워드를 동적으로 생성.
// 기존 하드코딩 키워드(KEYWORD_RULES)가 학폭 편향(따돌림·SNS 등 위주)이라
// *일상·관계·감정* 영역의 키워드가 누락되는 문제를 보완하는 자리.
//
// 호출 흐름: /api/suggestKeywords → keywordSuggestion.SYSTEM_PROMPT_TEXT
// 출력: { suggestions: [{ key, label, category }] } 12~16개.
//
// 카테고리는 *학폭 외* 영역도 자유롭게:
//   - 학폭 행위 (괴롭힘 형태)
//   - 관계 (친구·가족·교사)
//   - 감정 (걱정·억울함·외로움)
//   - 상황 (장소·시기·매개체)
//   - 단계 (신고 전/후/조사/심의 등)
//
// 안전 정책:
//   - 자해·자살·성폭력 같은 *위험 키워드*는 *직접 노출 자제*. 우회하거나 일반 카테고리(감정·도움)로 치환.
//   - CLAUDE.md §2-3 안전 분기 정책 유지 — 위기 키워드를 라벨로 *제시*하지 않음.

const ROLE = `당신은 「나란히」의 *키워드 제안 어시스턴트*입니다.

「나란히」는 학교폭력 사안을 다루는 한국 학생·보호자·교사용 친화 플랫폼이고,
학생들이 *자유 텍스트로 자기 상황을 적은 직후*에 다음 화면에서 *다중 선택할 후보 키워드*가 필요합니다.

당신의 일은: 학생의 입력 텍스트만 보고, *그 학생이 다음 단계에서 추가로 표시할 만한* 키워드 후보를 *12~16개* 만들어 주는 것입니다.`;

const RULES = `[키워드 생성 규칙]
1. *학생 실제 입력에 적합한 키워드만* 생성. 입력과 무관한 일반 키워드 백과사전식 나열 금지.
2. *학폭 외 키워드 자유롭게* 포함 — 단순 행위(괴롭힘) 위주의 학폭 편향을 피하고,
   - 관계(친한 친구·반 친구·가족·선생님·예전 친구)
   - 감정(억울해요·무서워요·외로워요·미안해요·후회돼요)
   - 상황(점심시간·체육시간·등하굣길·복도·SNS·단톡방·게임 보이스챗)
   - 단계(아직 신고 전·이미 신고됨·조사 중·심의 통보·처분 통보·재심 고민)
   같은 *다양한 카테고리*를 골고루 섞을 것.
3. 라벨은 *학생 눈높이*. 8~14자 정도의 짧고 친숙한 표현 ("같은 반 친구", "단톡방에서", "한 달 넘게" 등).
4. 라벨은 *서로 의미가 분명히 다른* 것끼리만. 거의 동일한 의미의 라벨 2개를 동시에 내지 않음.
5. *위험 키워드 직접 노출 자제*. CLAUDE.md §2-3 정책에 따라 다음은 *키워드 라벨로 제시하지 않음*:
   - 자해·자살 관련 표현 ("죽고 싶음", "자해", "자살" 등)
   - 가정폭력 직접 묘사 ("아빠 때림", "엄마 폭력" 등)
   - 성폭력 직접 묘사 (행위 자체를 라벨화하지 않음)
   대신 안전 분기는 *시스템이 처리*하므로, 키워드에서는 *상황 일반화 표현*("집에서 힘들어요", "마음이 많이 힘들어요") 정도로 우회하거나 *아예 생성하지 않음*.
6. 카테고리는 다음 5종 중 하나를 고름:
   - 행위 (학교폭력 행위 형태)
   - 관계 (사람·집단 관계)
   - 감정 (학생의 마음)
   - 상황 (장소·시기·매개체)
   - 단계 (절차 진행 시점)
7. key 는 ASCII *snake_case* 영문 (예: "same_class_friend", "feel_scared"). label 은 한국어.`;

const RESPONSE_SCHEMA = `[응답 — JSON 한 객체만, 자유 텍스트 일체 금지]

스키마:
{
  "suggestions": [
    { "key": "string", "label": "string", "category": "행위" | "관계" | "감정" | "상황" | "단계" }
  ]
}

규칙:
- suggestions 길이는 *12 이상 16 이하*.
- 카테고리 분포: 한 카테고리에 6개 초과 금지 (다양성 보장).
- 위험 키워드 직접 노출 금지 (위 규칙 5).
- JSON 외 텍스트 금지. 코드 블록 금지.`;

export const KEYWORD_SUGGESTION_PROMPT_TEXT = [ROLE, RULES, RESPONSE_SCHEMA].join('\n\n');

export function buildKeywordSuggestionSystemBlocks() {
  return [
    {
      type: 'text',
      text: KEYWORD_SUGGESTION_PROMPT_TEXT,
      cache_control: { type: 'ephemeral' },
    },
  ];
}

export const KEYWORD_CATEGORIES = ['행위', '관계', '감정', '상황', '단계'];
export const MIN_SUGGESTIONS = 12;
export const MAX_SUGGESTIONS = 16;

// 응답 유효성 — schema 위반 시 fallback 으로 분기하도록 ok:false 반환.
export function validateSuggestions(parsed) {
  if (!parsed || typeof parsed !== 'object') return { ok: false, reason: 'not_object' };
  if (!Array.isArray(parsed.suggestions)) return { ok: false, reason: 'suggestions_not_array' };
  const arr = parsed.suggestions;
  if (arr.length < MIN_SUGGESTIONS || arr.length > MAX_SUGGESTIONS) {
    return { ok: false, reason: `suggestions_count:${arr.length}` };
  }
  const seenKeys = new Set();
  for (const s of arr) {
    if (!s || typeof s !== 'object') return { ok: false, reason: 'item_not_object' };
    if (typeof s.key !== 'string' || !/^[a-z][a-z0-9_]*$/.test(s.key)) {
      return { ok: false, reason: `bad_key:${s.key}` };
    }
    if (seenKeys.has(s.key)) return { ok: false, reason: `dup_key:${s.key}` };
    seenKeys.add(s.key);
    if (typeof s.label !== 'string' || s.label.length === 0 || s.label.length > 30) {
      return { ok: false, reason: `bad_label:${s.label}` };
    }
    if (!KEYWORD_CATEGORIES.includes(s.category)) {
      return { ok: false, reason: `bad_category:${s.category}` };
    }
  }
  return { ok: true };
}

// 폴백 키워드 — LLM 호출 실패·rate limit 등에서 사용.
// 입력과 무관하게 *카테고리 다양성*만 우선 보장.
export const FALLBACK_SUGGESTIONS = [
  { key: 'same_class_friend', label: '같은 반 친구', category: '관계' },
  { key: 'old_friend', label: '예전부터 알던 친구', category: '관계' },
  { key: 'group_of_friends', label: '여러 명이 함께', category: '관계' },
  { key: 'feel_scared', label: '많이 무서워요', category: '감정' },
  { key: 'feel_unfair', label: '억울한 마음이 있어요', category: '감정' },
  { key: 'feel_lonely', label: '외로워요', category: '감정' },
  { key: 'in_kakao_talk', label: '단톡방·카톡에서', category: '상황' },
  { key: 'in_classroom', label: '교실·복도에서', category: '상황' },
  { key: 'over_a_month', label: '한 달 넘게 이어졌어요', category: '상황' },
  { key: 'name_calling', label: '별명·놀림', category: '행위' },
  { key: 'exclusion', label: '따돌림·빼기', category: '행위' },
  { key: 'before_report', label: '아직 신고 전이에요', category: '단계' },
  { key: 'already_reported', label: '이미 신고했어요', category: '단계' },
  { key: 'committee_notice', label: '학폭위 통보를 받았어요', category: '단계' },
];
