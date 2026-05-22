// 「나란히」 LLM E2E 테스트 — 세션 10 + W1 톤 검증 확장
//
// api/classify.js 핸들러를 *직접 import* 해서 호출 (vercel dev 불필요).
// 시나리오 8개(기존 5 + role_focus 어조 검증 3)로 응답 검증 + prompt caching 효과 측정.
//
// 실행: npm run llm:test
//
// 안전 제약 (세션 10 + W1):
// - 최대 8회 호출 (예산 안전 — 기존 5 + W1 톤 검증 3)
// - 시나리오 #2 는 키워드 1단계에서 우회되므로 실제 LLM 호출은 ~7회
// - prompt caching ephemeral 5분 TTL — 연속 호출이라 캐시 적중 기대

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(projectRoot, '.env.local') });

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY 누락 — .env.local 확인');
  process.exit(1);
}

// classify.js 의 default export 동적 import (ESM)
const { default: handler } = await import('../api/classify.js');

// ───────────────────────────────────────────────────────────────
// 어조 검증 헬퍼 (W1)
// ───────────────────────────────────────────────────────────────
// 존댓말(formal) 마커: 합쇼체·해요체 종결과 안내형 명령
const FORMAL_MARKERS = ['습니다', '입니다', '됩니다', '됩니다', '하세요', '보세요', '주세요', '드립니다', '드려요'];
// 따뜻한 반말(informal) 마커: 너 호칭 + 반말 종결어미.
// "구나/이야/거야/보자" 같은 반말 어미는 존댓말 응답에 거의 등장하지 않으므로 강한 지표.
const INFORMAL_MARKERS = [
  '너의', '너에게', '네가', '너는', '너도',
  '구나', '이야', '아니야', '거야', '보자', '봐.', '해.', '돼.',
];
// 어른 강조 마커
const ADULT_MARKERS = ['어른', '선생님', '상담', '부모님', '보호자', '담임'];
// 화해·회복 강조 마커 (가해자 톤용)
const RECONCILIATION_MARKERS = ['회복', '사과', '반성', '관계회복', '책임', '함께', '복구', '인정'];
// 결과 강조 마커 (가해자 톤에서 *덜 강조*되어야 함 — 균형 점검용, 완전 금지가 아니라 회복 마커도 함께 있어야 OK)
const OUTCOME_MARKERS = ['처분', '생기부', '징계', '학교생활기록부'];

function containsAny(text, markers) {
  return markers.some((m) => text.includes(m));
}
function countAny(text, markers) {
  return markers.reduce((n, m) => n + (text.includes(m) ? 1 : 0), 0);
}

// 어조 검증: tone='formal' | 'warm_informal'
function checkTone(text, tone) {
  const issues = [];
  if (!text) {
    issues.push('friendly_response 비어 있음');
    return issues;
  }
  if (tone === 'formal') {
    if (!containsAny(text, FORMAL_MARKERS)) {
      issues.push(`존댓말 마커 없음 (예상: ${FORMAL_MARKERS.slice(0, 4).join('/')} 등)`);
    }
    // 반말 마커가 1개 정도는 인용 등으로 섞일 수 있으나, 2개 이상이면 반말 톤으로 판정.
    if (countAny(text, INFORMAL_MARKERS) >= 2) {
      issues.push(`반말 마커 과다 (존댓말 시나리오에 ${INFORMAL_MARKERS.join('/')} 가 2회 이상)`);
    }
  } else if (tone === 'warm_informal') {
    if (!containsAny(text, INFORMAL_MARKERS)) {
      issues.push(`따뜻한 반말 마커 없음 (예상: ${INFORMAL_MARKERS.slice(0, 3).join('/')} 등)`);
    }
  }
  return issues;
}

// 어른 존재 강조 검증
function checkAdultEmphasis(text) {
  return containsAny(text, ADULT_MARKERS)
    ? []
    : [`어른 존재 강조 없음 (예상: ${ADULT_MARKERS.slice(0, 4).join('/')} 등)`];
}

// 가해자 톤 추가 검증: 회복·반성 마커 1개 이상 + (결과 마커가 많을 때만 회복 마커 ≥ 결과 마커)
function checkPerpetratorTone(text) {
  const issues = [];
  const rec = countAny(text, RECONCILIATION_MARKERS);
  const out = countAny(text, OUTCOME_MARKERS);
  if (rec === 0) {
    issues.push(`화해·반성·회복 마커 없음 (예상: ${RECONCILIATION_MARKERS.slice(0, 4).join('/')} 등)`);
  }
  if (out >= 3 && rec < out) {
    issues.push(`결과(처분·징계) 과강조 — 결과 ${out}회 vs 회복 ${rec}회 (회복이 결과 이상이어야 함)`);
  }
  return issues;
}

