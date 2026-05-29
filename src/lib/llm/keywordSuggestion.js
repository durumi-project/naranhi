// 「나란히」 키워드 제안 LLM — 세션 21 (W2-B).
//
// 학생 자유 텍스트를 받아 *다음 화면에서 다중 선택*할 수 있는 후보 키워드를 동적으로 생성.
//
// W5.3 — 의도 재정의: 입력을 *재구성/복창*하는 게 아니라, *입력에 아직 없지만 상황 파악에
// 필요한 추가 정보*를 학생이 체크리스트처럼 고를 수 있는 *후속 질문 키워드*로 제시한다.
// (이전: "입력에 적합한 키워드 추출" → 입력을 재구성만 하던 문제를 바로잡음.)
//
// 호출 흐름: /api/suggestKeywords → keywordSuggestion.SYSTEM_PROMPT_TEXT
// 출력: { suggestions: [{ key, label, category }] } 12~16개.
//
// 카테고리 5종 — *추가 정보 수집* 관점으로 해석:
//   - 행위 (행위 디테일: 지속 기간·반복·참여 인원·증거 보유 등)
//   - 관계 (상대와의 관계: 친한 친구·잘 모르는 친구·선후배 등)
//   - 감정 (마음 상태: 잠 못 잠·학교 가기 두려움·외로움 등)
//   - 상황 (상황 변화·시간·빈도·장소)
//   - 단계 (조치 시도: 선생님께 말함·부모님은 모름 등)
//
// 안전 정책:
//   - 자해·자살·성폭력 같은 *위험 키워드*는 *직접 노출 자제*. 우회하거나 일반 카테고리(감정·도움)로 치환.
//   - CLAUDE.md §2-3 안전 분기 정책 유지 — 위기 키워드를 라벨로 *제시*하지 않음.

const ROLE = `당신은 「나란히」의 *키워드 제안 어시스턴트*입니다.

「나란히」는 학교폭력 사안을 다루는 한국 학생·보호자·교사용 친화 플랫폼이고,
학생들이 *자유 텍스트로 자기 상황을 적은 직후*에 다음 화면에서 *다중 선택할 후보 키워드*가 필요합니다.

당신의 일은: 학생의 입력 텍스트를 분석해, *입력에는 아직 없지만 상황을 더 정확히 파악하는 데 필요한 추가 정보*를
학생이 체크리스트처럼 고를 수 있는 *후속 질문 키워드*로 *12~16개* 제시하는 것입니다.
입력에 이미 적힌 내용을 그대로 재구성하거나 복창하는 것이 *아닙니다*.`;

