// Vercel Edge Function — /api/classify
//
// 학생 입력 → 키워드 1단계 안전 → rate limit → LLM 호출 → 4-필드 응답.
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
} from '../src/lib/llm/systemPrompt.js';
import {
  scanSafetyKeywords,
  buildSafetyBranchResponse,
} from '../src/lib/llm/safetyKeywords.js';
import { checkAndConsume, buildRateLimitResponse } from '../src/lib/llm/rateLimit.js';

// 세션 12 (2단계) — Node runtime 으로 전환.
// 이유: @anthropic-ai/sdk v0.96.0 이 내부적으로 node:fs / node:path 를 import 하는데
// Vercel Edge Runtime 은 이 두 모듈을 미지원해 배포 실패. Node 런타임은 둘 다 지원.
// 핸들러 시그니처는 Web Fetch (Request → Response) 그대로 — Vercel 이 자동 어댑팅.
// 길 B (fetch 직접 호출로 Edge 복귀) 는 세션 13+ 후보.
export const config = { runtime: 'nodejs20.x' };

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

function validateResponse(parsed) {
  if (!parsed || typeof parsed !== 'object') return { ok: false, reason: 'not_object' };
  if (!Array.isArray(parsed.matched_case_ids)) return { ok: false, reason: 'matched_case_ids_not_array' };
  if (parsed.matched_case_ids.length > 5) return { ok: false, reason: 'too_many_matches' };
  for (const id of parsed.matched_case_ids) {
    if (typeof id !== 'string' || !ALL_CASE_IDS_SET.has(id)) {
      return { ok: false, reason: `unknown_case_id:${id}` };
    }
  }
  if (typeof parsed.friendly_response !== 'string' || parsed.friendly_response.length < 1) {
    return { ok: false, reason: 'friendly_response_invalid' };
  }
  if (!parsed.safety_signals || typeof parsed.safety_signals !== 'object') {
    return { ok: false, reason: 'safety_signals_missing' };
  }
  if (typeof parsed.safety_signals.has_safety_flag !== 'boolean') {
    return { ok: false, reason: 'safety_flag_not_boolean' };
  }
  if (
    typeof parsed.confidence !== 'number' ||
    parsed.confidence < 0 ||
    parsed.confidence > 1
  ) {
    return { ok: false, reason: 'confidence_out_of_range' };
  }
  return { ok: true };
}

function buildFallbackResponse(reason) {
  return {
    matched_case_ids: [],
    friendly_response:
      '비슷한 사례를 찾기 어려웠어요. 가까운 어른이나 1388(청소년 상담)에 직접 도움을 요청해 보세요.',
    safety_signals: { has_safety_flag: false, reason: null },
    confidence: 0,
    _fallback_meta: { reason },
  };
}

async function callClaude(client, userContent) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    system: buildCachedSystemBlocks(),
    messages: [{ role: 'user', content: userContent }],
  });
  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  return { text, usage: response.usage };
}

// LLM 출력에서 JSON 객체 추출 — 코드블록·서두/말미 텍스트 관용 처리.
function extractJsonString(raw) {
  const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlock) return codeBlock[1].trim();
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first >= 0 && last > first) return raw.slice(first, last + 1);
  return raw.trim();
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
    llmOut = await callClaude(client, buildUserMessage(text, meta));
  } catch (err) {
    return jsonResponse(
      {
        ...buildFallbackResponse('llm_call_failed'),
        _meta: { stage: 'llm_error', error: err?.message ?? String(err) },
      },
      200,
    );
  }

  const cleanedJson = extractJsonString(llmOut.text);
  let parsed;
  try {
    parsed = JSON.parse(cleanedJson);
  } catch {
    return jsonResponse(
      {
        ...buildFallbackResponse('json_parse_failed'),
        _meta: {
          stage: 'parse_error',
          raw: llmOut.text.slice(0, 400),
          usage: llmOut.usage,
        },
      },
      200,
    );
  }

  const v = validateResponse(parsed);
  if (!v.ok) {
    return jsonResponse(
      {
        ...buildFallbackResponse(`schema_invalid:${v.reason}`),
        _meta: {
          stage: 'validate_error',
          reason: v.reason,
          raw: llmOut.text.slice(0, 400),
          usage: llmOut.usage,
        },
      },
      200,
    );
  }

  const usage = llmOut.usage ?? {};
  const cacheHit = (usage.cache_read_input_tokens ?? 0) > 0;
  parsed._meta = {
    stage: 'llm_ok',
    model: MODEL,
    cache_hit: cacheHit,
    usage: {
      input_tokens: usage.input_tokens ?? 0,
      output_tokens: usage.output_tokens ?? 0,
      cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
    },
    case_pool: CASES_CONTEXT_META,
  };
  return jsonResponse(parsed);
}