// ───────────────────────────────────────────────────────────────
// 시나리오 정의
// ───────────────────────────────────────────────────────────────
const SCENARIOS = [
  {
    id: 'A_cyber_perpetrator',
    label: '사이버폭력 가해 (P-001 패턴)',
    body: {
      text: '단톡방에서 친구 별명을 부르면서 놀렸어요. 그 친구가 그만하라고 했는데 한 번 더 했고 캡처본이 있다고 해요.',
      meta: { role: 'G', age: 15, school_level: 'MS' },
    },
    expect: { safety_flag: false, min_matches: 1 },
  },
  {
    id: 'B_safety_domestic',
    label: '안전 분기 — 가정폭력 (P-005 패턴, 키워드 1단계 우회 기대)',
    body: {
      text: '아빠가 자꾸 때려요. 집에 가기 싫어요.',
      meta: { role: 'V', age: 13, school_level: 'MS' },
    },
    expect: { safety_flag: true, stage_should_be: 'safety_keyword_pre_llm' },
  },
  {
    id: 'C_physical_unrecognized',
    label: '복도 어깨 — 학폭 불인정 잠재 (SAMPLE-002 유사)',
    body: {
      text: '복도에서 친구 어깨를 살짝 부딪쳤어요. 일부러 그런 건 아니었는데 신고됐다고 해요. 어떻게 해야 하나요?',
      meta: { role: 'G', age: 14, school_level: 'MS' },
    },
    expect: { safety_flag: false, min_matches: 1 },
  },
  {
    id: 'D_sns_victim',
    label: 'SNS 유포 — 피해자 시점 (SAMPLE-004 유사)',
    body: {
      text: '제 사진을 누가 SNS에 올려서 비웃었어요. 그 글이 퍼지고 있어요. 어떻게 해야 하나요?',
      meta: { role: 'V', age: 16, school_level: 'HS' },
    },
    expect: { safety_flag: false, min_matches: 1 },
  },
  {
    id: 'E_parent_inquiry',
    label: '보호자 시점 — 신고 절차 안내',
    body: {
      text: '아이가 학교에서 친구들에게 따돌림을 받는다고 해요. 어떻게 신고하고 진행하는지 알려주세요.',
      meta: { role: 'P', age: null, school_level: 'ES' },
    },
    expect: { safety_flag: false, min_matches: 1 },
  },
  // ───────────────────────────── W1 톤 검증 시나리오 3건 ─────────────────────────────
  {
    id: 'F_tone_perpetrator_formal',
    label: '[W1] 가해자(G) 톤 — 존댓말 + 결과 덜 강조 + 화해·반성 강조',
    body: {
      text: '학교에서 친구를 밀쳐서 다치게 했어요. 학폭위에 출석하라는 통보를 받았고 어떻게 대응할지 모르겠습니다. 진심으로 미안한 마음이 있어요.',
      meta: { role: 'G', age: 15, school_level: 'MS' },
    },
    expect: {
      safety_flag: false,
      min_matches: 1,
      tone: 'formal',
      adult_emphasis: true,
      perpetrator_balance: true,
    },
  },
  {
    id: 'G_tone_parent_formal',
    label: '[W1] 보호자(P) 톤 — 존댓말 + 보호자 안내',
    body: {
      text: '아이가 단톡방에서 다른 친구에게 욕설을 했다며 학교에서 연락이 왔습니다. 보호자로서 어떤 절차를 거치게 되는지 알려주세요.',
      meta: { role: 'P', age: null, school_level: 'MS' },
    },
    expect: {
      safety_flag: false,
      min_matches: 1,
      tone: 'formal',
      adult_emphasis: true,
    },
  },
  {
    id: 'H_tone_victim_warm',
    label: '[W1] 피해자(V) 톤 — 따뜻한 반말 + 어른 존재 강조',
    body: {
      text: '친구들이 자꾸 저만 빼고 모둠을 해요. 점심도 혼자 먹고 있어요. 어떻게 해야 할지 모르겠어요.',
      meta: { role: 'V', age: 12, school_level: 'ES' },
    },
    expect: {
      safety_flag: false,
      min_matches: 1,
      tone: 'warm_informal',
      adult_emphasis: true,
    },
  },
];

// 분당 5회/IP rate limit 회피 — 시나리오마다 고유 IP 사용.
// (rateLimit 모듈 자체는 운영 동작 그대로, 테스트만 다른 키 사용)
function makeRequest(body, scenarioIdx) {
  return new Request('http://localhost/api/classify', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `127.0.0.${10 + scenarioIdx}`,
    },
    body: JSON.stringify(body),
  });
}

const PRICE_HAIKU_45 = {
  input: 1.0,
  output: 5.0,
  cache_write: 1.25,
  cache_read: 0.1,
};

function estimateCost(usage) {
  if (!usage) return 0;
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cw = usage.cache_creation_input_tokens ?? 0;
  const cr = usage.cache_read_input_tokens ?? 0;
  return (
    (input * PRICE_HAIKU_45.input +
      output * PRICE_HAIKU_45.output +
      cw * PRICE_HAIKU_45.cache_write +
      cr * PRICE_HAIKU_45.cache_read) /
    1_000_000
  );
}

