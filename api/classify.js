// Vercel Serverless Function — /api/classify
//
// 세션 13 — tool_use 도입.
// 변경:
//   - JSON 파싱·extractJsonString·코드블록 처리 일체 제거.
//   - Anthropic Messages API 의 tools + tool_choice 로 응답 스키마 강제.
//   - tool_use 블록의 input 을 *그대로* 응답 객체로 사용 → parse_error 원천 차단.
//   - 폴백은 *llm_call_failed* (네트워크·5xx) 와 *tool_use_missing*(SDK가 stop_reason 만 반환하는 극단 케이스) 두 자리만.
//
// 학생 입력 → 키워드 1단계 안전 → rate limit → LLM tool_use → 4-필드 응답.
// 설계 문서: docs/llm_integration_design.md §3-3 (응답 스키마) + §6-2 (rate limit)
//
// 요청: POST { text: string, meta?: { role?, age?, school_level? } }
// 응답: 200 OK
//   {
//     matched_case_ids: string[],
//     friendly_response: string,
//     safety_signals: { has_safety_flag, reason },
//     confidence: number,
//     _meta: { stage, model, usage, cache_hit }
//   }

import Anthropic from '@anthropic-ai/sdk';
import {
  buildCachedSystemBlocks,
  ALL_CASE_IDS,
  CASES_CONTEXT_META,
  NARANGI_RESPONSE_TOOL,
} from '../src/lib/llm/systemPrompt.js';
import {
  scanSafetyKeywords,
  buildSafetyBranchResponse,
} from '../src/lib/llm/safetyKeywords.js';
import { checkAndConsume, buildRateLimitResponse } from '../src/lib/llm/rateLimit.js';

// 세션 12 (2단계+3단계) — Node runtime.
// 이유: @anthropic-ai/sdk v0.96.0 이 node:fs / node:path 를 내부 import → Edge 미지원.
// Node 버전 지정은 Vercel 기본 또는 package.json engines.node 별도.
export const config = { runtime: 'nodejs' };

const MODEL = 'claude-haiku-4-5';
const ALL_CASE_IDS_SET = new Set(ALL_CASE_IDS);

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function extractClientKey(request) {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

function buildUserMessage(text, meta) {
  const lines = ['[메타]'];
  if (meta?.role) lines.push(`역할: ${meta.role}`);
  if (meta?.age) lines.push(`나이: ${meta.age}`);
  if (meta?.school_level) lines.push(`학교급: ${meta.school_level}`);
  if (lines.length === 1) lines.push('(메타 없음)');
  lines.push('', '[상황]', text);
  return lines.join('\n');
}

// tool_use 가 input_schema 를 강제하지만, 다음 자리는 모델이 어길 수 있어 *서버측 보강 검증*:
//   1. matched_case_ids 가 실재 case_id 인지 (모델이 hallucinate 한 ID 차단)
//   2. friendly_response 가 빈 문자열인지 (UI 빈 카드 차단)
//   3. safety_signals 누락 → 기본값 채움 (친화 응답이 살아 있는데 폴백으로 떨어지지 않게)
//   4. confidence 누락·invalid → 기본 0.7 (e2e 실측: required 필드도 가끔 누락됨)
//
// 정책: *상황 정리 텍스트가 살아 있으면 통과* — 두 자리(1·2) 위반 시만 폴백.
function validateAndNormaliseToolInput(input) {
  if (!input || typeof input !== 'object') return { ok: false, reason: 'not_object' };
  if (!Array.isArray(input.matched_case_ids)) return { ok: false, reason: 'matched_case_ids_not_array' };
  for (const id of input.matched_case_ids) {
    if (typeof id !== 'string' || !ALL_CASE_IDS_SET.has(id)) {
      return { ok: false, reason: `unknown_case_id:${id}` };
    }
  }
  if (typeof input.friendly_response !== 'string' || input.friendly_response.trim().length === 0) {
    return { ok: false, reason: 'friendly_response_empty' };
  }

  const defaulted = [];
  let safetySignals = input.safety_signals;
  if (!safetySignals || typeof safetySignals !== 'object' || typeof safetySignals.has_safety_flag !== 'boolean') {
    safetySignals = { has_safety_flag: false, reason: null };
    defaulted.push('safety_signals');
  } else if (!('reason' in safetySignals)) {
    safetySignals = { ...safetySignals, reason: safetySignals.has_safety_flag ? '미상' : null };
    defaulted.push('safety_signals.reason');
  }

  let confidence = input.confidence;
  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1 || Number.isNaN(confidence)) {
    confidence = 0.7;
    defaulted.push('confidence');
  }

  return {
    ok: true,
    normalised: {
      matched_case_ids: input.matched_case_ids,
      friendly_response: input.friendly_response,
      safety_signals: safetySignals,
      confidence,
    },
    defaulted,
  };
}

