// 프런트엔드 → 백엔드 /api/classify 호출 래퍼.
//
// 사용처: src/App.jsx Step 2 → Step 3 사이.
// 책임:
//   1. POST /api/classify 비동기 호출 (AbortSignal timeout 12초)
//   2. 네트워크·5xx·timeout → 친화 폴백 객체 반환 (예외 throw 안 함)
//   3. 응답 4-필드 1차 검증 (서버 검증과 이중 방어)
//   4. confidence < 0.5 → ui_low_confidence_notice 플래그 부여
//
// 호출자(App.jsx)는 *항상 객체*를 받는다고 가정 — 예외 처리 부담 없음.

import { FALLBACK_SUGGESTIONS, FALLBACK_STAGES } from './keywordSuggestion.js';

const DEFAULT_TIMEOUT_MS = 12000;

export const CLIENT_STAGE = {
  LLM_OK: 'llm_ok',
  SAFETY_KEYWORD: 'safety_keyword_pre_llm',
  TIMEOUT: 'client_timeout',
  NETWORK_ERROR: 'client_network_error',
  HTTP_ERROR: 'client_http_error',
  SCHEMA_INVALID: 'client_schema_invalid',
  RATE_LIMITED: 'client_rate_limited',
};

function buildClientFallback(stage, extra = {}) {
  return {
    matched_case_ids: [],
    friendly_response:
      '지금은 비슷한 사례를 찾기 어려웠어요. 잠시 후 다시 시도해 보거나, 1388(청소년 상담)에 직접 도움을 요청해 보세요.',
    safety_signals: { has_safety_flag: false, reason: null },
    confidence: 0,
    ui_low_confidence_notice: true,
    _client_meta: { stage, ...extra },
  };
}

function shallowValidateShape(parsed) {
  if (!parsed || typeof parsed !== 'object') return false;
  if (!Array.isArray(parsed.matched_case_ids)) return false;
  if (typeof parsed.friendly_response !== 'string') return false;
  if (!parsed.safety_signals || typeof parsed.safety_signals.has_safety_flag !== 'boolean') return false;
  if (typeof parsed.confidence !== 'number') return false;
  return true;
}

/**
 * 백엔드 /api/classify 호출.
 *
 * @param {{ text: string, meta?: { role?: string, age?: string, school_level?: string } }} args
 * @param {{ timeoutMs?: number, fetchImpl?: typeof fetch, endpoint?: string }} [opts]
 * @returns {Promise<object>} 4-필드 응답 (실패 시 폴백 객체)
 */
export async function callClassify({ text, meta }, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const endpoint = opts.endpoint ?? '/api/classify';

  if (!fetchImpl) {
    return buildClientFallback(CLIENT_STAGE.NETWORK_ERROR, { reason: 'fetch_unavailable' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, meta: meta ?? {} }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const aborted = err?.name === 'AbortError';
    return buildClientFallback(
      aborted ? CLIENT_STAGE.TIMEOUT : CLIENT_STAGE.NETWORK_ERROR,
      { message: err?.message ?? String(err) },
    );
  }
  clearTimeout(timer);

  if (response.status === 429) {
    let body = null;
    try { body = await response.json(); } catch { /* ignore */ }
    return {
      ...buildClientFallback(CLIENT_STAGE.RATE_LIMITED, { retry_after: response.headers.get('retry-after') }),
      friendly_response:
        body?.friendly_response ??
        '잠시 후 다시 시도해 주세요. 너무 자주 호출하면 안전을 위해 잠깐 멈춰요.',
    };
  }

  if (!response.ok) {
    return buildClientFallback(CLIENT_STAGE.HTTP_ERROR, { http_status: response.status });
  }

  let parsed;
  try {
    parsed = await response.json();
  } catch (err) {
    return buildClientFallback(CLIENT_STAGE.HTTP_ERROR, { reason: 'json_parse_failed' });
  }

  if (!shallowValidateShape(parsed)) {
    return buildClientFallback(CLIENT_STAGE.SCHEMA_INVALID, { keys: Object.keys(parsed ?? {}) });
  }

  if (parsed.confidence < 0.5 && !parsed.safety_signals.has_safety_flag) {
    parsed.ui_low_confidence_notice = true;
  }
  return parsed;
}

/**
 * 백엔드 /api/suggestKeywords 호출 — 학생 입력 직후 후보 키워드 12~16개 생성.
 *
 * 세션 21 (W2-B). 실패 시 *FALLBACK_SUGGESTIONS* 로 폴백한 응답 객체가 반환되므로
 * 호출자는 항상 `suggestions` 키를 가진 객체를 받을 수 있다 (예외 throw 안 함).
 *
 * @param {{ text: string, meta?: object }} args
 * @param {{ timeoutMs?: number, fetchImpl?: typeof fetch, endpoint?: string }} [opts]
 * @returns {Promise<{ suggestions: Array<{key: string, label: string, category: string}>, _meta?: object, _fallback_meta?: object }>}
 */
export async function callSuggestKeywords({ text, meta }, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 8000;
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const endpoint = opts.endpoint ?? '/api/suggestKeywords';

  const fallback = (reason, extra = {}) => ({
    suggestions: FALLBACK_SUGGESTIONS,
    stages: FALLBACK_STAGES,
    _client_meta: { stage: 'client_fallback', reason, ...extra },
  });

  if (!fetchImpl) return fallback('fetch_unavailable');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, meta: meta ?? {} }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    return fallback(err?.name === 'AbortError' ? 'timeout' : 'network_error', { message: err?.message ?? String(err) });
  }
  clearTimeout(timer);

  if (!response.ok) return fallback(`http_${response.status}`);

  let parsed;
  try {
    parsed = await response.json();
  } catch {
    return fallback('json_parse_failed');
  }

  if (!parsed || !Array.isArray(parsed.suggestions) || parsed.suggestions.length === 0) {
    return fallback('empty_suggestions');
  }
  // W5 — 서버가 stages 누락한 경우에도 클라이언트에서 폴백 보정.
  if (!Array.isArray(parsed.stages) || parsed.stages.length === 0) {
    parsed.stages = FALLBACK_STAGES;
  }
  return parsed;
}

/**
 * LLM 매칭 결과(case_ids)를 CASES 배열의 객체로 펼치고 _scores를 가짜로 부여.
 * 기존 CaseCard / matchCases 시그니처와 호환되도록 어댑팅.
 *
 * @param {string[]} ids
 * @param {Array} allCases
 * @returns {Array} 우선순위 순. 알 수 없는 ID는 건너뜀.
 */
export function expandMatchedCaseIds(ids, allCases) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const byId = new Map(allCases.map((c) => [c.case_id, c]));
  const result = [];
  ids.forEach((id, idx) => {
    const c = byId.get(id);
    if (!c) return;
    const rank = ids.length === 1 ? 1.0 : 1 - idx / Math.max(ids.length, 1) * 0.3;
    result.push({
      ...c,
      _scores: {
        text_similarity: Math.round(rank * 100) / 100,
        code_match: rank,
        final: Math.round(rank * 1000) / 1000,
      },
      _llm_matched: true,
    });
  });
  return result;
}