function checkExpect(parsed, expect) {
  const issues = [];
  if (expect.safety_flag !== undefined) {
    if (parsed.safety_signals?.has_safety_flag !== expect.safety_flag) {
      issues.push(`safety_flag expected=${expect.safety_flag} got=${parsed.safety_signals?.has_safety_flag}`);
    }
  }
  if (expect.min_matches !== undefined) {
    if (!Array.isArray(parsed.matched_case_ids) || parsed.matched_case_ids.length < expect.min_matches) {
      issues.push(`matched_case_ids expected≥${expect.min_matches} got=${parsed.matched_case_ids?.length}`);
    }
  }
  if (expect.stage_should_be) {
    if (parsed._meta?.stage !== expect.stage_should_be) {
      issues.push(`stage expected=${expect.stage_should_be} got=${parsed._meta?.stage}`);
    }
  }
  // W1 — 어조 검증
  if (expect.tone) {
    issues.push(...checkTone(parsed.friendly_response, expect.tone));
  }
  if (expect.adult_emphasis) {
    issues.push(...checkAdultEmphasis(parsed.friendly_response));
  }
  if (expect.perpetrator_balance) {
    issues.push(...checkPerpetratorTone(parsed.friendly_response));
  }
  return issues;
}

function preview(text, n = 140) {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
}

console.log('🌱 「나란히」 LLM E2E 테스트 — W1 톤 검증 확장\n');
console.log(`   시나리오 ${SCENARIOS.length}개 / 모델 claude-haiku-4-5 / caching ephemeral`);
console.log(`   예산 안전: 최대 ${SCENARIOS.length}회 호출 (기존 5 + W1 톤 검증 3)\n`);

let totalCost = 0;
let cacheHits = 0;
let cacheCreations = 0;
let llmCalls = 0;
const failures = [];

for (let idx = 0; idx < SCENARIOS.length; idx++) {
  const s = SCENARIOS[idx];
  process.stdout.write(`[${s.id}] ${s.label} ... `);
  const start = Date.now();
  const req = makeRequest(s.body, idx);
  const resp = await handler(req);
  const elapsed = Date.now() - start;
  const parsed = await resp.json();

  const stage = parsed._meta?.stage ?? 'unknown';
  const usage = parsed._meta?.usage;
  const cost = estimateCost(usage);
  totalCost += cost;
  // LLM이 호출된 모든 경우(usage 존재) 카운트 — 성공·파싱실패·검증실패 모두 포함.
  if (usage && (usage.input_tokens ?? 0) > 0) {
    llmCalls += 1;
    if ((usage.cache_read_input_tokens ?? 0) > 0) cacheHits += 1;
    if ((usage.cache_creation_input_tokens ?? 0) > 0) cacheCreations += 1;
  }

  const issues = checkExpect(parsed, s.expect);
  const ok = issues.length === 0;
  console.log(ok ? '✓' : '✗');
  console.log(`   stage: ${stage}, elapsed: ${elapsed}ms`);
  console.log(`   matched: [${(parsed.matched_case_ids ?? []).join(', ')}]`);
  console.log(`   safety: flag=${parsed.safety_signals?.has_safety_flag} reason=${parsed.safety_signals?.reason}`);
  console.log(`   confidence: ${parsed.confidence}`);
  console.log(`   응답: ${preview(parsed.friendly_response)}`);
  if (usage) {
    console.log(
      `   usage: input=${usage.input_tokens} output=${usage.output_tokens} cache_write=${usage.cache_creation_input_tokens} cache_read=${usage.cache_read_input_tokens} → $${cost.toFixed(6)}`,
    );
  }
  if (parsed._meta?.raw) {
    console.log(`   raw[0..200]: ${parsed._meta.raw.slice(0, 200).replace(/\n/g, ' ')}`);
  }
  if (!ok) {
    failures.push({ id: s.id, issues });
    console.log(`   ✗ 검증 실패: ${issues.join('; ')}`);
  }
  console.log('');
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`총 LLM 호출: ${llmCalls}회 (시나리오 ${SCENARIOS.length}개 중 ${SCENARIOS.length - llmCalls}건은 1단계 우회)`);
console.log(`캐시 생성: ${cacheCreations}회 / 캐시 적중: ${cacheHits}회`);
console.log(`총 비용 추정: $${totalCost.toFixed(6)} (~${(totalCost * 1380).toFixed(2)}원)`);
if (failures.length > 0) {
  console.log(`\n❌ 실패 ${failures.length}건:`);
  for (const f of failures) console.log(`  - ${f.id}: ${f.issues.join('; ')}`);
  process.exit(1);
}
console.log(`\n✅ 시나리오 ${SCENARIOS.length}개 모두 기대대로 동작 — W1 톤 검증 e2e 통과`);
