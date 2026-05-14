// 일회성 스크립트 — REVIEWED/*.json 10건을 스키마 v2 (42필드)로 변환.
// 기존 필드 보존, 누락 필드를 null/빈 배열/명시 값으로 채움.
// CLAUDE.md §4 스키마 v2와 일치.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');
const reviewedDir = resolve(repoRoot, 'src/data/cases/REVIEWED');

const PR_NOTE =
  "PR prefix 의미는 두루미팀 확인 필요. 작성 톤·메타·case_number 형식이 SAMPLE-001~005와 동일하여 같은 등급으로 분류함.";

// SAMPLE-005의 not_recognized_reasons는 빈 배열인데 recognition="일부인정".
// 기존 severity_factors[0]("명시적 협박이 없어 처분 수위는 낮은 편")과 friendly_summary
// ("협박은 없었지만 여러 명이 함께 요구한 분위기 자체가 압박이 됐다는 점이 인정")에서
// 명시적 협박 부재가 *불인정된 요소*임이 도출됨. 이를 not_recognized_reasons로 옮김.
const SAMPLE_005_REASONS = [
  "명시적 협박이나 위계적 강제력이 인정되지 않음 — 분위기 압박만 학교폭력으로 인정",
];

// 스키마 v2 (42필드)의 *기본값* — 기존에 없으면 채울 값.
// CLAUDE.md §4 A~I 그룹 순서.
function buildDefaults() {
  return {
    // A. 식별자
    case_type: 'sample', // 10건 모두 가상 사례
    // B. 출처·검증 (sample은 가상이므로 null)
    source_type: null,
    source_citation: null,
    // decision_date / court / case_number / case_title_formal — 기존 그대로
    // C. 분류 코드 — 기존 그대로
    // D. 원문 (sample은 원문 없음 — 모두 null/빈 배열)
    original_summary: null,
    original_facts: [],
    original_facts_raw: null,
    original_law: null,
    original_disposition: null,
    original_full_text: null,
    original_text_snippet: null,
    // E. 친화 변환 (key_factors/severity_factors 기존, related_laws_friendly 추가)
    related_laws_friendly: [],
    // F. 카드 표시 — 기존 그대로 (recognition/category/sentence/not_recognized_reasons)
    // G. 안전 — SAMPLE/PR 10건 모두 안전 신호 없음
    safety_flag: false,
    safety_flag_reason: null,
    safety_banner: null,
    // H. 검수
    privacy_check: 'Y', // 가상 사례 — 실명·실지 없음
    privacy_notes: null,
    review_status: '검수완료(가상사례·인수인계기준)',
    reviewer: null,
    reviewed_at: null,
    review_notes: null,
    // I. 보충 메모
    stage_focus_note: null,
    school_level_note: null,
    role_focus_note: null,
  };
}

// 스키마 v2 필드 순서 — 출력 일관성용
const FIELD_ORDER = [
  // A
  'case_id', 'case_type',
  // B
  'source_type', 'source_citation', 'decision_date', 'court', 'case_number', 'case_title_formal',
  // C
  'type_main', 'subtypes', 'role_focus', 'stage_focus', 'school_level', 'applies_to', 'keywords',
  // D
  'original_summary', 'original_facts', 'original_facts_raw', 'original_law',
  'original_disposition', 'original_full_text', 'original_text_snippet',
  // E
  'friendly_title', 'friendly_summary', 'key_factors', 'severity_factors', 'related_laws_friendly',
  // F
  'disposition_summary', 'recognition', 'category', 'sentence', 'not_recognized_reasons',
  // G
  'safety_flag', 'safety_flag_reason', 'safety_banner',
  // H
  'privacy_check', 'privacy_notes', 'review_status', 'reviewer', 'reviewed_at', 'review_notes',
  // I
  'stage_focus_note', 'school_level_note', 'role_focus_note',
];

function reorder(obj) {
  const out = {};
  for (const k of FIELD_ORDER) {
    if (k in obj) out[k] = obj[k];
  }
  // 혹시 FIELD_ORDER에 없는 키가 있으면 뒤에 append (안전망)
  for (const k of Object.keys(obj)) {
    if (!(k in out)) out[k] = obj[k];
  }
  return out;
}

function transform(c) {
  const defaults = buildDefaults();
  const out = { ...defaults, ...c };

  // SAMPLE-005: 일부인정 → not_recognized_reasons 보강
  if (
    c.case_id === 'SAMPLE-005' &&
    (!Array.isArray(c.not_recognized_reasons) || c.not_recognized_reasons.length === 0)
  ) {
    out.not_recognized_reasons = SAMPLE_005_REASONS;
  }

  // PR-006~010: review_notes에 prefix 미확인 명시
  if (c.case_id && c.case_id.startsWith('PR-')) {
    out.review_notes = PR_NOTE;
  }

  return reorder(out);
}

const files = readdirSync(reviewedDir)
  .filter((f) => f.endsWith('.json'))
  .sort();

let count = 0;
for (const f of files) {
  const filePath = resolve(reviewedDir, f);
  const original = JSON.parse(readFileSync(filePath, 'utf8'));
  const transformed = transform(original);
  writeFileSync(filePath, JSON.stringify(transformed, null, 2) + '\n', 'utf8');
  console.log(`  ✓ ${f}`);
  count++;
}
console.log(`총 ${count}건 변환 완료.`);
