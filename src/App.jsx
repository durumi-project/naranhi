import React, { useState, useEffect, useMemo } from 'react';
import {
  Scale, FileText, AlertCircle, ChevronRight, ChevronLeft, Search,
  BookOpen, Shield, Phone, ArrowRight, Check, X, Sparkles,
  Users, Clock, ClipboardList, MessageCircleQuestion, ExternalLink,
  Heart, Info, ChevronDown, ChevronUp, Loader2, Home, RotateCcw,
  AlertTriangle, Code, Zap, Database, PlayCircle,
} from 'lucide-react';

// 데이터 8종 - src/data/*.json (외부화 완료)
// cases는 폴더 자동 병합 — PENDING/ + REVIEWED/ (DEV 기본 둘 다, PROD 기본 REVIEWED만)
import CASES from './data/cases/index.js';
import DOCUMENTS from './data/documents.json';
import LEGAL_TERMS from './data/legal_terms.json';
import FAQS from './data/faqs.json';
import RESOURCES from './data/resources.json';
import QUESTION_TREES from './data/question_trees.json';
import PROCEDURE_STAGES from './data/procedure_stages.json';
import KEYWORD_RULES from './data/keyword_rules.json';
// W4-B — 회의 결과 적용: 상담 기관 카드 강화. 기존 RESOURCES 와는 별도(역할·익명성·홈페이지 필드).
import COUNSELING_RESOURCES from './data/counseling_resources.json';

// M2 LLM 통합 (세션 11) — /api/classify 호출 래퍼.
// 로컬 classify 는 폴백용으로 유지 (네트워크·LLM 실패 시 즉시 동작).
// 세션 21 (W2-B) — /api/suggestKeywords 호출 래퍼 추가.
import { callClassify, callSuggestKeywords, expandMatchedCaseIds } from './lib/llm/clientCall.js';
import { FALLBACK_SUGGESTIONS, FALLBACK_STAGES } from './lib/llm/keywordSuggestion.js';

/* ============================================================================
   「나란히」 프로토타입 v2 — 데이터 구동 버전
   ----------------------------------------------------------------------------
   1·2·3순위 산출물의 결합:
   - 분류 코드표 v1 → 4축 코드 체계
   - 판례 수집 가이드 → 데이터 스키마와 콘텐츠
   - 페르소나 풀 트레이스 P-001 → 6단계 사용자 여정
   ----------------------------------------------------------------------------
   1순위 프로토타입과의 차이:
   - 모든 콘텐츠가 JSON 데이터로 분리됨 (실서비스에서는 파일로 외부화)
   - 입력에 따라 *실제로 다른* 결과가 나옴 (분류·매칭·필터)
   - 안전 분기 / 신뢰도 낮음 / 보호자 대리 등 엣지 케이스 처리
   - 5순위에서 LLM·벡터 DB 연결 시 classify()/textSimilarity()만 교체
   ============================================================================ */









/* LIB — 핵심 로직 함수 */


function inferSchoolLevel(ageBand) {
  const map = {
    '7세 미만':   { school_level: 'ES', under_10: true,  criminal_resp: false, p9_eligible: false },
    '8-10세':     { school_level: 'ES', under_10: false, criminal_resp: false, p9_eligible: false },
    '11-13세':    { school_level: 'ES', under_10: false, criminal_resp: false, p9_eligible: false },
    '14-15세':    { school_level: 'MS', under_10: false, criminal_resp: true,  p9_eligible: false },
    '16-17세':    { school_level: 'HS', under_10: false, criminal_resp: true,  p9_eligible: true },
    '18세 이상':  { school_level: 'OT', under_10: false, criminal_resp: true,  p9_eligible: true },
  };
  return map[ageBand] || { school_level: 'OT' };
}

function classify(text) {
  const t = text.toLowerCase();

  for (const safety of KEYWORD_RULES.SAFETY) {
    if (safety.keywords.some(k => t.includes(k))) {
      return { is_safety_branch: true, safety_action: safety.action, confidence: 1.0 };
    }
  }

  const score = (rules) => {
    const result = {};
    for (const [code, keywords] of Object.entries(rules)) {
      let s = 0;
      for (const kw of keywords) if (t.includes(kw)) s += 1;
      if (s > 0) result[code] = s;
    }
    return result;
  };

  const typeScores = score(KEYWORD_RULES.type);
  const roleScores = score(KEYWORD_RULES.role);
  const stageScores = score(KEYWORD_RULES.stage);

  const top = (scores, fallback) => {
    const entries = Object.entries(scores);
    if (entries.length === 0) return [fallback, 0];
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0];
  };

  const [type_main, typeScore] = top(typeScores, 'PH');
  const [role, roleScore] = top(roleScores, 'V');
  const [stageStr, stageScore] = top(stageScores, '0');
  const stage_signal = parseInt(stageStr);

  const subtypes = [];
  if (type_main !== 'VB' && typeScores.VB > 0) subtypes.push('VB');

  const features = {};
  for (const [feat, kws] of Object.entries(KEYWORD_RULES.features)) {
    features[feat] = kws.some(k => t.includes(k));
  }

  const totalScore = typeScore + roleScore + stageScore;
  const confidence = Math.min(1.0, 0.4 + totalScore * 0.08);

  return {
    is_safety_branch: false,
    type_main, subtypes, role, stage_signal,
    confidence: Math.round(confidence * 100) / 100,
    features,
    raw_scores: { type: typeScores, role: roleScores, stage: stageScores },
  };
}

function selectQuestionTree(type, role) {
  const key = `${type}_${role}`;
  return QUESTION_TREES[key] || QUESTION_TREES.DEFAULT;
}

function matchAppliesTo(userCode, pattern) {
  const u = userCode.split('-');
  const p = pattern.split('-');
  if (u.length !== p.length) return false;
  return p.every((part, i) => part === '*' || part === u[i]);
}

function matchAnyPattern(userCode, patterns) {
  return patterns.some(p => matchAppliesTo(userCode, p));
}

function codeMatchWeight(userCode, patterns) {
  let best = 0;
  for (const p of patterns) {
    if (!matchAppliesTo(userCode, p)) continue;
    const wc = p.split('-').filter(x => x === '*').length;
    const w = wc === 0 ? 1.0 : wc === 1 ? 0.7 : wc === 2 ? 0.5 : wc === 3 ? 0.3 : 0.2;
    best = Math.max(best, w);
  }
  return best;
}

function textSimilarity(userText, caseKeywords) {
  const t = userText.toLowerCase();
  let matches = 0;
  for (const kw of caseKeywords) if (t.includes(kw.toLowerCase())) matches += 1;
  return Math.min(0.95, matches / Math.max(caseKeywords.length, 1));
}

function matchCases(userCode, userText, cases, options = {}) {
  const { topN = 6, threshold = 0.25 } = options;
  const scored = cases.map(c => {
    const codeWeight = codeMatchWeight(userCode, c.applies_to);
    const textSim = textSimilarity(userText, c.keywords);
    const finalScore = textSim * 0.6 + codeWeight * 0.4;
    return { ...c, _scores: {
      text_similarity: Math.round(textSim * 100) / 100,
      code_match: codeWeight,
      final: Math.round(finalScore * 1000) / 1000,
    }};
  });
  scored.sort((a, b) => b._scores.final - a._scores.final);
  return scored.filter(c => c._scores.final >= threshold).slice(0, topN);
}

function filterContent(userCode, contentList, options = {}) {
  const { sortByPriority = true, limit = null } = options;
  let filtered = contentList.filter(c => matchAnyPattern(userCode, c.applies_to));
  if (sortByPriority) {
    const order = { high: 0, mid: 1, low: 2 };
    filtered.sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3));
  }
  return limit ? filtered.slice(0, limit) : filtered;
}

function rankResources(userCode, type, resources) {
  return resources.map(r => {
    let score = 0;
    if (matchAnyPattern(userCode, r.applies_to)) score += 1;
    if (r.priority_for_types?.includes(type)) score += 2;
    if (r.is_emergency) score += 0.5;
    return { ...r, _score: score };
  }).filter(r => r._score > 0).sort((a, b) => b._score - a._score);
}

function selectLegalTerms(userCode, schoolLevel, allTerms, options = {}) {
  const { limit = 6 } = options;
  return allTerms
    .filter(t => matchAnyPattern(userCode, t.applies_to))
    .slice(0, limit)
    .map(t => ({ ...t, plain: t.explanation[schoolLevel] || t.explanation.MS }));
}

/* W4-A2 — 자주 등장하는 4개 어려운 한자어를 *UI 고정 문구* 안에서 자동으로 풀어쓰기.
 *  - LLM friendly_response 는 systemPrompt 의 어조 분기 규칙(D) 으로 이미 처리되므로 손대지 않음.
 *  - 여기서는 카드 제목·요약·면책 같은 *고정 문구* 안에 등장할 때 첫 1회만 괄호 설명을 덧붙인다.
 *  - 입력이 string 이 아닐 때(JSX 등) 는 그대로 반환 — UI 가 깨지지 않도록.
 */
const LEGAL_TERM_GLOSSES = [
  { term: '학교폭력대책심의위원회', gloss: '처분을 결정하는 회의' },
  { term: '심의위원회', gloss: '학교폭력대책심의위원회를 줄여 부르는 말' },
  { term: '행정심판', gloss: '결정에 동의하지 않을 때 다시 검토받는 절차' },
  { term: '행정소송', gloss: '결정에 동의하지 않을 때 법원에서 다투는 절차' },
  { term: '학폭위', gloss: '처분을 결정하는 회의' },
];

function glossLegalTerms(text) {
  if (typeof text !== 'string' || text.length === 0) return text;
  // 이미 괄호가 따라붙은 자리는 건드리지 않는다 — "심의위원회(...)" 같은 패턴.
  let out = text;
  const used = new Set();
  for (const { term, gloss } of LEGAL_TERM_GLOSSES) {
    if (used.has(term)) continue;
    // term 직후 바로 '(' 가 오는 경우(예: '학교폭력대책심의위원회(학폭위)') 는 건드리지 않음.
    const re = new RegExp(`${term}(?!\\s*\\()`, '');
    if (re.test(out)) {
      out = out.replace(re, `${term}(${gloss})`);
      used.add(term);
    }
  }
  return out;
}

/* W4-A1 — 현재 stage 기반 "앞으로 진행될 상황" 예상.
 *  W2-A 학교폭력 처리 절차 5단계와 매핑. 각 항목에 *지금 할 수 있는 일* 1~2개 동봉.
 *  반환값은 *카드로 렌더링할 단계 1~3개* 배열. 단계 끝에 도달했다면 빈 배열.
 */
