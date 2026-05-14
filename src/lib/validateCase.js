// 스키마 v2 검증 함수. CLAUDE.md §4의 필수/선택 규칙을 코드화.
// 단순 { ok, errors } 반환. 경고/에러 구분 없음 (YAGNI).
// 모든 위반 수집 — 한 번 호출로 전체 갭 파악.

const BASIC_REQUIRED = [
  'case_id',
  'case_type',
  'type_main',
  'role_focus',
  'stage_focus',
  'school_level',
  'applies_to',
  'friendly_title',
  'friendly_summary',
  'review_status',
];

const CASE_TYPE_ENUM = ['precedent', 'alternative_resolution', 'sample'];

const ADDITIONAL_REQUIRED_BY_TYPE = {
  precedent: ['source_type', 'source_citation', 'original_law', 'disposition_summary'],
  alternative_resolution: ['source_citation', 'original_summary'],
  sample: ['disposition_summary', 'recognition', 'key_factors'],
};

const RECOGNITION_REQUIRING_REASONS = new Set(['불인정', '일부인정']);

function isEmpty(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string' && v.length === 0) return true;
  if (Array.isArray(v) && v.length === 0) return true;
  // false, 0은 의도된 값으로 취급 — 비어 있지 않음.
  return false;
}

function formatValue(v) {
  if (v === undefined) return '없음';
  if (v === null) return 'null';
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    return `[${v.length}개]`;
  }
  if (typeof v === 'object') return '{객체}';
  return JSON.stringify(v);
}

function fmt(caseId, field, rule, value) {
  const id = caseId || '(없음)';
  return `[case_id: ${id}] ${field} — ${rule} (현재: ${formatValue(value)})`;
}

export function validateCase(caseObj) {
  const errors = [];

  // 1. 입력 검증 — 객체 아니면 즉시 종료
  if (
    typeof caseObj !== 'object' ||
    caseObj === null ||
    Array.isArray(caseObj)
  ) {
    errors.push(
      `[case_id: (불가)] (입력) — 객체가 아님 (현재: ${typeof caseObj})`
    );
    return { ok: false, errors };
  }

  const id = caseObj.case_id;

  // 3. 기본 필수 10개
  for (const field of BASIC_REQUIRED) {
    if (isEmpty(caseObj[field])) {
      errors.push(fmt(id, field, '기본 필수 필드 누락', caseObj[field]));
    }
  }

  // 4. case_type enum 검증
  const caseType = caseObj.case_type;
  let caseTypeValid = false;
  if (!isEmpty(caseType)) {
    if (!CASE_TYPE_ENUM.includes(caseType)) {
      errors.push(
        fmt(
          id,
          'case_type',
          `enum 외 값 (허용: ${CASE_TYPE_ENUM.join('|')})`,
          caseType
        )
      );
    } else {
      caseTypeValid = true;
    }
  }

  // 5. case_type별 추가 필수 — case_type 유효할 때만
  if (caseTypeValid) {
    const additional = ADDITIONAL_REQUIRED_BY_TYPE[caseType] || [];
    for (const field of additional) {
      if (isEmpty(caseObj[field])) {
        errors.push(
          fmt(id, field, `case_type="${caseType}"일 때 추가 필수`, caseObj[field])
        );
      }
    }
  }

  // 6a. safety_flag=true → safety_banner.{show, title, body, resources}
  if (caseObj.safety_flag === true) {
    const banner = caseObj.safety_banner;
    if (
      banner === null ||
      banner === undefined ||
      typeof banner !== 'object' ||
      Array.isArray(banner)
    ) {
      errors.push(
        fmt(id, 'safety_banner', 'safety_flag=true일 때 객체 필수', banner)
      );
    } else {
      if (typeof banner.show !== 'boolean') {
        errors.push(
          fmt(
            id,
            'safety_banner.show',
            'safety_flag=true일 때 boolean 필수',
            banner.show
          )
        );
      }
      if (isEmpty(banner.title)) {
        errors.push(
          fmt(id, 'safety_banner.title', 'safety_flag=true일 때 필수', banner.title)
        );
      }
      if (isEmpty(banner.body)) {
        errors.push(
          fmt(id, 'safety_banner.body', 'safety_flag=true일 때 필수', banner.body)
        );
      }
      if (!Array.isArray(banner.resources) || banner.resources.length === 0) {
        errors.push(
          fmt(
            id,
            'safety_banner.resources',
            'safety_flag=true일 때 1개 이상의 항목 필요',
            banner.resources
          )
        );
      }
    }
  }

  // 6b. recognition ∈ {불인정, 일부인정} → not_recognized_reasons ≥ 1
  if (
    typeof caseObj.recognition === 'string' &&
    RECOGNITION_REQUIRING_REASONS.has(caseObj.recognition)
  ) {
    if (isEmpty(caseObj.not_recognized_reasons)) {
      errors.push(
        fmt(
          id,
          'not_recognized_reasons',
          `recognition='${caseObj.recognition}'일 때 1개 이상 필요`,
          caseObj.not_recognized_reasons
        )
      );
    }
  }

  // 7. 타입 체크 기초
  if (caseObj.stage_focus !== undefined && caseObj.stage_focus !== null) {
    const sf = caseObj.stage_focus;
    if (typeof sf !== 'number' || !Number.isInteger(sf) || sf < 0 || sf > 9) {
      errors.push(fmt(id, 'stage_focus', '숫자 0~9이어야 함', sf));
    }
  }
  if (caseObj.applies_to !== undefined && caseObj.applies_to !== null) {
    if (!Array.isArray(caseObj.applies_to)) {
      errors.push(fmt(id, 'applies_to', '배열이어야 함', caseObj.applies_to));
    }
  }
  if (caseObj.safety_flag !== undefined && caseObj.safety_flag !== null) {
    if (typeof caseObj.safety_flag !== 'boolean') {
      errors.push(fmt(id, 'safety_flag', 'boolean 타입 필요', caseObj.safety_flag));
    }
  }

  return { ok: errors.length === 0, errors };
}
