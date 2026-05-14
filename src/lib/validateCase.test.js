// validateCase 테스트 스크립트.
// 실행: node src/lib/validateCase.test.js
// 종료 코드: 0=전체 통과, 1=실패.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { validateCase } from './validateCase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..', '..');

// REVIEWED/*.json 10건 로드 (C-3 변환 완료 — 스키마 v2 conformant)
const reviewedDir = resolve(repoRoot, 'src/data/cases/REVIEWED');
const reviewedFiles = readdirSync(reviewedDir)
  .filter((f) => f.endsWith('.json'))
  .sort();
const reviewedCases = reviewedFiles.map((f) =>
  JSON.parse(readFileSync(resolve(reviewedDir, f), 'utf8'))
);

// OM2 사례 3건 로드 (PENDING/ 도입은 C-4 — 지금은 _staging/에서 직접)
const om2File = JSON.parse(
  readFileSync(
    resolve(repoRoot, '_staging/onmaeum2_outputs/cases_from_onmaeum2.json'),
    'utf8'
  )
);
const om2 = om2File.cases;

// 합성 케이스 — validateCase 로직 정확성 확인
// 베이스로 첫 번째 REVIEWED 케이스를 사용 (이미 schema v2 conformant)
const base = reviewedCases.find((c) => c.case_id === 'SAMPLE-001') || reviewedCases[0];

const SYNTHETIC = [
  {
    label: 'valid-sample (대조군)',
    expect: 'ok',
    data: base,
  },
  {
    label: 'invalid-missing-case-type',
    expect: 'fail',
    expectErrorMatch: /case_type — 기본 필수 필드 누락/,
    data: (() => {
      const c = { ...base };
      delete c.case_type;
      return c;
    })(),
  },
  {
    label: 'invalid-recognition-no-reasons',
    expect: 'fail',
    expectErrorMatch: /not_recognized_reasons — recognition='불인정'일 때/,
    data: {
      ...base,
      case_id: 'SYN-RECOG',
      recognition: '불인정',
      not_recognized_reasons: [],
    },
  },
  {
    label: 'invalid-stage-out-of-range',
    expect: 'fail',
    expectErrorMatch: /stage_focus — 숫자 0~9이어야 함/,
    data: { ...base, case_id: 'SYN-STAGE', stage_focus: 11 },
  },
];

let realPass = 0;
let realTotal = 0;

console.log('=== validateCase 테스트 ===\n');

console.log('[1A] src/data/cases/REVIEWED/ (10건, schema v2 conformant):');
for (const c of reviewedCases) {
  realTotal++;
  const { ok, errors } = validateCase(c);
  if (ok) {
    console.log(`  ✓ ${c.case_id}  ok`);
    realPass++;
  } else {
    console.log(`  ✗ ${c.case_id}  errors=${errors.length}`);
    errors.forEach((e) => console.log(`      ${e}`));
  }
}
console.log();

console.log('[1B] _staging/onmaeum2_outputs/cases_from_onmaeum2.json (3건):');
for (const c of om2) {
  realTotal++;
  const { ok, errors } = validateCase(c);
  if (ok) {
    console.log(`  ✓ ${c.case_id}  ok`);
    realPass++;
  } else {
    console.log(`  ✗ ${c.case_id}  errors=${errors.length}`);
    errors.forEach((e) => console.log(`      ${e}`));
  }
}
console.log();

console.log('[2] 합성 케이스:');
let synMatched = 0;
for (const t of SYNTHETIC) {
  const { ok, errors } = validateCase(t.data);
  const actual = ok ? 'ok' : 'fail';
  if (actual !== t.expect) {
    console.log(`  ✗ ${t.label}  기대=${t.expect}, 실제=${actual}`);
    errors.forEach((e) => console.log(`      ${e}`));
    continue;
  }
  if (t.expect === 'fail' && t.expectErrorMatch) {
    const found = errors.some((e) => t.expectErrorMatch.test(e));
    if (!found) {
      console.log(`  ✗ ${t.label}  fail은 맞으나 기대 에러 패턴 매치 안 됨`);
      console.log(`      기대 패턴: ${t.expectErrorMatch}`);
      errors.forEach((e) => console.log(`      실제: ${e}`));
      continue;
    }
  }
  console.log(`  ✓ ${t.label}  ${actual} (기대대로)`);
  synMatched++;
}
console.log();

const allRealPass = realPass === realTotal;
const allSynMatched = synMatched === SYNTHETIC.length;

console.log(
  `요약: 실제 ${realPass}/${realTotal} 통과, 합성 ${synMatched}/${SYNTHETIC.length} 기대 일치`
);

if (allRealPass && allSynMatched) {
  console.log('✓ 전체 통과');
  process.exit(0);
} else {
  console.log('✗ 실패');
  process.exit(1);
}