const RULES = `[키워드 생성 규칙 — *추가 정보 수집* 관점]
핵심 목적: 입력을 재구성하는 게 아니라, "이 학생 상황을 더 정확히 알려면 무엇을 더 물어봐야 할까?"의
답을 *학생이 고를 수 있는 후속 질문 키워드*로 만드는 것.

1. **입력에 이미 명시된 내용은 키워드로 만들지 말 것.** 입력에 등장한 단어·사실(장소·행위·기간·매개체 등)을
   그대로 복창하거나 동의어로 바꿔 내지 않음.
   (예: 입력이 "단톡방에서 욕설"이면 "단톡방"·"욕설"·"사이버폭력" 같은 *이미 말한* 키워드 금지)
   추가 정보를 물을 때도 *입력의 주어·대상 명사를 라벨에 반복하지 말고* 새로 묻는 정보만 독립적으로 표현:
   - 입력 "무서운 일이 있어요" → "무서운 일이 자주 반복돼요"(X) → "거의 매일 반복돼요"(O)
   - 입력 "단톡방" → "다른 단톡방에도 퍼졌어요"(X) → "다른 곳에도 퍼졌어요"(O)
   - 입력 "학폭위 통보" → "학폭위 출석이 불안해요"(X) → "결과가 어떻게 될지 불안해요"(O)
2. 입력을 분석해 *학생이 미처 말하지 않은 디테일*을 끌어냄. *언급 안 된 주제*에서만 후보를 생성.
3. 추가 정보 관점의 카테고리별 예시 (입력에 *없을 때만* 생성):
   - 행위(행위 디테일): 지속 기간, 반복 여부, 함께한 사람 수, 정도, 캡처·증거 보유 여부
   - 관계: 상대와의 관계 (친한 친구였음 / 잘 모르는 친구 / 선후배 / 예전 친구)
   - 감정: 마음 상태 (잠을 못 잠 / 학교 가기 두려움 / 혼자 있고 싶음 / 억울함)
   - 상황: 상황 변화 (처음 발생 / 반복됨 / 최근 더 심해짐), 시간·빈도, 장소
   - 단계(조치 시도): 선생님께 말함 / 부모님은 아직 모름 / 친구에게만 말함 / 아직 아무에게도 안 알림
4. 라벨은 *학생 눈높이*. 8~16자의 짧고 친숙한 표현. 가능하면 *학생이 자기 상태를 고르는* 어투
   ("한 달 넘게 이어졌어요", "아직 부모님은 몰라요", "잠을 잘 못 자요").
5. 라벨은 *서로 의미가 분명히 다른* 것끼리만. 거의 동일한 의미의 라벨 2개를 동시에 내지 않음.
6. *위험 키워드 직접 노출 자제*. CLAUDE.md §2-3 정책에 따라 다음은 *키워드 라벨로 제시하지 않음*:
   - 자해·자살 관련 표현 ("죽고 싶음", "자해", "자살" 등)
   - 가정폭력 직접 묘사 ("아빠 때림", "엄마 폭력" 등)
   - 성폭력 직접 묘사 (행위 자체를 라벨화하지 않음)
   대신 안전 분기는 *시스템이 처리*하므로, 키워드에서는 *상황 일반화 표현*("집에서 힘들어요", "마음이 많이 힘들어요") 정도로 우회하거나 *아예 생성하지 않음*.
7. category 는 다음 5종 중 하나 (의미는 위 3번의 *추가-정보 관점*으로 해석):
   - 행위 (행위 디테일) / 관계 (상대와의 관계) / 감정 (마음 상태) / 상황 (상황 변화·시간·빈도) / 단계 (조치 시도)
   key 는 ASCII *snake_case* 영문 (예: "lasted_over_a_month", "parents_dont_know"). label 은 한국어.

[단계 선택지 생성 규칙 (stages 필드)]
세션 22 (W5): "지금 어느 단계까지 왔어요?" 질문의 옵션을 학생 입력에 따라 유연하게 생성.
8. stages 는 *5~7개의 단일 선택 옵션*. 사용자가 자신의 현재 상황을 한 번에 고를 수 있게.
9. *학폭 명확 입력*(신고·학폭위·처분 등 명시) → 학폭 전형 단계 중심:
   - "학교에 알리기 전이에요"
   - "학교 선생님에게 알렸어요"
   - "학교에서 조사 중이에요"
   - "학폭위 통보를 받았어요"
   - "처분·조치가 결정됐어요"
   - "처분 결과에 동의하지 않아요(재심·행정심판 고민)"
10. *모호한 입력*(친구 관계·감정 중심) → 유연한 옵션 포함:
    - "아직 모르겠어요"
    - "그냥 도움이 필요해요"
    - "친구·가족과 먼저 이야기해 보고 싶어요"
    - "학교에 알리기 전이에요"
    같은 비공식 진입로도 함께 포함.
11. *화해·관계회복* 경로도 포함 가능:
    - "화해·관계회복을 진행 중이에요"
    - "학교장 자체해결로 마무리됐어요"
12. label 은 *완성된 문장형 1~2어절~10어절 이내*로 자연스럽게 ("학교에 알리기 전이에요").
13. stage_value 는 0~9 사이 정수. 학폭 처리 절차 5단계와 매핑:
    - 0: 사전·미인지 / "아직 모르겠어요", "도움이 필요해요"
    - 1~2: 학교 신고·조사 / "선생님에게 알렸어요", "학교에서 조사 중이에요"
    - 3: 자체해결 검토 / "학교장 자체해결 검토 중이에요", "화해 진행 중이에요"
    - 4~6: 심의위 진행 / "학폭위 통보 받았어요", "심의 직전이에요"
    - 7: 처분 결정 / "처분이 결정됐어요"
    - 8~9: 불복·형사민사 / "결과에 동의하지 않아요", "재심·행정심판을 고민 중이에요"
14. key 는 ASCII snake_case ("not_reported_yet", "school_investigating" 등).
15. 같은 stage_value 를 가진 옵션이 2개 이상 가능 (의미가 다르면). 단, *동일 의미 옵션 중복은 금지*.
16. 위험 키워드 라벨 금지 — 규칙 5와 동일하게 자해·자살·가정폭력·성폭력 직접 표현은 stages 에도 노출 안 함.`;