function buildFallbackResponse(reason) {
  return {
    matched_case_ids: [],
    friendly_response:
      '분석 도우미가 잠시 쉬고 있어요. 아래 비슷한 사례를 참고해 보세요. 직접 도움이 필요하면 1388(청소년 상담) 또는 사단법인 두루에 연락해 보세요.',
    safety_signals: { has_safety_flag: false, reason: null },
    confidence: 0,
    _fallback_meta: { reason },
  };
}

async function callClaudeWithTool(client, userContent) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    system: buildCachedSystemBlocks(),
    tools: [NARANGI_RESPONSE_TOOL],
    tool_choice: { type: 'tool', name: NARANGI_RESPONSE_TOOL.name },
    messages: [{ role: 'user', content: userContent }],
  });
  const toolUse = response.content.find((b) => b.type === 'tool_use' && b.name === NARANGI_RESPONSE_TOOL.name);
  return {
    toolUse,
    usage: response.usage,
    stopReason: response.stop_reason,
  };
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  const meta = body?.meta ?? {};
  if (!text) return jsonResponse({ error: 'text_required' }, 400);

  // 1단계 — 키워드 안전 분기 (LLM 호출 전, rate limit 카운터 미증가)
  const scan = scanSafetyKeywords(text);
  if (scan.triggered) {
    const safeBody = buildSafetyBranchResponse(scan);
    safeBody._meta = { stage: 'safety_keyword_pre_llm', case_pool: CASES_CONTEXT_META };
    return jsonResponse(safeBody);
  }

  // Rate limit
  const clientKey = extractClientKey(request);
  const rl = checkAndConsume(clientKey);
  if (!rl.ok) {
    const rlBody = buildRateLimitResponse(rl.reason, rl.retryAfterSec);
    return new Response(JSON.stringify(rlBody), {
      status: 429,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'retry-after': String(rl.retryAfterSec ?? 60),
      },
    });
  }

  // LLM 호출
  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'server_misconfigured' }, 500);
  }

  const client = new Anthropic();
  let llmOut;
  try {
    llmOut = await callClaudeWithTool(client, buildUserMessage(text, meta));
  } catch (err) {
    return jsonResponse(
      {
        ...buildFallbackResponse('llm_call_failed'),
        _meta: { stage: 'llm_error', error: err?.message ?? String(err) },
      },
      200,
    );
  }

  if (!llmOut.toolUse) {
    return jsonResponse(
      {
        ...buildFallbackResponse('tool_use_missing'),
        _meta: {
          stage: 'tool_use_missing',
          stop_reason: llmOut.stopReason,
          usage: llmOut.usage,
        },
      },
      200,
    );
  }

  const v = validateAndNormaliseToolInput(llmOut.toolUse.input);
  if (!v.ok) {
    return jsonResponse(
      {
        ...buildFallbackResponse(`schema_invalid:${v.reason}`),
        _meta: {
          stage: 'validate_error',
          reason: v.reason,
          usage: llmOut.usage,
        },
      },
      200,
    );
  }

  const usage = llmOut.usage ?? {};
  const cacheHit = (usage.cache_read_input_tokens ?? 0) > 0;
  const result = {
    ...v.normalised,
    _meta: {
      stage: 'llm_ok',
      model: MODEL,
      cache_hit: cacheHit,
      defaulted_fields: v.defaulted,
      usage: {
        input_tokens: usage.input_tokens ?? 0,
        output_tokens: usage.output_tokens ?? 0,
        cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
      },
      case_pool: CASES_CONTEXT_META,
    },
  };
  return jsonResponse(result);
}
