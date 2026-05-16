// 「나란히」 LLM E2E 테스트 — 세션 10
//
// api/classify.js 핸들러를 *직접 import* 해서 호출 (vercel dev 불필요).
// 시나리오 5개로 응답 검증 + prompt caching 효과 측정.
//
// 실행: npm run llm:test
//
// 안전 제약 (세션 10):
// - 최대 5회 호출 (예산 안전)
// - 시나리오 #2는 키워드 1단계에서 우회되므로 실제 LLM 호출은 ~4회
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
];

function makeRequest(body) {
  return new Request('http://localhost/api/classify', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
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
  return issues;
}

function preview(text, n = 140) {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
}

console.log('🌱 「나란히」 LLM E2E 테스트 — 세션 10\n');
console.log(`   시나리오 ${SCENARIOS.length}개 / 모델 claude-haiku-4-5 / caching ephemeral`);
console.log(`   예산 안전: 최대 ${SCENARIOS.length}회 호출\n`);

let totalCost = 0;
let cacheHits = 0;
let cacheCreations = 0;
let llmCalls = 0;
const failures = [];

for (const s of SCENARIOS) {
  process.stdout.write(`[${s.id}] ${s.label} ... `);
  const start = Date.now();
  const req = makeRequest(s.body);
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
console.log('\n✅ 시나리오 5개 모두 기대대로 동작 — M2 세션 10 e2e 통과');