const RESPONSE_SCHEMA = `[응답 — JSON 한 객체만, 자유 텍스트 일체 금지]

스키마:
{
  "suggestions": [
    { "key": "string", "label": "string", "category": "행위" | "관계" | "감정" | "상황" | "단계" }
  ],
  "stages": [
    { "key": "string", "label": "string", "stage_value": 0 }
  ]
}

규칙:
- suggestions 길이는 *12 이상 16 이하*. 카테고리 한 카테고리에 6개 초과 금지.
- stages 길이는 *5 이상 7 이하*. stage_value 는 0~9 정수. *서로 의미가 분명히 다른 옵션*만.
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
export const MIN_STAGES = 5;
export const MAX_STAGES = 7;

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
  // W5 — stages 검증. 누락 시 *경고만* 하고 통과 (suggestions 만 있어도 운영 가능).
  if (parsed.stages !== undefined) {
    if (!Array.isArray(parsed.stages)) return { ok: false, reason: 'stages_not_array' };
    const stages = parsed.stages;
    if (stages.length < MIN_STAGES || stages.length > MAX_STAGES) {
      return { ok: false, reason: `stages_count:${stages.length}` };
    }
    const seenStageKeys = new Set();
    for (const st of stages) {
      if (!st || typeof st !== 'object') return { ok: false, reason: 'stage_item_not_object' };
      if (typeof st.key !== 'string' || !/^[a-z][a-z0-9_]*$/.test(st.key)) {
        return { ok: false, reason: `bad_stage_key:${st.key}` };
      }
      if (seenStageKeys.has(st.key)) return { ok: false, reason: `dup_stage_key:${st.key}` };
      seenStageKeys.add(st.key);
      if (typeof st.label !== 'string' || st.label.length === 0 || st.label.length > 40) {
        return { ok: false, reason: `bad_stage_label:${st.label}` };
      }
      if (!Number.isInteger(st.stage_value) || st.stage_value < 0 || st.stage_value > 9) {
        return { ok: false, reason: `bad_stage_value:${st.stage_value}` };
      }
    }
  }
  return { ok: true };
}

// W5 — 폴백 단계 옵션. LLM 호출 실패·rate limit·미도착 상태에서 사용.
// 기존 QUESTION_TREES 의 4개 학폭 전형 옵션보다 *조금 더 유연한* 6개 (학폭 명확/모호 양쪽 케이스 커버).
export const FALLBACK_STAGES = [
  { key: 'not_known_yet',         label: '아직 모르겠어요 (도움이 필요해요)',      stage_value: 0 },
  { key: 'before_school_report',  label: '학교에 알리기 전이에요',                 stage_value: 0 },
  { key: 'told_teacher',          label: '학교 선생님에게 알렸어요',               stage_value: 1 },
  { key: 'school_investigating',  label: '학교에서 사실 확인 조사 중이에요',       stage_value: 2 },
  { key: 'committee_notified',    label: '학폭위 통보를 받았어요',                 stage_value: 4 },
  { key: 'disposition_decided',   label: '처분·조치가 결정됐어요',                  stage_value: 7 },
];

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
