// 일회성 스크립트 — _staging의 OM2 통합 JSON 3건을 src/data/cases/PENDING/에 분리.
// case_type="alternative_resolution" 가정. F그룹(recognition/category/sentence/not_recognized_reasons)은
// 학폭위 처분 인정/불인정 영역 외이므로 null/[]로 정규화. 누락된 보충 필드는 null로 채움.
// 기존 의미 보존이 원칙 — 새 콘텐츠 생성 없음.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');
const sourceFile = resolve(repoRoot, '_staging/onmaeum2_outputs/cases_from_onmaeum2.json');
const pendingDir = resolve(repoRoot, 'src/data/cases/PENDING');

// 스키마 v2 (42필드) 기본값 — alternative_resolution 사례에 적용.
function buildDefaults() {
  return {
    // A. 식별자 — case_id, case_type 모두 원본에 있음
    // B. 출처·검증 — 원본에 있음
    // C. 분류 코드 — 원본에 있음
    // D. 원문 — 원본에 있음
    // E. 친화 변환 — 원본에 있음
    // F. 카드 표시 — alternative_resolution은 학폭위 처분 인정/불인정 영역 외 (N/A)
    recognition: null,
    category: null,
    sentence: null,
    not_recognized_reasons: [],
    // G. 안전 — safety_flag=false 사례에서 누락 시 채움
    safety_flag_reason: null,
    safety_banner: null,
    // H. 검수 — 원본에 있음
    // I. 보충 메모 — 누락 시 null
    stage_focus_note: null,
    school_level_note: null,
    role_focus_note: null,
  };
}

// 스키마 v2 필드 순서 — transform_cases_v2.mjs와 동일.
const FIELD_ORDER = [
  'case_id', 'case_type',
  'source_type', 'source_citation', 'decision_date', 'court', 'case_number', 'case_title_formal',
  'type_main', 'subtypes', 'role_focus', 'stage_focus', 'school_level', 'applies_to', 'keywords',
  'original_summary', 'original_facts', 'original_facts_raw', 'original_law',
  'original_disposition', 'original_full_text', 'original_text_snippet',
  'friendly_title', 'friendly_summary', 'key_factors', 'severity_factors', 'related_laws_friendly',
  'disposition_summary', 'recognition', 'category', 'sentence', 'not_recognized_reasons',
  'safety_flag', 'safety_flag_reason', 'safety_banner',
  'privacy_check', 'privacy_notes', 'review_status', 'reviewer', 'reviewed_at', 'review_notes',
  'stage_focus_note', 'school_level_note', 'role_focus_note',
];

function reorder(obj) {
  const out = {};
  for (const k of FIELD_ORDER) {
    if (k in obj) out[k] = obj[k];
  }
  for (const k of Object.keys(obj)) {
    if (!(k in out)) out[k] = obj[k];
  }
  return out;
}

function normalize(c) {
  const defaults = buildDefaults();
  // 원본 우선 (원본에 있는 키는 default로 덮지 않음)
  const out = { ...defaults, ...c };
  return reorder(out);
}

mkdirSync(pendingDir, { recursive: true });

const wrapper = JSON.parse(readFileSync(sourceFile, 'utf8'));
const cases = wrapper.cases;
let count = 0;
for (const c of cases) {
  if (!c.case_id) {
    console.error('case_id 누락 — 건너뜀:', c);
    continue;
  }
  const out = normalize(c);
  const outPath = resolve(pendingDir, `${c.case_id}.json`);
  writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`  ✓ ${c.case_id}.json`);
  count++;
}
console.log(`총 ${count}건 분리 완료.`);
