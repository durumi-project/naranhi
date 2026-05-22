// 키워드 1단계 안전 분기 — LLM 호출 전 빠른 위기 신호 감지.
//
// 정책 (CLAUDE.md §2-3):
// - 가정폭력·자해·자살 키워드 매치 시 *LLM 호출을 생략*하고 즉시 SafetyBranch 응답 반환.
// - 1단계를 통과해도 LLM 응답에서 safety_signals.has_safety_flag=true 면 2단계 분기.
// - 1단계의 *위양성(false positive)* 허용 — 안전한 사용자에게 안전 안내가 한 번 더 떠도 무방.
// - 1단계의 *위음성(false negative)*은 LLM 2단계에서 보완 (이중 방어).

const KEYWORD_GROUPS = {
  domestic_violence: {
    label: '가정폭력',
    keywords: [
      '아빠가 때려',
      '엄마가 때려',
      '아빠가 무서워',
      '엄마가 무서워',
      '집에 가기 싫',
      '집에 들어가기 싫',
      '아빠가 자꾸 때',
      '엄마가 자꾸 때',
      '부모님이 때려',
      '집에서 맞',
      '집에서 폭행',
    ],
  },
  self_harm: {
    label: '자해·자살',
    keywords: [
      '죽고 싶',
      '다 끝내고 싶',
      '사라지고 싶',
      '없어지고 싶',
      '이미 시도했',
      '자해',
      '자살',
      '목숨을 끊',
      '뛰어내리',
      '약을 먹',
      '베어버리',
      '아무도 모르게 끝',
    ],
  },
  immediate_danger: {
    label: '즉시 위험',
    keywords: [
      '지금 위험',
      '도와주세요',
      '도망쳤어',
      '경찰 불러',
      '병원에 있',
      '응급실',
    ],
  },
};

const SAFETY_RESOURCES = [
  { name: '자살예방상담', number: '1393', available: '24시간' },
  { name: '청소년 상담1388', number: '1388', available: '24시간' },
  { name: '정신건강위기상담', number: '1577-0199', available: '24시간' },
  { name: '여성긴급전화', number: '1366', available: '24시간' },
  { name: '긴급신고', number: '112', available: '24시간' },
];

/**
 * 학생 입력에서 위기 신호 키워드 감지.
 *
 * @param {string} input — 학생 자유 텍스트 (sanitize 전이라도 무방)
 * @returns {{ triggered: boolean, group: string|null, matched: string|null, resources: object[] }}
 */
export function scanSafetyKeywords(input) {
  if (!input || typeof input !== 'string') {
    return { triggered: false, group: null, matched: null, resources: [] };
  }
  const normalised = input.replace(/\s+/g, ' ');
  for (const [group, def] of Object.entries(KEYWORD_GROUPS)) {
    for (const kw of def.keywords) {
      if (normalised.includes(kw)) {
        return {
          triggered: true,
          group,
          group_label: def.label,
          matched: kw,
          resources: SAFETY_RESOURCES,
        };
      }
    }
  }
  return { triggered: false, group: null, matched: null, resources: [] };
}

/**
 * 1단계 안전 분기로 LLM 호출을 우회할 때 반환할 응답 객체.
 * /api/classify 의 응답 스키마와 정합.
 */
export function buildSafetyBranchResponse(scan) {
  return {
    matched_case_ids: [],
    friendly_response:
      '걱정되는 상황이 보여요. 지금 도움 받을 수 있는 곳을 먼저 알려드릴게요. 학교폭력 안내보다 *지금 안전*이 우선이에요.',
    safety_signals: {
      has_safety_flag: true,
      reason: scan.group_label ?? '위기 신호',
    },
    confidence: 1.0,
    _safety_meta: {
      stage: 'keyword_pre_llm',
      group: scan.group,
      resources: scan.resources,
    },
  };
}

export const _internal = { KEYWORD_GROUPS, SAFETY_RESOURCES };