const STAGE_FORECASTS = {
  0: [
    {
      label: '학교 신고 접수',
      summary: '담임 선생님 또는 학교 전담기구(학교 안에서 학교폭력을 다루는 팀)에 알리면 사안 처리가 시작돼요.',
      do_now: [
        '시간·장소·있었던 일을 짧게 메모로 정리해 두세요.',
        '캡처·사진 같은 증거가 있다면 따로 보관해 두세요.',
      ],
    },
    {
      label: '사실확인·사안조사',
      summary: '학교 전담조사관이 양쪽 학생 이야기를 차분히 들으며 사실을 확인해요. 보통 며칠~몇 주 안에 진행돼요.',
      do_now: ['목격자나 함께 있던 친구를 미리 떠올려 두면 도움이 돼요.'],
    },
    {
      label: '학교장 자체해결 또는 심의위원회 분기',
      summary: '전담기구가 4가지 객관 요건(2주 이상 진단서 / 재산 피해 / 지속성 / 보복) 을 따져 자체해결 가능 여부를 검토해요. 피해 학생·보호자가 동의해야 자체해결이 가능해요.',
      do_now: ['관계회복 프로그램 참여 의사를 미리 생각해 두면 절차가 부드러워질 수 있어요.'],
    },
  ],
  1: [
    {
      label: '사실확인·사안조사',
      summary: '학교 전담조사관이 양쪽 학생 이야기를 들으면서 사실관계를 정리해요.',
      do_now: [
        '확인서를 쓸 때 *기억나는 사실만* 적으세요. 추측·해석은 적지 않아도 돼요.',
        '보호자에게 미리 상황을 공유해 두면 같이 준비할 수 있어요.',
      ],
    },
    {
      label: '학교장 자체해결 또는 심의위원회 분기',
      summary: '전담기구 심의에서 자체해결로 갈지, 심의위원회로 넘길지 결정해요.',
      do_now: ['관계회복 프로그램에 대해 알아 두면 선택지가 넓어져요.'],
    },
    {
      label: '심의·처분(필요 시)',
      summary: '심의위원회가 열리면 사안 심의와 조치(처분) 결정이 이어져요.',
      do_now: ['지금 단계에서는 학교 안내를 따라가도 충분해요.'],
    },
  ],
  2: [
    {
      label: '전담기구 심의 (자체해결 / 심의위 분기)',
      summary: '조사 결과를 바탕으로 학교 전담기구가 *자체해결 가능 여부*를 심의해요. 4가지 객관 요건 + 피해 학생·보호자 동의가 모두 충족되면 자체해결로 종결돼요.',
      do_now: [
        '관계회복 프로그램 권유가 오면 진지하게 검토해 보세요 — 처분과는 별도로 회복을 돕는 절차예요.',
        '피해 학생이라면 *분리 의사*를 다시 한 번 점검해 둘 수 있어요.',
      ],
    },
    {
      label: '심의위원회 심의 (자체해결 불가 시)',
      summary: '교육지원청 학교폭력대책심의위원회가 사안을 심의해 조치(처분)를 결정해요.',
      do_now: ['출석 통보를 받으면 변호사·상담사와 함께 진술 정리를 도울 수 있어요.'],
    },
  ],
  3: [
    {
      label: '심의위원회 심의 통보·심의 (분기점)',
      summary: '자체해결 요건이 충족되지 않으면 교육지원청 심의위원회로 넘어가요. 출석 통보가 오면 일정과 권리가 안내돼요.',
      do_now: ['관계회복 프로그램은 *심의위 단계에서도* 진행될 수 있어요. 권유가 오면 검토해 보세요.'],
    },
    {
      label: '처분 결정·통보',
      summary: '심의위원회가 결정한 조치(처분)를 학교를 통해 통보받게 돼요.',
      do_now: ['결과에 동의하지 않는 경우 *재심·행정심판·행정소송*이라는 다음 단계가 있어요.'],
    },
  ],
  4: [
    {
      label: '심의위원회 심의 진행',
      summary: '심의 당일에는 양측 진술을 듣고 위원들이 협의해 조치를 결정해요. 보통 1회 회의로 진행돼요.',
      do_now: [
        '진술서·증거 자료를 미리 정리해 두세요.',
        '보호자 동석 또는 변호사 조력을 신청할 수 있어요.',
      ],
    },
    {
      label: '처분 결정·통보',
      summary: '심의가 끝나면 조치(처분) 결정을 학교를 통해 안내받아요. 보통 1~2주 안에 통보돼요.',
      do_now: ['통보 후 *행정심판* 청구 기한은 90일 이내예요. 기한을 메모해 두세요.'],
    },
  ],
  5: [
    {
      label: '심의·처분 결정·통보',
      summary: '심의위원회가 결정을 마치고 학교를 통해 조치 내용을 통보해요.',
      do_now: [
        '결과를 받으면 처분 종류와 *생활기록부 기재 여부·기간*을 함께 확인하세요.',
        '동의하지 않는 결정이면 다음 안내(불복 절차)를 검토할 수 있어요.',
      ],
    },
  ],
  6: [
    {
      label: '처분 결정·통보',
      summary: '결정 내용이 학교를 통해 안내돼요. 보통 1~2주 안에 통보돼요.',
      do_now: ['통보 후 *행정심판* 청구 기한은 90일 이내예요.'],
    },
    {
      label: '조치 이행·불복',
      summary: '결정된 조치를 학교 일정에 따라 이행하거나, 동의하지 않을 경우 재심·행정심판을 검토할 수 있어요.',
      do_now: ['이행 일정을 정확히 확인하고, 불복을 고민한다면 변호사·두루 공익법센터 상담을 추천해요.'],
    },
  ],
  7: [
    {
      label: '조치 이행·불복',
      summary: '결정된 조치를 이행하거나, 결과에 동의하지 않으면 *재심·행정심판·행정소송*을 검토할 수 있어요.',
      do_now: [
        '행정심판 청구는 통지 받은 날로부터 90일 이내예요.',
        '학교에서 안내하는 이행 일정을 정확히 메모해 두세요.',
      ],
    },
    {
      label: '생활기록부 기재 처리',
      summary: '처분 종류에 따라 학교생활기록부 기재 여부와 보존 기간이 정해져요.',
      do_now: ['기재가 부담된다면 변호사 상담을 통해 다음 절차를 검토해 보세요.'],
    },
  ],
  8: [
    {
      label: '재심·행정심판·행정소송 결과',
      summary: '재심·행정심판·행정소송 절차의 결과에 따라 원처분이 유지·변경·취소될 수 있어요.',
      do_now: ['절차 진행 중에는 변호사·두루 공익법센터에 정기적으로 상황을 공유해 두세요.'],
    },
    {
      label: '형사·민사 병행 검토',
      summary: '필요에 따라 형사 고소·민사 손해배상이 같이 진행될 수 있어요.',
      do_now: ['형사·민사 절차는 학폭위 결과와 별도로 진행돼요. 변호사 안내를 받는 것이 안전해요.'],
    },
  ],
  9: [
    {
      label: '형사·민사 절차 진행',
      summary: '학교 안 절차와 별도로 형사·민사 절차가 진행돼요. 학교 안 절차의 결과가 직접 형사·민사 결과로 이어지진 않아요.',
      do_now: ['전 과정에서 변호사 동행을 권장해요. 두루 공익법센터에 상담을 신청해 보세요.'],
    },
  ],
};

function getStageForecast(stageNum) {
  const safe = Number.isInteger(stageNum) ? Math.min(Math.max(stageNum, 0), 9) : 0;
  return STAGE_FORECASTS[safe] || [];
}

/* ============================================================================
   DESIGN TOKENS
   ============================================================================ */
const C = {
  bg: '#FAF5E4', bgSoft: '#F4ECCF', card: '#FFFFFF', cardWarm: '#FFF9E6',
  ink: '#1F2D1F', inkSoft: '#4A5A4A', inkMute: '#7B8A7B',
  line: '#E5DCB8', lineSoft: '#EFE7C9',
  accent: '#3F5D3F', accentInk: '#FFFFFF',
  amber: '#E8B547', amberDeep: '#C68A1F',
  tagYellow: '#F4E5A1', tagBlue: '#D6E4D6', tagRed: '#F5D5C3',
  danger: '#B5483A',
};

/* ============================================================================
   DEMO PERSONAS — 4순위 핵심 검증 도구
   ============================================================================ */

/* W5-1 — 데모 카드 친화 제목 자동 추출.
 *  - "15세 단톡방 외모 비하, 학폭위 통보" → "단톡방 외모 비하"
 *  - summary 의 첫 콤마 앞 절을 가져오고, 앞부분 "NN세 " 접두를 떼는 식.
 *  - 12자 넘어가면 줄임표.
 *  - summary 가 비어있으면 label 폴백. */
function derivePersonaTitle(p) {
  const raw = (p.summary ?? p.label ?? '').toString().trim();
  if (!raw) return '데모';
  const firstClause = raw.split(/[,，]/, 1)[0].trim();
  const stripped = firstClause.replace(/^(만\s*)?\d+\s*세\s+/, '').trim();
  const out = stripped.length > 0 ? stripped : firstClause;
  return out.length > 12 ? `${out.slice(0, 12)}…` : out;
}

const DEMO_PERSONAS = [
  {
    id: 'P-001', emoji: '📱', label: '사이버 가해자',
    expected_code: 'SV-CY-G-4-MS', age_band: '14-15세', gender: '남자',
    text: '교실에서 같은 반 친구와 카톡 단체방에서 외모로 별명을 지어서 좀 놀렸어요. 처음엔 친구도 같이 웃어서 그냥 장난인 줄 알았어요. 근데 어느 순간부터 그만하라고 했는데도 계속해서 한 달 동안 했어요. 그래서 학폭으로 신고당했고, 학폭위에 출석하라는 통보를 받았어요. 평소에 친했던 친구라 너무 억울하고 무서워요.',
    summary: '15세 단톡방 외모 비하, 학폭위 통보',
  },
  {
    id: 'P-005', emoji: '😢', label: '초등 따돌림 피해',
    expected_code: 'SV-OS-V-0-ES', age_band: '11-13세', gender: '여자',
    text: '저는 학교에서 한 달 정도 따돌림을 당하고 있어요. 친구들이 저한테 말도 안 걸고 모둠활동에서도 빼요. 너무 힘든데 신고할까 말까 고민돼요. 아직 학교에는 알리지 않았어요.',
    summary: '12세 학급 따돌림, 미신고 단계',
  },
  {
    id: 'P-007', emoji: '🎮', label: '쌍방 사이버',
    expected_code: 'SV-CY-B-2-HS', age_band: '16-17세', gender: '남자',
    text: '게임 보이스챗에서 같은 학교 친구랑 서로 욕설을 주고받았어요. 양쪽 다 신고를 했고 지금 학교에서 사실 확인 조사 중이에요. 둘 다 잘못한 건 맞는데 어떻게 될지 모르겠어요.',
    summary: '17세 게임 보이스챗 쌍방, 조사 단계',
  },
  {
    id: 'SAFETY', emoji: '🚨', label: '안전 분기',
    expected_code: '(안전 분기)', age_band: '14-15세', gender: '여자',
    text: '집에서 매일 아빠가 때려요. 너무 무서워요. 도망치고 싶어요.',
    summary: '14세 가정폭력, 안전 분기 트리거',
  },
];

/* ============================================================================
   COMPONENTS
   ============================================================================ */

function GlobalStyles() {
  return (
    <style>{`
      @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css');
      @import url('https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap');
      * { box-sizing: border-box; }
      html, body, #root { background: ${C.bg}; }
      body { font-family: 'Pretendard', -apple-system, sans-serif; color: ${C.ink}; -webkit-font-smoothing: antialiased; margin: 0; }
      .font-display { font-family: 'Gowun Batang', 'Pretendard', serif; letter-spacing: -0.02em; }
      .font-mono { font-family: ui-monospace, 'SF Mono', monospace; }
      @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
      .anim-fade-up { animation: fadeUp 0.5s ease-out both; }
      .anim-fade-in { animation: fadeIn 0.4s ease-out both; }
      .anim-spin { animation: spin 1s linear infinite; }
      .anim-pulse { animation: pulse 1.6s ease-in-out infinite; }
      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-thumb { background: ${C.line}; border-radius: 4px; }
      .chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; font-size: 13px; font-weight: 500; white-space: nowrap; }
      .btn-primary { background: ${C.accent}; color: ${C.accentInk}; padding: 14px 28px; border-radius: 14px; font-weight: 600; font-size: 16px; border: none; cursor: pointer; transition: all 0.15s; display: inline-flex; align-items: center; gap: 8px; }
      .btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 20px -8px ${C.accent}88; }
      .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
      .btn-ghost { background: transparent; color: ${C.ink}; padding: 12px 20px; border-radius: 12px; font-weight: 500; border: 1px solid ${C.line}; cursor: pointer; transition: background 0.15s; display: inline-flex; align-items: center; gap: 6px; }
      .btn-ghost:hover { background: ${C.bgSoft}; }
      .btn-danger { background: ${C.danger}; color: white; padding: 14px 24px; border-radius: 14px; font-weight: 600; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }
      .card-base { background: ${C.card}; border: 1px solid ${C.lineSoft}; border-radius: 18px; transition: all 0.2s; }
      .card-hover:hover { transform: translateY(-2px); box-shadow: 0 12px 30px -16px rgba(31, 45, 31, 0.18); border-color: ${C.line}; }
      .pill-toggle { padding: 12px 18px; border-radius: 14px; border: 1.5px solid ${C.line}; background: ${C.card}; cursor: pointer; transition: all 0.15s; font-size: 15px; font-weight: 500; color: ${C.ink}; }
      .pill-toggle:hover { border-color: ${C.amber}; background: ${C.cardWarm}; }
      .pill-toggle.active { border-color: ${C.accent}; background: ${C.accent}; color: white; }
      .pretty-input { width: 100%; padding: 16px 18px; border-radius: 14px; border: 1.5px solid ${C.line}; background: ${C.card}; font-family: 'Pretendard', sans-serif; font-size: 15px; color: ${C.ink}; resize: vertical; line-height: 1.6; transition: all 0.15s; }
      .pretty-input:focus { outline: none; border-color: ${C.accent}; box-shadow: 0 0 0 3px ${C.accent}22; }
    `}</style>
  );
}

function Header({ onHome, showBack, onBack }) {
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 50, background: `${C.bg}f0`, backdropFilter: 'blur(12px)', borderBottom: `1px solid ${C.lineSoft}` }}>
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <button onClick={onHome} className="flex items-center gap-2.5" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: C.accent, display: 'grid', placeItems: 'center' }}>
            <Scale size={18} color="white" strokeWidth={2.2} />
          </div>
          <div className="flex flex-col items-start leading-tight">
            <span className="font-display text-lg font-bold" style={{ color: C.ink }}>나란히</span>
            <span className="text-[11px]" style={{ color: C.inkMute }}>ver.3</span>
          </div>
        </button>
        <div className="flex items-center gap-2">
          {showBack && <button onClick={onBack} className="btn-ghost text-sm"><ChevronLeft size={16} /> 이전</button>}
          <button onClick={onHome} className="btn-ghost text-sm"><Home size={15} /> 처음으로</button>
        </div>
      </div>
    </header>
  );
}

function ProgressBar({ step, total }) {
  // 세션 21 (W2-B): [이게 맞을까요?] 화면을 [몇 가지만 더 확인할게요]에 통합 → 사용자 흐름 6→5단계.
  // step 인덱스는 0~5 그대로 유지하지만 진행 표시는 *1~4 의 4개 active step* 으로 보임.
  const pct = (step / total) * 100;
  const labels = ['시작', '나에 대해', '사건 이야기', '확인·키워드', '분석', '결과 안내'];
  return (
    <div className="max-w-6xl mx-auto px-6 pt-6 pb-2">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium" style={{ color: C.inkSoft }}>
          {labels[step] || ''} <span style={{ color: C.inkMute }}>· {step}/{total}</span>
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: C.lineSoft, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${C.amber}, ${C.accent})`, borderRadius: 999, transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

function Landing({ onStart, onDemo }) {
  return (
    <div className="max-w-6xl mx-auto px-6 pt-10 pb-20 anim-fade-in">
      <div className="grid md:grid-cols-12 gap-10 items-center mb-12">
        <div className="md:col-span-7 anim-fade-up">
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <div className="chip" style={{ background: C.tagYellow, color: C.amberDeep }}>
              <Sparkles size={14} /> ver.3
            </div>
            <div className="chip" style={{ background: C.card, color: C.inkSoft, border: `1px solid ${C.lineSoft}` }}>
              14세 이상 학생을 위한 도구
            </div>
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-bold leading-[1.1] mb-6" style={{ color: C.ink }}>
            법은 어렵지 않아요.<br />
            <span style={{ color: C.accent }}>당신의 곁에 나란히</span> 설게요.
          </h1>
          <p className="text-lg leading-relaxed mb-8" style={{ color: C.inkSoft }}>
            학교폭력으로 어려움을 겪고 있다면 당신과 비슷한 사례를 찾아<br />
            지금 어떤 절차에 있는지, 무엇을 준비해야 하는지 쉬운 말로 알려드려요.
          </p>
          <div className="flex flex-wrap gap-3 mb-4">
            <button onClick={onStart} className="btn-primary">지금 시작하기 <ArrowRight size={18} /></button>
          </div>
        </div>
        <div className="md:col-span-5 anim-fade-up" style={{ animationDelay: '0.1s' }}>
          {/* W5-4 — 기존 "데이터 구동 검증" 헤더·문구 박스 제거. 데모 카드만 유지.
              W5-1 — 데모 카드 제목을 코드명(P-001 등) 대신 summary 기반 친화 제목으로. */}
          <div style={{ background: C.cardWarm, border: `1.5px solid ${C.line}`, borderRadius: 28, padding: 24, boxShadow: `0 30px 60px -30px ${C.amber}55` }}>
            <div className="space-y-2">
              {DEMO_PERSONAS.map(p => {
                const title = derivePersonaTitle(p);
                return (
                  <button key={p.id} onClick={() => onDemo(p)} style={{
                    width: '100%', textAlign: 'left', padding: 12,
                    background: C.card, border: `1px solid ${C.lineSoft}`, borderRadius: 12,
                    cursor: 'pointer', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.amber; e.currentTarget.style.transform = 'translateX(2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.lineSoft; e.currentTarget.style.transform = ''; }}>
                    <span style={{ fontSize: 22 }}>{p.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm" style={{ color: C.ink }}>{title}</span>
                        <span className="chip text-[10px]" style={{ background: C.bgSoft, color: C.inkSoft, padding: '2px 8px' }}>
                          {p.age_band}
                        </span>
                      </div>
                      <div className="text-xs truncate" style={{ color: C.inkSoft }}>{p.label}</div>
                    </div>
                    <PlayCircle size={18} color={C.accent} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-4 mt-8">
        {[
          { icon: <BookOpen size={20} />, title: '쉬운 말로 풀어드려요', desc: '어려운 법률 용어 대신, 학년에 맞는 표현으로 안내해 드려요.' },
          { icon: <Search size={20} />, title: '비슷한 사례를 찾아드려요', desc: '공개 판례 중 상황과 가장 비슷한 사례를 찾아 보여드려요.' },
          { icon: <Shield size={20} />, title: '혼자 결정하지 않아도 돼요', desc: '같이 이야기할 수 있는 어른(선생님·상담 선생님·보호자)이 있어요.' },
        ].map((it, i) => (
          <div key={i} className="card-base p-6 anim-fade-up" style={{ animationDelay: `${0.2 + i * 0.08}s` }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: C.cardWarm, color: C.amberDeep, display: 'grid', placeItems: 'center', marginBottom: 14 }}>{it.icon}</div>
            <h3 className="font-semibold text-base mb-1" style={{ color: C.ink }}>{it.title}</h3>
            <p className="text-sm leading-relaxed" style={{ color: C.inkSoft }}>{it.desc}</p>
          </div>
        ))}
      </div>

      {/* W3 — 도와줄 어른과 기관의 존재 강조. 상세 정보(전화·홈페이지)는 결과 화면의 기관 카드(W4) 자리에서 다룸. */}
      <section className="mt-14 anim-fade-up" style={{ animationDelay: '0.45s' }}>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Users size={20} color={C.accent} />
          <h2 className="font-display text-2xl font-bold" style={{ color: C.ink }}>도와줄 어른과 기관이 있어요</h2>
        </div>
        <p className="text-sm leading-relaxed mb-5 max-w-3xl" style={{ color: C.inkSoft }}>
          혼자 결정하지 않으셔도 됩니다. 학교 안, 가족, 학교 밖 전문 기관까지 함께 이야기할 수 있는 사람들이 있어요.
        </p>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              icon: <Scale size={18} />,
              title: '학교 안',
              who: '담임·상담 선생님',
              desc: '학교에서 가장 먼저 도움을 청할 수 있어요. 보호자에게 알리기 전에 먼저 상담만 받아도 괜찮아요.',
              tag: '가장 가까운 곳',
            },
            {
              icon: <Heart size={18} />,
              title: '가족',
              who: '보호자·다른 어른',
              desc: '부모님이 어렵다면 다른 가족 어른(이모·고모·형·누나)에게 먼저 이야기해도 돼요.',
              tag: '믿을 수 있는 어른',
            },
            {
              icon: <Phone size={18} />,
              title: '청소년 상담',
              who: '1388',
              desc: '24시간 무료 익명. 학교폭력·또래 관계·가족 문제까지 가장 폭넓게 듣고 도와줘요.',
              tag: '24시간 익명',
            },
            {
              icon: <Shield size={18} />,
              title: 'Wee 클래스·센터',
              who: '학교·교육청 상담',
              desc: '학교 안 Wee 클래스, 교육청 Wee 센터에서 전문 상담 선생님이 함께해요.',
              tag: '전문 상담',
            },
          ].map((it, i) => (
            <div key={i} className="card-base p-5 anim-fade-up" style={{
              animationDelay: `${0.5 + i * 0.05}s`,
              background: C.card, border: `1px solid ${C.lineSoft}`,
            }}>
              <div className="flex items-center gap-2 mb-3">
                <div style={{ width: 36, height: 36, borderRadius: 10, background: C.cardWarm, color: C.amberDeep, display: 'grid', placeItems: 'center' }}>
                  {it.icon}
                </div>
                <span className="chip text-[10px]" style={{ background: C.bgSoft, color: C.inkSoft, padding: '2px 8px' }}>{it.tag}</span>
              </div>
              <h3 className="font-semibold text-sm mb-0.5" style={{ color: C.ink }}>{it.title}</h3>
              <div className="text-xs mb-2" style={{ color: C.amberDeep, fontWeight: 600 }}>{it.who}</div>
              <p className="text-xs leading-relaxed" style={{ color: C.inkSoft }}>{it.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-xs mt-4 leading-relaxed" style={{ color: C.inkMute }}>
          분석을 시작하면 상황에 맞는 *구체 연락처와 운영 시간*도 함께 안내해 드려요.
        </p>
      </section>
    </div>
  );
}

function StepInfo({ data, onChange, onNext, onBack }) {
  // W3 — 입력 부담을 더 줄이기 위해 *모든 항목을 선택*으로. 나이를 비워도 진행 가능.
  // 나이 미입력 시 school_level 이 'OT(기타)' 로 들어가지만 사례 매칭은 그대로 동작.
  return (
    <div className="max-w-2xl mx-auto px-6 py-8 anim-fade-up">
      <div className="mb-7">
        <h2 className="font-display text-3xl font-bold mb-2" style={{ color: C.ink }}>나에 대해 알려주세요</h2>
        <p style={{ color: C.inkSoft }}>채워주시면 안내가 더 정확해지지만, 비워두셔도 괜찮아요.</p>
      </div>

      {/* W3 — 심리 안전 문구. 화면 상단에서 부담을 먼저 풀어준다. */}
      <div style={{
        background: C.cardWarm, border: `1px solid ${C.line}`, borderRadius: 14,
        padding: 16, marginBottom: 20, display: 'flex', gap: 12,
      }}>
        <Shield size={18} color={C.accent} style={{ flexShrink: 0, marginTop: 2 }} />
        <div className="text-sm leading-relaxed" style={{ color: C.inkSoft }}>
          <strong style={{ color: C.ink }}>혼자 결정하지 않으셔도 됩니다.</strong> 담임 선생님, 상담 선생님,
          보호자, 1388(청소년 상담) 같은 어른과 기관이 함께해요. 이 안내는 그 자리를 찾는 데 도움드리는 정도예요.
        </div>
      </div>

      <div className="card-base p-7 mb-4">
        <label className="block text-sm font-semibold mb-3" style={{ color: C.ink }}>
          성별 <span style={{ color: C.inkMute, fontWeight: 400 }}>· 선택</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {['남자', '여자', '말하고 싶지 않아요'].map(g => (
            <button key={g} onClick={() => onChange({ ...data, gender: g })} className={`pill-toggle ${data.gender === g ? 'active' : ''}`}>{g}</button>
          ))}
        </div>
      </div>
      <div className="card-base p-7 mb-5">
        <label className="block text-sm font-semibold mb-3" style={{ color: C.ink }}>
          나이 <span style={{ color: C.inkMute, fontWeight: 400 }}>· 선택 (받을 수 있는 안내가 더 정확해져요)</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {['14-15세', '16-17세', '18세 이상'].map(a => (
            <button key={a} onClick={() => onChange({ ...data, age_band: a })} className={`pill-toggle ${data.age_band === a ? 'active' : ''}`}>{a}</button>
          ))}
        </div>
        <p className="text-xs mt-3 leading-relaxed" style={{ color: C.inkMute }}>
          14세 미만이라면 보호자와 함께 사단법인 두루(공익법센터)에 직접 문의해 보시기를 권해 드려요. 14세 미만은 받을 수 있는 절차가 달라지기 때문이에요.
        </p>
      </div>
      <div className="flex justify-between">
        <button onClick={onBack} className="btn-ghost"><ChevronLeft size={16} /> 이전</button>
        <button onClick={onNext} className="btn-primary">다음으로 <ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

// W3 — 카테고리별 진입 예시. 회의 결과 *사용자 실제 사례가 예시와 다르면 입력 어려움*을 풀기 위해
// 명확/모호/관계감정/보호자/가해자 5각 카테고리를 모두 커버한다. 클릭 시 textarea 자동 입력.
const SITUATION_EXAMPLES = [
  {
    id: 'cyber_clear',
    category: '명확한 학폭',
    title: '단톡방 욕설·놀림',
    text: '단톡방에서 같은 반 친구들이 저를 별명으로 부르면서 외모로 자꾸 놀려요. 그만하라고 했는데도 한 달 넘게 계속됐어요. 캡처본은 가지고 있어요.',
  },
  {
    id: 'sns_spread',
    category: '명확한 학폭',
    title: 'SNS에 사진 유포',
    text: '제가 모르는 사이에 제 사진을 누가 SNS에 올려서 비웃었어요. 그 게시물이 다른 학교에까지 퍼지고 있어요. 어떻게 해야 할지 모르겠어요.',
  },
  {
    id: 'ambiguous_physical',
    category: '모호한 상황',
    title: '신고됐는데 의도가 없었음',
    text: '복도에서 친구와 어깨를 부딪쳤는데 일부러 그런 게 아니었어요. 그런데 그 친구가 학교에 신고했다고 들었어요. 학폭으로 보일 수 있는지 잘 모르겠어요.',
  },
  {
    id: 'relational_exclusion',
    category: '관계·감정',
    title: '모둠에서 자꾸 빠짐',
    text: '요즘 친구들이 자꾸 저만 빼고 모둠을 만들어요. 점심도 혼자 먹고 있고, 단톡에서도 답이 잘 안 와요. 학폭인지 단순 갈등인지 잘 모르겠어요.',
  },
  {
    id: 'parent_view',
    category: '보호자 시점',
    title: '학교에서 연락받음',
    text: '아이가 다른 친구에게 욕설을 했다며 학교에서 연락이 왔습니다. 앞으로 어떤 절차를 거치게 되는지, 보호자로서 무엇을 준비해야 할지 알려 주세요.',
  },
  {
    id: 'gaehae_view',
    category: '가해자 시점',
    title: '지목됐는데 잘 모르겠음',
    text: '학교에서 제가 친구를 괴롭혔다는 신고가 들어왔다고 하더라고요. 저는 장난이었다고 생각했는데, 그 친구는 그렇게 받아들이지 않은 것 같아요. 학폭위에 출석하라는 통보를 받았어요.',
  },
];

function StepSituation({ data, onChange, onNext, onBack }) {
  const canProceed = data.user_text && data.user_text.trim().length >= 10;

  // 카테고리별 색상 — StepDetails 의 chip 컬러 톤과 동일 결을 유지.
  const CAT_STYLE = {
    '명확한 학폭': { bg: C.tagRed, fg: C.danger },
    '모호한 상황': { bg: C.tagYellow, fg: C.amberDeep },
    '관계·감정':   { bg: C.tagBlue, fg: C.accent },
    '보호자 시점': { bg: C.cardWarm, fg: C.amberDeep },
    '가해자 시점': { bg: C.bgSoft,  fg: C.inkSoft },
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 anim-fade-up">
      <div className="mb-8">
        <h2 className="font-display text-3xl font-bold mb-2" style={{ color: C.ink }}>어떤 일이 있었는지 이야기해 주세요</h2>
        <p style={{ color: C.inkSoft }}>어려운 말 몰라도 괜찮아요. 평소에 이야기하듯 편하게 적어주세요.</p>
      </div>
      <div className="card-base p-7 mb-5">
        <div className="mb-1 flex items-center gap-2">
          <Sparkles size={14} color={C.amberDeep} />
          <label className="block text-sm font-semibold" style={{ color: C.ink }}>본인 상황에 가까운 예시를 골라 시작해 보세요</label>
        </div>
        <p className="text-xs mb-4" style={{ color: C.inkMute }}>
          예시를 누르면 자동으로 채워져요. 마음에 드는 게 없으면 그냥 비워두고 직접 적어도 괜찮아요.
        </p>
        <div className="grid sm:grid-cols-2 gap-2 mb-5">
          {SITUATION_EXAMPLES.map((ex) => {
            const cat = CAT_STYLE[ex.category] || { bg: C.bg, fg: C.inkSoft };
            const active = data.user_text === ex.text;
            return (
              <button key={ex.id} onClick={() => onChange({ ...data, user_text: ex.text })}
                style={{
                  textAlign: 'left', padding: '12px 14px', borderRadius: 12,
                  border: `1.5px solid ${active ? C.accent : C.lineSoft}`,
                  background: active ? C.cardWarm : C.bg,
                  cursor: 'pointer', transition: 'all 0.15s',
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = C.amber; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = C.lineSoft; }}>
                <div className="flex items-center gap-2">
                  <span className="chip" style={{ background: cat.bg, color: cat.fg, padding: '2px 8px', fontSize: 10.5, fontWeight: 600 }}>
                    {ex.category}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: C.ink }}>{ex.title}</span>
                </div>
                <div style={{
                  color: C.inkMute, fontSize: 11.5, lineHeight: 1.5,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {ex.text}
                </div>
              </button>
            );
          })}
        </div>
        <textarea className="pretty-input" rows={8}
          placeholder="예) 교실에서 같은 반 친구와 카톡 단체방에서 외모로 별명을 지어서 좀 놀렸어요. 처음엔 친구도 같이 웃어서 장난인 줄 알았는데, 그만하라고 했는데도 한 달 동안 계속됐어요..."
          value={data.user_text || ''} onChange={e => onChange({ ...data, user_text: e.target.value })} />
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs" style={{ color: C.inkMute }}>{(data.user_text || '').length}자 / 최소 10자</span>
          {canProceed && <span className="text-xs flex items-center gap-1 anim-fade-in" style={{ color: C.accent }}><Check size={13} /> 충분해요</span>}
        </div>
      </div>
      <div style={{ background: C.cardWarm, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, marginBottom: 24, display: 'flex', gap: 12 }}>
        <Heart size={18} color={C.amberDeep} style={{ flexShrink: 0, marginTop: 2 }} />
        <div className="text-sm leading-relaxed" style={{ color: C.inkSoft }}>
          이름이나 학교, 친구 이름 같은 <strong style={{ color: C.ink }}>개인정보는 적지 않아도 돼요</strong>. 이 화면에서만 사용되며 어디에도 저장되지 않아요.
        </div>
      </div>
      <div className="flex justify-between">
        <button onClick={onBack} className="btn-ghost"><ChevronLeft size={16} /> 이전</button>
        <button onClick={onNext} disabled={!canProceed} className="btn-primary">분석 시작 <Sparkles size={16} /></button>
      </div>
    </div>
  );
}

function SafetyBranchScreen({ action, onReset }) {
  // 안전 분기 UI 는 *역할과 무관하게 존댓말 + 따뜻함* 으로 통일 (위기 상황은 안전 기본값).
  const messages = {
    urgent_self_harm: { title: '잠깐, 안전이 가장 중요해요', subtitle: '지금 마음이 많이 힘드신 것 같아요.' },
    urgent_domestic: { title: '잠깐, 안전이 가장 중요해요', subtitle: '지금 안전한 곳에 계신지 먼저 확인할게요.' },
  };
  const m = messages[action] || messages.urgent_domestic;
  return (
    <div className="max-w-2xl mx-auto px-6 py-12 anim-fade-in">
      <div style={{ background: '#FFF', border: `2px solid ${C.danger}`, borderRadius: 24, padding: '32px 28px' }}>
        <div className="flex items-center gap-3 mb-4">
          <div style={{ width: 48, height: 48, borderRadius: 14, background: '#FFF0EE', display: 'grid', placeItems: 'center' }}>
            <AlertTriangle size={24} color={C.danger} />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold" style={{ color: C.danger }}>{m.title}</h2>
            <p className="text-sm" style={{ color: C.inkSoft }}>{m.subtitle}</p>
          </div>
        </div>
        <p className="leading-relaxed mb-6" style={{ color: C.ink }}>
          이 안내보다 먼저 도와줄 어른과 기관이 있어요. 아래 연락처는 모두 <strong>무료, 24시간, 신원 보호</strong>이고, 지금 바로 도움을 받을 수 있어요.
        </p>
        <div className="space-y-3 mb-6">
          {[
            { name: '여성긴급전화', phone: '1366', desc: '가정폭력·성폭력 24시간', priority: true },
            { name: '아동권리보장원', phone: '1577-1391', desc: '아동학대 신고·보호', priority: true },
            { name: '자살예방상담전화', phone: '109', desc: '24시간 마음 상담', priority: action === 'urgent_self_harm' },
            { name: '긴급 신고', phone: '112', desc: '경찰 즉시 출동', priority: true },
          ].filter(x => x.priority).map((r, i) => (
            <div key={i} style={{
              background: C.cardWarm, border: `1px solid ${C.line}`, borderRadius: 14,
              padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div className="font-bold mb-1" style={{ color: C.ink }}>{r.name}</div>
                <div className="text-xs" style={{ color: C.inkSoft }}>{r.desc}</div>
              </div>
              <a href={`tel:${r.phone}`} className="btn-danger" style={{ fontSize: 18 }}>
                <Phone size={16} /> {r.phone}
              </a>
            </div>
          ))}
        </div>
        <p className="text-sm leading-relaxed mb-6" style={{ color: C.inkSoft }}>
          연락이 망설여진다면 친구·선생님·다른 가족 어른에게 먼저 이야기해 보세요. 혼자가 아니에요.
        </p>
        <button onClick={onReset} className="btn-ghost"><RotateCcw size={15} /> 다른 상황으로 다시 시작하기</button>
      </div>
    </div>
  );
}

/* StepDetails — 세션 21 (W2-B) 통합 화면.
 * 기존 두 화면([이게 맞을까요?] + [몇 가지만 더 확인할게요])을 하나로 합쳤다:
 *   1) 분류 결과 인라인 확인·수정 (예전 StepConfirm)
 *   2) LLM 동적 키워드 다중 선택 — /api/suggestKeywords 결과
 *   3) 기존 QUESTION_TREES 기반 추가 확인 질문 (예전 StepFollowUp)
 * 키워드 응답이 도착하기 전에는 폴백 키워드 chip 으로 미리 보여 *체감 대기시간 0*. */
function StepDetails({ data, tree, onChange, onUpdate, onNext, onBack }) {
  const TYPE_LABELS = { PH: '신체폭력', VB: '언어폭력', EX: '금품갈취', CO: '강요', OS: '따돌림', SX: '성폭력', CY: '사이버폭력', MX: '복합형' };
  const ROLE_LABELS = { G: '신고를 받은 쪽 (가해자로 지목됨)', V: '신고를 한 쪽 (피해를 입었음)', B: '쌍방', W: '목격자', P: '보호자', U: '아직 잘 모르겠음' };

  const [editing, setEditing] = useState(false);
  const [editType, setEditType] = useState(data.classification.type_main);
  const [editRole, setEditRole] = useState(data.classification.role);

  useEffect(() => {
    setEditType(data.classification.type_main);
    setEditRole(data.classification.role);
  }, [data.classification.type_main, data.classification.role]);

  const editChanged = editType !== data.classification.type_main || editRole !== data.classification.role;
  const applyEdit = () => {
    onUpdate({ type_main: editType, role: editRole });
    setEditing(false);
  };

  // 키워드 chip 다중 선택 토글
  const selected = data.selected_keywords || [];
  const toggleKeyword = (key) => {
    const next = selected.includes(key)
      ? selected.filter((k) => k !== key)
      : [...selected, key];
    onChange({ ...data, selected_keywords: next });
  };

  const suggestionsLoading = data.keyword_status === 'pending';
  const suggestions = data.keyword_suggestions ?? FALLBACK_SUGGESTIONS;
  // 카테고리별 색상 (감정·관계 등 학폭 외 카테고리도 노출됨을 시각적으로 분리)
  const CAT_STYLE = {
    행위: { bg: C.tagRed, fg: C.danger },
    관계: { bg: C.tagBlue, fg: C.accent },
    감정: { bg: C.cardWarm, fg: C.amberDeep },
    상황: { bg: C.bgSoft, fg: C.inkSoft },
    단계: { bg: C.tagYellow, fg: C.amberDeep },
  };

  const treeQuestionsAnswered =
    !tree || tree.questions.length === 0 || tree.questions.every((q) => data.follow_up?.[q.id]);
  const canProceed = treeQuestionsAnswered; // 키워드는 0개여도 진행 가능 (선택 사항)

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 anim-fade-up">
      <div className="mb-7">
        <h2 className="font-display text-3xl font-bold mb-2" style={{ color: C.ink }}>몇 가지만 더 확인할게요</h2>
        <p style={{ color: C.inkSoft }}>맞춤 안내를 위해 분류를 확인하고, 해당되는 키워드와 질문에 답해 주세요.</p>
      </div>

      {/* 1) 분류 결과 인라인 확인·수정 */}
      <div className="card-base p-6 mb-5" style={{ background: C.cardWarm, border: `1px solid ${C.line}` }}>
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle size={16} color={C.amberDeep} />
          <h3 className="font-semibold" style={{ color: C.ink }}>분류 확인</h3>
          <span className="chip text-[11px]" style={{ background: C.card, color: C.inkSoft, padding: '2px 8px' }}>
            신뢰도 {Math.round(data.classification.confidence * 100)}%
          </span>
        </div>
        {!editing ? (
          <>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div style={{ background: C.card, padding: 12, borderRadius: 10 }}>
                <div className="text-xs mb-1" style={{ color: C.inkMute }}>사건 유형</div>
                <div className="font-bold text-sm" style={{ color: C.ink }}>{TYPE_LABELS[data.classification.type_main]}</div>
              </div>
              <div style={{ background: C.card, padding: 12, borderRadius: 10 }}>
                <div className="text-xs mb-1" style={{ color: C.inkMute }}>현재 입장</div>
                <div className="font-bold text-sm" style={{ color: C.ink }}>{ROLE_LABELS[data.classification.role]}</div>
              </div>
            </div>
            <button onClick={() => setEditing(true)} className="btn-ghost text-xs" style={{
              width: '100%', justifyContent: 'center', padding: '8px 12px', background: C.card,
            }}>
              <Code size={13} /> 분류가 맞지 않으면 직접 수정하기
            </button>
          </>
        ) : (
          <div className="anim-fade-in">
            <div className="mb-3">
              <label className="block text-xs font-semibold mb-2" style={{ color: C.inkMute }}>사건 유형</label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <button key={k} onClick={() => setEditType(k)}
                    style={{
                      padding: '7px 11px', borderRadius: 9, fontSize: 12, fontWeight: 500,
                      border: `1.5px solid ${editType === k ? C.accent : C.line}`,
                      background: editType === k ? C.accent : C.card,
                      color: editType === k ? 'white' : C.ink,
                      cursor: 'pointer',
                    }}>{v}</button>
                ))}
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-semibold mb-2" style={{ color: C.inkMute }}>현재 입장</label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <button key={k} onClick={() => setEditRole(k)}
                    style={{
                      padding: '7px 11px', borderRadius: 9, fontSize: 12, fontWeight: 500,
                      border: `1.5px solid ${editRole === k ? C.accent : C.line}`,
                      background: editRole === k ? C.accent : C.card,
                      color: editRole === k ? 'white' : C.ink,
                      cursor: 'pointer',
                    }}>{v}</button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEditing(false); setEditType(data.classification.type_main); setEditRole(data.classification.role); }}
                className="btn-ghost text-xs" style={{ flex: 1, justifyContent: 'center', padding: 8 }}>취소</button>
              <button onClick={applyEdit} disabled={!editChanged}
                className="btn-primary text-xs" style={{ flex: 1, justifyContent: 'center', padding: 8, fontSize: 13 }}>수정 적용</button>
            </div>
          </div>
        )}
      </div>

      {/* 2) LLM 동적 키워드 다중 선택 */}
      <div className="card-base p-6 mb-5">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={16} color={C.accent} />
          <h3 className="font-semibold" style={{ color: C.ink }}>해당되는 키워드를 골라 주세요</h3>
          {suggestionsLoading && <Loader2 size={14} color={C.amberDeep} className="anim-spin" />}
          {data.keyword_status === 'fallback' && (
            <span className="chip text-[10px]" style={{ background: C.bg, color: C.amberDeep, padding: '2px 8px' }}>기본 키워드</span>
          )}
        </div>
        <p className="text-sm mb-4" style={{ color: C.inkSoft }}>
          여러 개 골라도 돼요. 해당이 없으면 그냥 건너뛰셔도 괜찮아요.
        </p>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => {
            const active = selected.includes(s.key);
            const cat = CAT_STYLE[s.category] || { bg: C.bg, fg: C.inkSoft };
            return (
              <button key={s.key} onClick={() => toggleKeyword(s.key)}
                style={{
                  padding: '7px 13px', borderRadius: 999, fontSize: 13, fontWeight: 500,
                  border: `1.5px solid ${active ? C.accent : C.line}`,
                  background: active ? C.accent : cat.bg,
                  color: active ? 'white' : cat.fg,
                  cursor: 'pointer', transition: 'all 0.15s',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                {active && <Check size={12} strokeWidth={3} />}
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
        {selected.length > 0 && (
          <p className="text-xs mt-3" style={{ color: C.inkMute }}>
            선택한 키워드 {selected.length}개 — 분석 단계에 함께 전달돼요.
          </p>
        )}
      </div>

      {/* 3) 트리 기반 확인 질문.
            W5 — "지금 어느 단계까지 왔어요?" 자리는 LLM 동적 stages 가 도착하면 그것을 옵션으로 사용.
            미도착·실패 시에는 트리의 기본 옵션 그대로 표시. */}
      {tree && tree.questions.length > 0 && (
        <div className="space-y-3 mb-7">
          {tree.questions.map((q, qi) => {
            const isStageQuestion = /단계까지|어느\s*단계/.test(q.text);
            const dynamicStages = isStageQuestion ? data.stages_suggestions : null;
            // 옵션은 (1) 동적 stages 가 있으면 그것, (2) 없으면 트리의 q.options.
            const optionList = dynamicStages
              ? dynamicStages.map((s) => ({ key: s.key, label: s.label }))
              : q.options.map((o) => ({ key: o, label: o }));
            return (
              <div key={q.id} className="card-base p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div style={{ width: 24, height: 24, borderRadius: 999, background: C.accent, color: 'white', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>{qi + 1}</div>
                  <h4 className="font-semibold text-sm pt-0.5" style={{ color: C.ink }}>{q.text}</h4>
                  {isStageQuestion && suggestionsLoading && !dynamicStages && (
                    <Loader2 size={13} color={C.amberDeep} className="anim-spin" />
                  )}
                  {isStageQuestion && dynamicStages && data.keyword_status === 'fallback' && (
                    <span className="chip text-[10px]" style={{ background: C.bg, color: C.amberDeep, padding: '2px 8px' }}>기본 옵션</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {optionList.map((o) => (
                    <button key={o.key} onClick={() => onChange({ ...data, follow_up: { ...(data.follow_up || {}), [q.id]: o.label } })}
                      className={`pill-toggle ${data.follow_up?.[q.id] === o.label ? 'active' : ''}`} style={{ fontSize: 13, padding: '10px 14px' }}>{o.label}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-between">
        <button onClick={onBack} className="btn-ghost"><ChevronLeft size={16} /> 이전</button>
        <button onClick={onNext} disabled={!canProceed} className="btn-primary">분석 시작하기 <Sparkles size={16} /></button>
      </div>
    </div>
  );
}

function StepLoading({ status }) {
  const [phase, setPhase] = useState(0);
  const phases = ['사건의 핵심 요소를 살펴보고 있어요', '비슷한 사례를 찾아보고 있어요', '안전 신호를 확인하고 있어요', '안내 문구를 정리하고 있어요'];
  // LLM 응답을 기다리는 동안 시각 피드백만 phase 단계로 진행 (3.9초까지). 그 이후엔 마지막 phase 유지.
  // step 전환은 App.jsx 의 useEffect 에서 LLM 응답 수신 후 setStep(5) 호출로 일어남.
  useEffect(() => {
    const ts = [
      setTimeout(() => setPhase(1), 700),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2300),
    ];
    return () => ts.forEach(clearTimeout);
  }, []);
  return (
    <div className="max-w-xl mx-auto px-6 py-20 anim-fade-in text-center">
      <div style={{ width: 80, height: 80, margin: '0 auto 28px', borderRadius: 24, background: C.cardWarm, display: 'grid', placeItems: 'center', boxShadow: `0 0 0 8px ${C.tagYellow}55` }}>
        <Loader2 size={36} color={C.amberDeep} className="anim-spin" />
      </div>
      <h2 className="font-display text-3xl font-bold mb-3" style={{ color: C.ink }}>분석하고 있어요</h2>
      <p style={{ color: C.inkSoft, marginBottom: 8 }}>잠깐만 기다려줘요.</p>
      {status === 'llm_pending' && (
        <p style={{ color: C.inkMute, fontSize: 12, marginBottom: 32 }}>응답이 도착하는 데 보통 3~10초 정도 걸려요.</p>
      )}
      {status === 'llm_error' && (
        <p style={{ color: C.amberDeep, fontSize: 13, marginBottom: 32 }}>응답이 늦어지고 있어요. 잠시 후 결과 화면으로 넘어가요.</p>
      )}
      {!status && <div style={{ height: 32 }} />}
      <div className="space-y-3 text-left max-w-md mx-auto">
        {phases.map((p, i) => (
          <div key={i} className="flex items-center gap-3 p-3" style={{ background: i <= phase ? C.cardWarm : 'transparent', borderRadius: 12, transition: 'background 0.4s' }}>
            {i < phase ? <Check size={18} color={C.accent} /> : i === phase ? <Loader2 size={18} color={C.amberDeep} className="anim-spin" /> : <div style={{ width: 18, height: 18, borderRadius: 999, border: `2px solid ${C.line}` }} />}
            <span className="text-sm" style={{ color: i <= phase ? C.ink : C.inkMute, fontWeight: i === phase ? 600 : 500 }}>{p}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProcedureTimeline({ currentStage }) {
  return (
    <div className="card-base p-7">
      <div className="flex items-center gap-2 mb-1">
        <Clock size={18} color={C.accent} />
        <h3 className="font-semibold text-lg" style={{ color: C.ink }}>지금 어떤 단계인지 알려드릴게요</h3>
      </div>
      <p className="text-sm mb-6" style={{ color: C.inkSoft }}>입력해 주신 내용을 바탕으로 추정한 현재 단계예요.</p>
      <div className="relative">
        {PROCEDURE_STAGES.map((s, i) => {
          const done = i < currentStage, current = i === currentStage, future = i > currentStage;
          return (
            <div key={s.stage} className="flex gap-4 pb-6 relative">
              {i < PROCEDURE_STAGES.length - 1 && (
                <div style={{ position: 'absolute', left: 14, top: 32, bottom: 0, width: 2, background: done ? C.accent : C.lineSoft }} />
              )}
              <div style={{ width: 30, height: 30, borderRadius: 999, flexShrink: 0,
                background: done ? C.accent : current ? C.amber : C.card,
                border: `2px solid ${done ? C.accent : current ? C.amberDeep : C.line}`,
                display: 'grid', placeItems: 'center',
                boxShadow: current ? `0 0 0 6px ${C.tagYellow}` : 'none',
                zIndex: 1 }}>
                {done ? <Check size={14} color="white" /> : current ? <div style={{ width: 8, height: 8, borderRadius: 999, background: 'white' }} /> : <div style={{ width: 6, height: 6, borderRadius: 999, background: C.lineSoft }} />}
              </div>
              <div className="flex-1 pt-0.5">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {/* W4-A2 — 학폭위·심의위원회 등 어려운 한자어가 들어가면 자동으로 괄호 풀이 첨가. */}
                  <span className="font-semibold" style={{ color: future ? C.inkMute : C.ink }}>{glossLegalTerms(s.label)}</span>
                  {current && <span className="chip text-[11px]" style={{ background: C.tagYellow, color: C.amberDeep, padding: '2px 10px' }}>지금 여기</span>}
                  {done && <span className="chip text-[11px]" style={{ background: C.tagBlue, color: C.accent, padding: '2px 10px' }}>완료</span>}
                </div>
                <p className="text-sm" style={{ color: future ? C.inkMute : C.inkSoft }}>{glossLegalTerms(s.description)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CaseCard({ c, onClick }) {
  return (
    <button onClick={onClick} className="card-base card-hover p-5 text-left w-full" style={{ background: C.cardWarm, borderColor: C.line }}>
      <div className="flex items-start justify-between mb-3 gap-2">
        <span className="chip" style={{ background: C.amber, color: '#fff', padding: '4px 12px', fontSize: 12 }}>유사도 {Math.round(c._scores.final * 100)}%</span>
        <span className="chip" style={{
          background: c.recognition === '인정' ? C.tagBlue : c.recognition === '불인정' ? C.tagRed : C.bgSoft,
          color: c.recognition === '인정' ? C.accent : c.recognition === '불인정' ? C.danger : C.inkSoft,
          padding: '4px 10px', fontSize: 11,
        }}>{c.recognition}</span>
      </div>
      <h4 className="font-semibold text-base mb-2 leading-snug" style={{ color: C.ink }}>{c.friendly_title}</h4>
      <p className="text-sm mb-3 leading-relaxed" style={{ color: C.inkSoft, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {c.friendly_summary}
      </p>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div className="flex gap-1.5 flex-wrap">
          <span className="chip text-[11px]" style={{ background: C.bg, color: C.inkSoft, padding: '3px 9px' }}>{c.category}</span>
          <span className="chip text-[11px]" style={{ background: C.bg, color: C.inkSoft, padding: '3px 9px' }}>{c.sentence}</span>
        </div>
        <span className="text-xs flex items-center gap-1" style={{ color: C.accent, fontWeight: 600 }}>자세히 <ChevronRight size={12} /></span>
      </div>
      {/* 메타 정보 (선고일·법원·사건번호) */}
      <div style={{ borderTop: `1px dashed ${C.line}`, paddingTop: 10, marginTop: 2 }}>
        <div className="flex items-center gap-2 mb-1 flex-wrap" style={{ fontSize: 10.5 }}>
          <span style={{ color: C.inkMute }}>📅 {c.decision_date || '진행 중'}</span>
          <span style={{ color: C.inkMute }}>· 🏛️ {c.court}</span>
        </div>
        <div style={{ fontSize: 10.5, color: C.inkMute, fontFamily: 'ui-monospace, monospace' }}>
          {c.case_number}
          {c.case_title_formal && c.case_title_formal !== '(학교 신고 전)' && (
            <span> [{c.case_title_formal}]</span>
          )}
        </div>
      </div>
    </button>
  );
}

function CaseDetailModal({ c, onClose }) {
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 anim-fade-in" style={{ background: 'rgba(31,45,31,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="h-full overflow-y-auto py-10 px-4">
        <div className="max-w-2xl mx-auto card-base p-8 anim-fade-up" style={{ background: C.bg }} onClick={e => e.stopPropagation()}>
          <div className="flex items-start justify-between mb-5 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="chip" style={{ background: C.amber, color: '#fff', padding: '4px 12px' }}>유사도 {Math.round(c._scores.final * 100)}%</span>
                <span className="chip" style={{ background: C.cardWarm, color: C.amberDeep, padding: '4px 12px', fontSize: 11 }}>
                  텍스트 {c._scores.text_similarity} · 코드 {c._scores.code_match}
                </span>
              </div>
              <h3 className="font-display text-2xl font-bold leading-tight" style={{ color: C.ink }}>{c.friendly_title}</h3>
            </div>
            <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 12, background: C.card, border: `1px solid ${C.lineSoft}`, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><X size={18} color={C.inkSoft} /></button>
          </div>
          <div className="card-base p-5 mb-5" style={{ background: C.card }}>
            <div className="text-xs font-semibold mb-2" style={{ color: C.amberDeep }}>사건 개요</div>
            <p className="leading-relaxed" style={{ color: C.ink }}>{c.friendly_summary}</p>
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
              <div><div className="text-xs mb-1" style={{ color: C.inkMute }}>분류</div><div className="font-semibold text-sm" style={{ color: C.ink }}>{c.category}</div></div>
              <div><div className="text-xs mb-1" style={{ color: C.inkMute }}>처분 결과</div><div className="font-semibold text-sm" style={{ color: C.ink }}>{c.sentence}</div></div>
            </div>
          </div>
          {/* 정식 사건 정보 */}
          <div className="card-base p-5 mb-4" style={{ background: C.bgSoft, border: `1px solid ${C.line}` }}>
            <div className="flex items-center gap-2 mb-3">
              <FileText size={14} color={C.accent} />
              <h4 className="font-semibold text-sm" style={{ color: C.ink }}>정식 사건 정보</h4>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex gap-2">
                <span style={{ color: C.inkMute, minWidth: 60, fontSize: 12 }}>선고일</span>
                <span style={{ color: C.ink }}>{c.decision_date || '진행 중 (선고 전)'}</span>
              </div>
              <div className="flex gap-2">
                <span style={{ color: C.inkMute, minWidth: 60, fontSize: 12 }}>판결 법원</span>
                <span style={{ color: C.ink }}>{c.court}</span>
              </div>
              <div className="flex gap-2">
                <span style={{ color: C.inkMute, minWidth: 60, fontSize: 12 }}>사건번호</span>
                <span style={{ color: C.ink, fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>{c.case_number}</span>
              </div>
              {c.case_title_formal && c.case_title_formal !== '(학교 신고 전)' && (
                <div className="flex gap-2">
                  <span style={{ color: C.inkMute, minWidth: 60, fontSize: 12 }}>사건 제목</span>
                  <span style={{ color: C.ink, fontSize: 13 }}>{c.case_title_formal}</span>
                </div>
              )}
              <div className="flex gap-2">
                <span style={{ color: C.inkMute, minWidth: 60, fontSize: 12 }}>판결 주문</span>
                <span style={{ color: C.ink, fontSize: 13 }}>{c.disposition_summary}</span>
              </div>
            </div>
          </div>
          {c.recognition !== '불인정' && c.key_factors.length > 0 && (
            <div className="card-base p-5 mb-4" style={{ background: C.card }}>
              <div className="flex items-center gap-2 mb-3">
                <div style={{ width: 4, height: 16, background: C.accent, borderRadius: 999 }} />
                <h4 className="font-semibold" style={{ color: C.ink }}>왜 이렇게 판단됐나요?</h4>
              </div>
              <ul className="space-y-2">{c.key_factors.map((f, i) => <li key={i} className="flex gap-2 text-sm leading-relaxed" style={{ color: C.inkSoft }}><Check size={14} color={C.accent} style={{ marginTop: 4, flexShrink: 0 }} />{f}</li>)}</ul>
            </div>
          )}
          {c.not_recognized_reasons.length > 0 && (
            <div className="card-base p-5 mb-4" style={{ background: C.card }}>
              <div className="flex items-center gap-2 mb-3">
                <div style={{ width: 4, height: 16, background: C.danger, borderRadius: 999 }} />
                <h4 className="font-semibold" style={{ color: C.ink }}>왜 학교폭력으로 보지 않았나요?</h4>
              </div>
              <ul className="space-y-2">{c.not_recognized_reasons.map((f, i) => <li key={i} className="flex gap-2 text-sm leading-relaxed" style={{ color: C.inkSoft }}><X size={14} color={C.danger} style={{ marginTop: 4, flexShrink: 0 }} />{f}</li>)}</ul>
            </div>
          )}
          {c.severity_factors.length > 0 && (
            <div className="card-base p-5" style={{ background: C.cardWarm, border: `1px solid ${C.line}` }}>
              <div className="flex items-center gap-2 mb-3">
                <div style={{ width: 4, height: 16, background: C.amber, borderRadius: 999 }} />
                <h4 className="font-semibold" style={{ color: C.ink }}>처분 수위에 영향을 준 요소들</h4>
              </div>
              <ul className="space-y-2">{c.severity_factors.map((f, i) => <li key={i} className="flex gap-2 text-sm leading-relaxed" style={{ color: C.inkSoft }}><span style={{ color: C.amberDeep, marginTop: 1, fontWeight: 700 }}>·</span>{f}</li>)}</ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChecklistSection({ docs }) {
  const [checked, setChecked] = useState({});
  const done = Object.values(checked).filter(Boolean).length;
  if (docs.length === 0) return null;
  return (
    <div className="card-base p-7">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div className="flex items-center gap-2"><ClipboardList size={18} color={C.accent} /><h3 className="font-semibold text-lg" style={{ color: C.ink }}>준비하면 좋을 서류·자료</h3></div>
        <span className="chip text-xs" style={{ background: C.cardWarm, color: C.amberDeep, padding: '4px 12px' }}>{done} / {docs.length}</span>
      </div>
      <p className="text-sm mb-5" style={{ color: C.inkSoft }}>상황에 맞춰 추천된 서류예요. 하나씩 체크해 보세요.</p>
      <div style={{ height: 6, borderRadius: 999, background: C.lineSoft, marginBottom: 20 }}>
        <div style={{ height: '100%', width: `${(done / docs.length) * 100}%`, background: C.accent, borderRadius: 999, transition: 'width 0.3s' }} />
      </div>
      <div className="space-y-2">{docs.map(d => {
        const isChecked = checked[d.doc_id];
        const cmap = { high: { bg: C.tagRed, fg: C.danger, label: '필수' }, mid: { bg: C.tagYellow, fg: C.amberDeep, label: '권장' }, low: { bg: C.tagBlue, fg: C.accent, label: '선택' } };
        const cs = cmap[d.priority] || cmap.mid;
        return (
          <button key={d.doc_id} onClick={() => setChecked(s => ({ ...s, [d.doc_id]: !s[d.doc_id] }))}
            style={{ width: '100%', textAlign: 'left', padding: 14, borderRadius: 12, background: isChecked ? C.cardWarm : C.bg, border: `1px solid ${isChecked ? C.line : C.lineSoft}`, display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
            <div style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, marginTop: 2, background: isChecked ? C.accent : C.card, border: `2px solid ${isChecked ? C.accent : C.line}`, display: 'grid', placeItems: 'center' }}>
              {isChecked && <Check size={13} color="white" strokeWidth={3} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-medium text-sm" style={{ color: C.ink, textDecoration: isChecked ? 'line-through' : 'none', opacity: isChecked ? 0.6 : 1 }}>{d.name}</span>
                <span className="chip text-[10px]" style={{ background: cs.bg, color: cs.fg, padding: '2px 8px' }}>{cs.label}</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: C.inkMute }}>{d.description}</p>
            </div>
          </button>
        );
      })}</div>
    </div>
  );
}

function TermsSection({ terms }) {
  const [open, setOpen] = useState({});
  if (terms.length === 0) return null;
  return (
    <div className="card-base p-7">
      <div className="flex items-center gap-2 mb-1"><BookOpen size={18} color={C.accent} /><h3 className="font-semibold text-lg" style={{ color: C.ink }}>어려운 말을 쉽게 풀어드려요</h3></div>
      <p className="text-sm mb-5" style={{ color: C.inkSoft }}>모르는 게 있을 때 펼쳐보세요.</p>
      <div className="space-y-2">{terms.map((t, i) => {
        const isOpen = open[i];
        return (
          <div key={t.term_id} style={{ background: isOpen ? C.cardWarm : C.bg, border: `1px solid ${isOpen ? C.line : C.lineSoft}`, borderRadius: 12, overflow: 'hidden' }}>
            <button onClick={() => setOpen(s => ({ ...s, [i]: !s[i] }))} style={{ width: '100%', padding: 14, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}>
              <span className="font-medium text-sm" style={{ color: C.ink }}>{t.term}</span>
              {isOpen ? <ChevronUp size={16} color={C.inkSoft} /> : <ChevronDown size={16} color={C.inkSoft} />}
            </button>
            {isOpen && <div className="px-4 pb-4 anim-fade-in"><p className="text-sm leading-relaxed" style={{ color: C.inkSoft }}>{t.plain}</p></div>}
          </div>
        );
      })}</div>
    </div>
  );
}

function FAQSection({ faqs }) {
  const [open, setOpen] = useState(null);
  if (faqs.length === 0) return null;
  return (
    <div className="card-base p-7">
      <div className="flex items-center gap-2 mb-1"><MessageCircleQuestion size={18} color={C.accent} /><h3 className="font-semibold text-lg" style={{ color: C.ink }}>자주 묻는 질문</h3></div>
      <p className="text-sm mb-5" style={{ color: C.inkSoft }}>비슷한 상황에서 자주 나오는 질문이에요.</p>
      <div className="space-y-2">{faqs.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.faq_id} style={{ background: isOpen ? C.cardWarm : C.bg, border: `1px solid ${isOpen ? C.line : C.lineSoft}`, borderRadius: 12 }}>
            <button onClick={() => setOpen(isOpen ? null : i)} style={{ width: '100%', padding: '16px 18px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', gap: 12 }}>
              <div className="flex items-start gap-3">
                <span style={{ color: C.amber, fontWeight: 700, fontSize: 16 }}>Q</span>
                <span className="font-medium text-sm leading-relaxed" style={{ color: C.ink }}>{f.q}</span>
              </div>
              {isOpen ? <ChevronUp size={16} color={C.inkSoft} style={{ flexShrink: 0 }} /> : <ChevronDown size={16} color={C.inkSoft} style={{ flexShrink: 0 }} />}
            </button>
            {isOpen && <div className="px-5 pb-5 anim-fade-in"><div className="flex gap-3"><span style={{ color: C.accent, fontWeight: 700, fontSize: 16 }}>A</span><p className="text-sm leading-relaxed" style={{ color: C.inkSoft }}>{f.a}</p></div></div>}
          </div>
        );
      })}</div>
    </div>
  );
}

/* W4-A1 — 앞으로 진행될 상황 카드. 회의 결과(항목 6) 반영: 사용자는 *결과* 보다 *앞으로 일어날 일*에
 * 정보 욕구가 더 큼. 현재 stage 기반으로 다음 1~3단계를 카드로 보여준다. */
function StageForecastSection({ stage }) {
  const forecast = getStageForecast(stage);
  if (forecast.length === 0) return null;
  return (
    <div className="card-base p-7">
      <div className="flex items-center gap-2 mb-1">
        <ArrowRight size={18} color={C.accent} />
        <h3 className="font-semibold text-lg" style={{ color: C.ink }}>앞으로 어떻게 진행될까요</h3>
      </div>
      <p className="text-sm mb-5" style={{ color: C.inkSoft }}>
        지금 단계에서 자주 이어지는 흐름이에요. *실제 절차는 상황과 학교 운영 기준에 따라 달라질 수 있어요*.
      </p>
      <ol className="space-y-3" style={{ paddingLeft: 0, listStyle: 'none' }}>
        {forecast.map((f, i) => (
          <li key={i} style={{
            background: i === 0 ? C.cardWarm : C.bg,
            border: `1px solid ${i === 0 ? C.line : C.lineSoft}`,
            borderRadius: 14, padding: 16,
            display: 'flex', gap: 14,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 999, flexShrink: 0,
              background: i === 0 ? C.amber : C.lineSoft,
              color: i === 0 ? 'white' : C.inkSoft,
              display: 'grid', placeItems: 'center',
              fontSize: 13, fontWeight: 700,
            }}>{i + 1}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-semibold text-sm" style={{ color: C.ink }}>{glossLegalTerms(f.label)}</span>
                {i === 0 && (
                  <span className="chip text-[10px]" style={{ background: C.amberDeep, color: 'white', padding: '2px 8px' }}>
                    다음 단계
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed mb-2" style={{ color: C.inkSoft }}>
                {glossLegalTerms(f.summary)}
              </p>
              {f.do_now && f.do_now.length > 0 && (
                <div style={{ background: C.card, border: `1px dashed ${C.lineSoft}`, borderRadius: 10, padding: '10px 12px' }}>
                  <div className="text-[11px] font-semibold mb-1" style={{ color: C.amberDeep }}>지금 할 수 있는 일</div>
                  <ul className="space-y-1">
                    {f.do_now.map((d, j) => (
                      <li key={j} className="flex gap-2 text-xs leading-relaxed" style={{ color: C.inkSoft }}>
                        <Check size={12} color={C.accent} style={{ marginTop: 3, flexShrink: 0 }} />
                        <span>{glossLegalTerms(d)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
      {/* W4-B 화해·중재 강조 — 회의 결과(항목 7) 반영. 모든 stage 결과 화면에 한 줄 고정 안내. */}
      <div style={{
        marginTop: 18, padding: 14, borderRadius: 12,
        background: C.tagBlue, border: `1px solid ${C.line}`,
        display: 'flex', gap: 12,
      }}>
        <Heart size={16} color={C.accent} style={{ flexShrink: 0, marginTop: 2 }} />
        <div className="text-sm leading-relaxed" style={{ color: C.ink }}>
          학교장 자체해결, <strong>관계회복 프로그램</strong>처럼 법적 절차 외에도 화해와 회복으로 도움받을 수 있는 길이 있어요.
          처분만이 답이 아니라는 점, 같이 기억해 둬요.
        </div>
      </div>
    </div>
  );
}

/* W5.1 — 도움 기관 안내 통합 (이전 CounselingResourcesSection + ResourcesSection).
 *  기존엔 "같이 이야기할 수 있는 곳" / "혼자 해결하기 어렵다면" 두 섹션으로 분리돼 중복 인지를 줬다.
 *  하나의 "도움받을 수 있는 곳" 섹션으로 통합: 상단 어른 안내 한 줄 + 기관 카드들.
 *   - counseling: 상수 데이터(24시간/익명/무료 배지 + 홈페이지) → 풍부 카드
 *   - matched: 사용자 상황 맞춤 기관 → 보조 카드
 *   - 1388·117 처럼 양쪽에 겹치는 기관은 대표 전화번호 기준으로 matched 에서 중복 제거. */
function HelpSection({ counseling = [], matched = [] }) {
  const primaryNum = (phone) => (String(phone).match(/^[\d-]+/) || [''])[0].replace(/\D/g, '');
  const counselNums = new Set(counseling.map(r => primaryNum(r.phone)).filter(Boolean));
  const extraMatched = matched.filter(r => {
    const n = primaryNum(r.phone);
    return !(n && counselNums.has(n));
  });

  if (counseling.length === 0 && extraMatched.length === 0) return null;

  return (
    <div className="card-base p-7" style={{ background: C.cardWarm, border: `1px solid ${C.line}` }}>
      <div className="flex items-center gap-2 mb-1">
        <Users size={18} color={C.amberDeep} />
        <h3 className="font-semibold text-lg" style={{ color: C.ink }}>도움받을 수 있는 곳</h3>
      </div>
      <p className="text-sm mb-5" style={{ color: C.inkSoft }}>
        혼자 결정하지 않으셔도 됩니다. 담임·상담 선생님이나 보호자 같은 가까운 어른부터 아래 기관까지, 함께할 수 있는 곳이 많아요.
        각 기관의 *역할·운영 시간·익명성*을 참고해 편한 곳을 골라 보세요.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        {counseling.map((r) => (
          <div key={r.id} style={{
            background: C.card, padding: 16, borderRadius: 14,
            border: `1px solid ${C.lineSoft}`,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold text-sm" style={{ color: C.ink }}>{r.name}</span>
              {r.web && (
                <a href={r.web} target="_blank" rel="noreferrer noopener"
                  style={{ color: C.accent, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <ExternalLink size={11} /> 홈페이지
                </a>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {r.hours === '24시간' && (
                <span className="chip text-[10px]" style={{ background: C.tagBlue, color: C.accent, padding: '2px 8px' }}>
                  <Clock size={10} /> 24시간
                </span>
              )}
              {r.free && (
                <span className="chip text-[10px]" style={{ background: C.tagYellow, color: C.amberDeep, padding: '2px 8px' }}>
                  무료
                </span>
              )}
              {r.anonymous && (
                <span className="chip text-[10px]" style={{ background: C.bgSoft, color: C.inkSoft, padding: '2px 8px' }}>
                  익명 가능
                </span>
              )}
              {!r.anonymous && (
                <span className="chip text-[10px]" style={{ background: C.bg, color: C.inkMute, padding: '2px 8px' }}>
                  실명 필요
                </span>
              )}
            </div>
            <p className="text-xs leading-relaxed" style={{ color: C.inkSoft }}>{r.role}</p>
            <div className="flex items-center justify-between gap-2 mt-1" style={{ borderTop: `1px dashed ${C.lineSoft}`, paddingTop: 8 }}>
              <div className="flex items-center gap-2" style={{ color: C.accent, fontSize: 13, fontWeight: 600 }}>
                {/^\d/.test(r.phone) ? <Phone size={12} /> : <Info size={12} />}
                <span>{r.phone}</span>
              </div>
              <span className="text-[11px]" style={{ color: C.inkMute }}>{r.hours}</span>
            </div>
          </div>
        ))}
        {extraMatched.map((r) => (
          <div key={r.res_id} style={{
            background: C.card, padding: 16, borderRadius: 14,
            border: `1px solid ${C.lineSoft}`,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold text-sm" style={{ color: C.ink }}>{r.name}</span>
              {r.tags?.[0] && (
                <span className="chip text-[10px]" style={{ background: C.tagYellow, color: C.amberDeep, padding: '2px 8px' }}>{r.tags[0]}</span>
              )}
            </div>
            <p className="text-xs leading-relaxed" style={{ color: C.inkSoft }}>{r.description}</p>
            <div className="flex items-center gap-2 mt-1" style={{ borderTop: `1px dashed ${C.lineSoft}`, paddingTop: 8, color: C.accent, fontSize: 13, fontWeight: 600 }}>
              {/^\d/.test(r.phone) ? <Phone size={12} /> : <ExternalLink size={12} />}
              <span>{r.phone}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClassificationDebugPanel({ data, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const TYPE_LABELS = { PH: '신체폭력', VB: '언어폭력', EX: '금품갈취', CO: '강요', OS: '따돌림', SX: '성폭력', CY: '사이버폭력', MX: '복합형' };
  const ROLE_LABELS = { G: '신고 받은 쪽', V: '신고 한 쪽', B: '쌍방', W: '목격자', P: '보호자', U: '미정' };
  const [type, setType] = useState(data.classification.type_main);
  const [role, setRole] = useState(data.classification.role);

  useEffect(() => {
    setType(data.classification.type_main);
    setRole(data.classification.role);
  }, [data.classification.type_main, data.classification.role]);

  const changed = type !== data.classification.type_main || role !== data.classification.role;

  const apply = () => {
    onUpdate({ type_main: type, role });
    setEditing(false);
  };

  return (
    <div className="card-base p-5" style={{ background: C.bg, border: `1px dashed ${C.line}` }}>
      <button onClick={() => setOpen(!open)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', cursor: 'pointer' }}>
        <div className="flex items-center gap-2">
          <Code size={15} color={C.inkMute} />
          <span className="text-sm font-semibold" style={{ color: C.inkSoft }}>분류 결과 자세히 보기 · 수정 가능</span>
        </div>
        {open ? <ChevronUp size={16} color={C.inkMute} /> : <ChevronDown size={16} color={C.inkMute} />}
      </button>
      {open && (
        <div className="mt-4 anim-fade-in space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div style={{ background: C.card, padding: 10, borderRadius: 8 }}>
              <div style={{ color: C.inkMute, marginBottom: 2 }}>full_code</div>
              <div className="font-mono font-bold" style={{ color: C.accent }}>{data.full_code}</div>
            </div>
            <div style={{ background: C.card, padding: 10, borderRadius: 8 }}>
              <div style={{ color: C.inkMute, marginBottom: 2 }}>분류 신뢰도</div>
              <div className="font-mono font-bold" style={{ color: data.confidence >= 0.7 ? C.accent : C.amberDeep }}>
                {Math.round(data.confidence * 100)}% {data.confidence >= 0.7 ? '✓' : '⚠'}
              </div>
            </div>
          </div>

          {!editing ? (
            <button onClick={() => setEditing(true)} className="btn-ghost text-xs" style={{
              width: '100%', justifyContent: 'center', padding: '8px 12px', background: C.card,
            }}>
              <Code size={13} /> 분류가 정확하지 않다면 직접 수정하기
            </button>
          ) : (
            <div style={{ background: C.card, padding: 12, borderRadius: 8 }}>
              <div className="mb-3">
                <label className="block font-semibold mb-2" style={{ color: C.inkMute }}>사건 유형</label>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <button key={k} onClick={() => setType(k)} style={{
                      padding: '5px 9px', borderRadius: 7, fontSize: 11, fontWeight: 500,
                      border: `1px solid ${type === k ? C.accent : C.line}`,
                      background: type === k ? C.accent : C.bg,
                      color: type === k ? 'white' : C.ink,
                      cursor: 'pointer',
                    }}>{v}</button>
                  ))}
                </div>
              </div>
              <div className="mb-3">
                <label className="block font-semibold mb-2" style={{ color: C.inkMute }}>너의 입장</label>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                    <button key={k} onClick={() => setRole(k)} style={{
                      padding: '5px 9px', borderRadius: 7, fontSize: 11, fontWeight: 500,
                      border: `1px solid ${role === k ? C.accent : C.line}`,
                      background: role === k ? C.accent : C.bg,
                      color: role === k ? 'white' : C.ink,
                      cursor: 'pointer',
                    }}>{v}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditing(false); setType(data.classification.type_main); setRole(data.classification.role); }}
                  className="btn-ghost text-xs" style={{ flex: 1, justifyContent: 'center', padding: '8px' }}>취소</button>
                <button onClick={apply} disabled={!changed}
                  className="btn-primary text-xs" style={{ flex: 1, justifyContent: 'center', padding: '8px', fontSize: 12 }}>
                  수정 · 결과 다시 계산
                </button>
              </div>
            </div>
          )}

          <div style={{ background: C.card, padding: 10, borderRadius: 8 }}>
            <div style={{ color: C.inkMute, marginBottom: 4 }}>특징 추출</div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(data.features || {}).filter(([_, v]) => v).map(([k]) => (
                <span key={k} className="chip text-[10px]" style={{ background: C.tagBlue, color: C.accent, padding: '2px 8px' }}>{k}</span>
              ))}
              {Object.entries(data.features || {}).filter(([_, v]) => v).length === 0 && (
                <span style={{ color: C.inkMute }}>(없음)</span>
              )}
            </div>
          </div>
          <p style={{ color: C.inkMute, lineHeight: 1.5 }}>
            ※ 폴백 분류는 키워드 룰 기반이에요. 실제 분류는 Claude API 가 처리하고, 실패 시에만 이 폴백으로 흘러요.
          </p>
        </div>
      )}
    </div>
  );
}

function StepResults({ data, onReset, onNewDemo, onClassificationUpdate }) {
  const [selectedCase, setSelectedCase] = useState(null);
  const [sortMode, setSortMode] = useState('relevance'); // 'relevance' | 'recent'
  const [expanded, setExpanded] = useState(false);

  // M2 — LLM 매칭 우선, 폴백은 기존 규칙 기반 matchCases.
  // 1) LLM 이 matched_case_ids 를 반환했으면 그것을 우선 위치에 배치 (1~3건).
  // 2) 그 외 비슷한 사례는 기존 matchCases 결과에서 LLM 매칭과 중복 제거 후 보강.
  const llmMatched = useMemo(
    () => expandMatchedCaseIds(data.llm?.matched_case_ids ?? [], CASES),
    [data.llm],
  );
  const ruleBased = useMemo(() => matchCases(data.full_code, data.user_text, CASES, { topN: 10 }), [data.full_code, data.user_text]);
  const allMatched = useMemo(() => {
    if (llmMatched.length === 0) return ruleBased;
    const seen = new Set(llmMatched.map((c) => c.case_id));
    return [...llmMatched, ...ruleBased.filter((c) => !seen.has(c.case_id))];
  }, [llmMatched, ruleBased]);
  const matchedCases = useMemo(() => {
    const arr = [...allMatched];
    if (sortMode === 'recent') {
      arr.sort((a, b) => {
        const da = a.decision_date || '0000-00-00';
        const db = b.decision_date || '0000-00-00';
        return db.localeCompare(da);
      });
    }
    return expanded ? arr.slice(0, 6) : arr.slice(0, 3);
  }, [allMatched, sortMode, expanded]);

  const matchedDocs = useMemo(() => filterContent(data.full_code, DOCUMENTS, { limit: 8 }), [data.full_code]);
  const matchedTerms = useMemo(() => selectLegalTerms(data.full_code, data.school_level, LEGAL_TERMS, { limit: 6 }), [data.full_code, data.school_level]);
  const matchedFaqs = useMemo(() => filterContent(data.full_code, FAQS, { limit: 5 }), [data.full_code]);
  const matchedResources = useMemo(() => rankResources(data.full_code, data.classification.type_main, RESOURCES).slice(0, 6), [data.full_code, data.classification.type_main]);

  const TYPE_LABELS = { PH: '신체폭력', VB: '언어폭력', EX: '금품갈취', CO: '강요', OS: '따돌림', SX: '성폭력', CY: '사이버폭력', MX: '복합형' };
  const ROLE_LABELS = { G: '신고를 받은 학생', V: '신고를 한 학생', B: '쌍방', W: '목격자', P: '보호자', U: '미정' };
  const LEVEL_LABELS = { ES: '초등학생', MS: '중학생', HS: '고등학생', OT: '비재학' };
  const TYPE_EMOJI = { PH: '👊', VB: '💬', EX: '💰', CO: '🔄', OS: '🚫', SX: '⚠️', CY: '📱', MX: '🔀' };

  // W1.5 — 두루 검토 결정: 피해자(V) 포함 전 역할 *따뜻한 존댓말 (해요체)* 로 통일.
  // 따뜻함은 어휘·문장 구성으로 유지하고, 종결어미는 "~해요/~예요" 위주.
  const COPY = {
    headerTitle: (
      <>현재 상황은 <span style={{ color: C.accent }}>{TYPE_LABELS[data.classification.type_main]}</span>로 보여요</>
    ),
    headerDesc:
      '아래 내용은 공개 판례를 분석해 자동으로 정리한 안내예요. 혼자 결정하지 않으셔도 됩니다. 담임 선생님, 상담 선생님, 보호자 중 한 분과 상의해 보세요.',
    sectionFriendly: '상황에 맞춰 정리해 봤어요',
    sectionCases: '비슷한 사례를 찾았어요',
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* 헤더 */}
      <div className="anim-fade-up mb-6" style={{ background: `linear-gradient(135deg, ${C.cardWarm} 0%, ${C.bg} 100%)`, border: `1px solid ${C.line}`, borderRadius: 24, padding: '32px 28px', position: 'relative', overflow: 'hidden' }}>
        <div className="relative">
          <div className="chip mb-3" style={{ background: C.card, color: C.inkSoft, padding: '6px 14px', border: `1px solid ${C.lineSoft}` }}>
            <Sparkles size={13} color={C.amberDeep} /> 분석이 끝났어요
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-3 leading-tight" style={{ color: C.ink }}>
            <span style={{ fontSize: '1.3em', marginRight: 8 }}>{TYPE_EMOJI[data.classification.type_main] || '🏫'}</span>
            {COPY.headerTitle}
          </h2>
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className="chip" style={{ background: C.card, color: C.inkSoft, padding: '4px 12px', fontSize: 12 }}>{ROLE_LABELS[data.classification.role]}</span>
            <span className="chip" style={{ background: C.card, color: C.inkSoft, padding: '4px 12px', fontSize: 12 }}>{PROCEDURE_STAGES[data.stage]?.label}</span>
            <span className="chip" style={{ background: C.card, color: C.inkSoft, padding: '4px 12px', fontSize: 12 }}>{LEVEL_LABELS[data.school_level]}</span>
          </div>
          <p className="leading-relaxed max-w-2xl text-sm" style={{ color: C.inkSoft }}>
            {COPY.headerDesc}
          </p>
        </div>
      </div>

      {/* M2 — LLM 친화 응답 카드 (응답이 있으면 표시).
          세션 14 옵션 A: 폴백 응답일 때는 사례 카드가 ≥1건이면 친화 카드를 숨긴다 —
          빈 안내문(폴백 friendly_response)이 사례 카드 위에서 노이즈가 되는 자리 차단. */}
      {(() => {
        const fr = data.llm?.friendly_response;
        if (!fr || fr.length === 0) return null;
        const serverStage = data.llm?._meta?.stage;
        const clientStage = data.llm?._client_meta?.stage;
        const isOkStage =
          serverStage === 'llm_ok' || serverStage === 'safety_keyword_pre_llm';
        const isFallback = !isOkStage || Boolean(clientStage);
        if (isFallback && allMatched.length > 0) return null;
        return (
          <div className="anim-fade-up mb-6" style={{ animationDelay: '0.02s' }}>
            <div className="card-base p-6" style={{ background: C.cardWarm, border: `1px solid ${C.line}` }}>
              <div className="flex items-center gap-2 mb-3">
                <MessageCircleQuestion size={18} color={C.accent} />
                <h3 className="font-semibold text-lg" style={{ color: C.ink }}>{COPY.sectionFriendly}</h3>
                {isFallback && (
                  <span className="chip text-[11px]" style={{ background: C.bg, color: C.amberDeep, padding: '2px 8px' }}>
                    폴백 응답
                  </span>
                )}
              </div>
              <p className="leading-relaxed" style={{ color: C.ink, whiteSpace: 'pre-wrap' }}>
                {fr}
              </p>
              {data.llm.ui_low_confidence_notice && (
                <div className="mt-4 p-3" style={{ background: C.bg, border: `1px dashed ${C.line}`, borderRadius: 12 }}>
                  <p className="text-sm" style={{ color: C.inkSoft }}>
                    <AlertCircle size={14} color={C.amberDeep} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} />
                    비슷한 사례를 찾기 어려웠어요. 직접 1388(청소년 상담) 또는 두루 공익법센터에 도움을 요청해 보세요.
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* 디버그 패널 */}
      <div className="anim-fade-up mb-6" style={{ animationDelay: '0.03s' }}>
        <ClassificationDebugPanel data={data} onUpdate={onClassificationUpdate} />
      </div>

      {/* 절차 단계 */}
      <div className="anim-fade-up mb-6" style={{ animationDelay: '0.05s' }}>
        <ProcedureTimeline currentStage={data.stage} />
      </div>

      {/* W4-A1 — 앞으로 진행될 상황 (회의 결과 항목 6) */}
      <div className="anim-fade-up mb-6" style={{ animationDelay: '0.08s' }}>
        <StageForecastSection stage={data.stage} />
      </div>

      {/* 유사 사례 */}
      <div className="anim-fade-up mb-6" style={{ animationDelay: '0.1s' }}>
        <div className="card-base p-7">
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <div className="flex items-center gap-2"><Search size={18} color={C.accent} /><h3 className="font-semibold text-lg" style={{ color: C.ink }}>{COPY.sectionCases}</h3></div>
            <span className="chip text-xs" style={{ background: C.cardWarm, color: C.amberDeep, padding: '4px 12px' }}>
              {matchedCases.length}건 표시 / 전체 {allMatched.length}건 매칭
            </span>
          </div>
          <p className="text-sm mb-1" style={{ color: C.inkSoft }}>카드를 누르면 어떤 부분이 결정적이었는지 자세히 볼 수 있어요.</p>
          {/* W4-A3 — 사례 면책 1줄. 비슷한 사례 ≠ 같은 결과. */}
          <p className="text-xs mb-4 flex items-start gap-1.5" style={{ color: C.amberDeep }}>
            <AlertCircle size={12} style={{ marginTop: 3, flexShrink: 0 }} />
            <span>이 사례들이 실제 상황과 같은 결과로 이어진다는 뜻은 아니에요. 각 사건은 사실관계에 따라 판단이 달라질 수 있어요.</span>
          </p>

          {/* 정렬 토글 */}
          {allMatched.length > 1 && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs" style={{ color: C.inkMute }}>정렬:</span>
              <button onClick={() => setSortMode('relevance')} style={{
                padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                border: `1px solid ${sortMode === 'relevance' ? C.accent : C.line}`,
                background: sortMode === 'relevance' ? C.accent : C.card,
                color: sortMode === 'relevance' ? 'white' : C.ink,
                cursor: 'pointer',
              }}>관련도순</button>
              <button onClick={() => setSortMode('recent')} style={{
                padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                border: `1px solid ${sortMode === 'recent' ? C.accent : C.line}`,
                background: sortMode === 'recent' ? C.accent : C.card,
                color: sortMode === 'recent' ? 'white' : C.ink,
                cursor: 'pointer',
              }}>최신순</button>
            </div>
          )}

          {allMatched.length === 0 ? (
            <div style={{ background: C.cardWarm, border: `1px solid ${C.line}`, borderRadius: 14, padding: 20, textAlign: 'center' }}>
              <AlertCircle size={28} color={C.amberDeep} style={{ margin: '0 auto 8px' }} />
              <p style={{ color: C.inkSoft, fontSize: 14 }}>비슷한 사례가 적어요. 흔치 않은 사건일 수 있어요. 변호사 직접 상담을 권장해요.</p>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-3">
                {matchedCases.map(c => <CaseCard key={c.case_id} c={c} onClick={() => setSelectedCase(c)} />)}
              </div>
              {/* 더보기 / 접기 */}
              {allMatched.length > 3 && (
                <div className="mt-4 text-center">
                  <button onClick={() => setExpanded(!expanded)} className="btn-ghost" style={{
                    padding: '10px 24px', background: C.cardWarm, borderColor: C.line,
                  }}>
                    {expanded ? (
                      <>접기 <ChevronUp size={15} /></>
                    ) : (
                      <>사례 더 찾아보기 ({Math.min(allMatched.length, 6) - 3}건 더 보기) <ChevronDown size={15} /></>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 서류 체크리스트 */}
      <div className="anim-fade-up mb-6" style={{ animationDelay: '0.15s' }}>
        <ChecklistSection docs={matchedDocs} />
      </div>

      {/* 용어 + FAQ */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="anim-fade-up" style={{ animationDelay: '0.2s' }}><TermsSection terms={matchedTerms} /></div>
        <div className="anim-fade-up" style={{ animationDelay: '0.25s' }}><FAQSection faqs={matchedFaqs} /></div>
      </div>

      {/* W5.1 — 도움 기관 안내 통합. 상담 상수(배지·홈페이지) + 상황 맞춤 기관을 한 섹션으로. */}
      <div className="anim-fade-up mb-8" style={{ animationDelay: '0.28s' }}>
        <HelpSection counseling={COUNSELING_RESOURCES} matched={matchedResources} />
      </div>

      {/* 면책 */}
      <div className="card-base p-5 mb-8" style={{ background: C.bg, border: `1px dashed ${C.line}` }}>
        <div className="flex gap-3">
          <AlertCircle size={18} color={C.amberDeep} style={{ flexShrink: 0, marginTop: 2 }} />
          <div className="text-sm leading-relaxed" style={{ color: C.inkSoft }}>
            <strong style={{ color: C.ink }}>이 안내는 법률 자문을 대신하지 않아요.</strong> 모든 사건은 구체적 사실관계에 따라 판단이 달라질 수 있어요. 중요한 결정 전에는 반드시 변호사와 상의해 주세요.
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 justify-center mb-12">
        <button onClick={onReset} className="btn-ghost"><RotateCcw size={15} /> 다시 시작하기</button>
        <button onClick={onNewDemo} className="btn-primary"><PlayCircle size={16} /> 다른 데모 시도하기</button>
      </div>

      <footer className="pt-8 text-center" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
        <div className="font-display text-base font-bold mb-2" style={{ color: C.ink }}>나란히 ver.3</div>
        <p className="text-xs" style={{ color: C.inkMute }}>두루미팀 · 두루 공익법센터 협력 · 테크포임팩트 캠퍼스<br />
          판례 {CASES.length}건 · 서류 {DOCUMENTS.length}건 · 용어 {LEGAL_TERMS.length}건 · FAQ {FAQS.length}건 · 기관 {RESOURCES.length}건 · 상담 {COUNSELING_RESOURCES.length}곳
        </p>
      </footer>

      {selectedCase && <CaseDetailModal c={selectedCase} onClose={() => setSelectedCase(null)} />}
    </div>
  );
}

/* ============================================================================
   MAIN APP — 세션 21 (W2-B): 사용자 흐름 6→5 단계 단순화
   --------------------------------------------------------------------------
   변경 전: Landing → Info → Situation → [Confirm overlay] → FollowUp → Loading → Results
   변경 후: Landing → Info → Situation → Details(통합) → Loading → Results
   [Confirm overlay] 가 Details 에 인라인 통합되고, Details 에서 LLM 키워드 동적 선택까지 수행.
   ============================================================================ */
const EMPTY_DATA = {
  gender: '', age_band: '', user_text: '',
  classification: null, full_code: '', school_level: '',
  follow_up: {}, stage: 0,
  llm: null,
  // W2-B 추가 — 키워드 동적 제안
  keyword_suggestions: null,     // LLM 응답 도착 시 배열로 채움. 미도착 시 null → 폴백 chip 표시.
  keyword_status: null,          // 'pending' | 'ok' | 'fallback' | null
  selected_keywords: [],         // 사용자가 chip 으로 다중 선택한 key 배열
  // W5 — 단계 질문(LLM 동적). 응답 도착 시 stages 배열. 미도착 시 null → 트리 기본 옵션 사용.
  stages_suggestions: null,
};

export default function App() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState(EMPTY_DATA);
  const [safetyAction, setSafetyAction] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(null);

  const reset = () => {
    setData(EMPTY_DATA);
    setSafetyAction(null);
    setLoadingStatus(null);
    setStep(0);
  };

  // step 3 (StepDetails) 진입 시 /api/suggestKeywords 비동기 호출.
  // 응답이 늦더라도 폴백 chip 이 이미 보이는 상태라 UX는 차단되지 않는다.
  useEffect(() => {
    if (step !== 3) return;
    if (data.keyword_status === 'ok' || data.keyword_status === 'fallback') return; // 한 번만 호출
    if (!data.user_text) return;
    let aborted = false;
    setData((d) => ({ ...d, keyword_status: 'pending' }));
    (async () => {
      const meta = {
        role: data.classification?.role,
        age: data.age_band,
        school_level: data.school_level,
      };
      const result = await callSuggestKeywords({ text: data.user_text, meta });
      if (aborted) return;
      const isFallback = Boolean(result._fallback_meta || result._client_meta);
      setData((d) => ({
        ...d,
        keyword_suggestions: result.suggestions,
        // W5 — stages 가 응답에 있으면 함께 저장. 없으면 폴백.
        stages_suggestions: Array.isArray(result.stages) && result.stages.length > 0
          ? result.stages
          : FALLBACK_STAGES,
        keyword_status: isFallback ? 'fallback' : 'ok',
      }));
    })();
    return () => { aborted = true; };
  }, [step, data.user_text, data.keyword_status, data.classification?.role, data.age_band, data.school_level]);

  // step 4 (StepLoading) 진입 시 /api/classify 호출. 선택 키워드를 meta 에 함께 전달.
  useEffect(() => {
    if (step !== 4) return;
    let aborted = false;
    setLoadingStatus('llm_pending');
    (async () => {
      const meta = {
        role: data.classification?.role,
        age: data.age_band,
        school_level: data.school_level,
        // 선택한 키워드는 *키 + label* 둘 다 전달 — LLM이 의도 파악에 활용
        selected_keywords: (data.selected_keywords ?? []).map((k) => {
          const found = (data.keyword_suggestions ?? FALLBACK_SUGGESTIONS).find((s) => s.key === k);
          return found ? { key: found.key, label: found.label, category: found.category } : { key: k };
        }),
      };
      const result = await callClassify({ text: data.user_text, meta });
      if (aborted) return;
      if (result.safety_signals?.has_safety_flag) {
        const reason = (result.safety_signals.reason ?? '').toLowerCase();
        const action = reason.includes('자해') || reason.includes('자살') ? 'urgent_self_harm' : 'urgent_domestic';
        setSafetyAction(action);
        return;
      }
      setData((d) => ({ ...d, llm: result }));
      setLoadingStatus('llm_done');
      setStep(5);
    })();
    return () => { aborted = true; };
  }, [step, data.user_text, data.classification?.role, data.age_band, data.school_level, data.selected_keywords, data.keyword_suggestions]);

  const loadDemo = (persona) => {
    reset();
    setData(d => ({ ...d, gender: persona.gender, age_band: persona.age_band, user_text: persona.text }));
    setStep(2); // Skip to situation, with data prefilled.
  };

  // Step 2 → Classify. 결과를 그대로 step 3 (Details) 로 흘려보낸다 — overlay 없음.
  const handleSituationNext = () => {
    const cls = classify(data.user_text);
    if (cls.is_safety_branch) {
      setSafetyAction(cls.safety_action);
      return;
    }
    const levelInfo = inferSchoolLevel(data.age_band);
    const fullCode = `SV-${cls.type_main}-${cls.role}-${cls.stage_signal}-${levelInfo.school_level}`;
    setData(d => ({
      ...d,
      classification: cls,
      full_code: fullCode,
      school_level: levelInfo.school_level,
      stage: cls.stage_signal,
      // 새 텍스트로 진행할 때 이전 키워드 응답·선택은 무효화
      keyword_suggestions: null,
      keyword_status: null,
      stages_suggestions: null,
      selected_keywords: [],
    }));
    setStep(3);
  };

  const tree = data.classification ? selectQuestionTree(data.classification.type_main, data.classification.role) : null;

  // Safety branch override
  if (safetyAction) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.ink }}>
        <GlobalStyles />
        <Header onHome={reset} />
        <SafetyBranchScreen action={safetyAction} onReset={reset} />
      </div>
    );
  }

  // 분류 결과 수정 핸들러 (StepDetails 인라인 편집 + 결과 페이지 디버그 패널에서 모두 사용)
  const handleClassificationUpdate = ({ type_main, role }) => {
    const levelInfo = inferSchoolLevel(data.age_band);
    setData(d => {
      const newCls = { ...d.classification, type_main, role };
      const newCode = `SV-${type_main}-${role}-${newCls.stage_signal}-${levelInfo.school_level}`;
      return { ...d, classification: newCls, full_code: newCode };
    });
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.ink }}>
      <GlobalStyles />
      <Header onHome={reset} showBack={step > 0 && step < 4} onBack={() => setStep(s => Math.max(0, s - 1))} />
      {/* 진행바: step 1~4 에서만 노출. total=4 — 4개 active 단계 (Info / Situation / Details / Loading). */}
      {step > 0 && step < 5 && <ProgressBar step={step} total={4} />}

      <main>
        {step === 0 && <Landing onStart={() => setStep(1)} onDemo={loadDemo} />}
        {step === 1 && <StepInfo data={data} onChange={setData} onNext={() => setStep(2)} onBack={() => setStep(0)} />}
        {step === 2 && <StepSituation data={data} onChange={setData} onNext={handleSituationNext} onBack={() => setStep(1)} />}
        {step === 3 && data.classification && (
          <StepDetails
            data={data}
            tree={tree}
            onChange={setData}
            onUpdate={handleClassificationUpdate}
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && <StepLoading status={loadingStatus} />}
        {step === 5 && <StepResults data={data} onReset={reset} onNewDemo={() => setStep(0)} onClassificationUpdate={handleClassificationUpdate} />}
      </main>
    </div>
  );
}
