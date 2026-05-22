// Vercel Node Function — /api/suggestKeywords
//
// 학생의 자유 텍스트 → 다음 화면에서 다중 선택할 후보 키워드 12~16개 (Haiku).
// 세션 21 (W2-B): 기존 하드코딩 KEYWORD_RULES 가 학폭 편향이라
// *관계·감정·상황·단계* 같은 카테고리를 LLM 으로 보강한다.
//
// 요청: POST { text: string, meta?: { role?, age?, school_level? } }
// 응답: 200 OK { suggestions: [{ key, label, category }], _meta: { stage, model, usage, cache_hit } }
//
// 안전:
// - 위기 키워드 1단계 통과해도 *키워드 라벨로 위험 표현을 노출하지 않도록* 시스템 프롬프트로 차단.
// - rate limit 은 classify.js 와 별도 키네임으로 분리 (입력 단계가 다르므로).

import Anthropic from "@anthropic-ai/sdk";
import {
  buildKeywordSuggestionSystemBlocks,
  validateSuggestions,
  FALLBACK_SUGGESTIONS,
} from "../src/lib/llm/keywordSuggestion.js";
import { checkAndConsume, buildRateLimitResponse } from "../src/lib/llm/rateLimit.js";

export const config = { runtime: "nodejs" };

const MODEL = "claude-haiku-4-5";

function sendJson(res, body, status = 200, extraHeaders = {}) {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  for (const [k, v] of Object.entries(extraHeaders)) {
    res.setHeader(k, v);
  }
  res.send(JSON.stringify(body));
}

function extractClientKey(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) {
    const first = Array.isArray(xff) ? xff[0] : String(xff).split(",")[0];
    return first.trim();
  }
  return req.headers["x-real-ip"] ?? "unknown";
}

function buildUserMessage(text, meta) {
  const lines = ["[메타]"];
  if (meta?.role) lines.push(`역할: ${meta.role}`);
  if (meta?.age) lines.push(`나이: ${meta.age}`);
  if (meta?.school_level) lines.push(`학교급: ${meta.school_level}`);
  if (lines.length === 1) lines.push("(메타 없음)");
  lines.push("", "[학생 입력]", text);
  lines.push("", "이 입력을 보고 학생이 다음 화면에서 추가로 선택할 키워드 12~16개를 JSON 으로 생성하세요.");
  return lines.join("\n");
}

function extractJsonString(raw) {
  const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlock) return codeBlock[1].trim();
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first >= 0 && last > first) return raw.slice(first, last + 1);
  return raw.trim();
}

function buildFallbackResponse(reason) {
  return {
    suggestions: FALLBACK_SUGGESTIONS,
    _fallback_meta: { reason },
  };
}

async function callClaude(client, userContent) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: buildKeywordSuggestionSystemBlocks(),
    messages: [{ role: "user", content: userContent }],
  });
  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return { text, usage: response.usage };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, { error: "method_not_allowed" }, 405);
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return sendJson(res, { error: "invalid_json" }, 400);
    }
  }
  if (body == null) return sendJson(res, { error: "invalid_json" }, 400);

  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const meta = body?.meta ?? {};
  if (!text) return sendJson(res, { error: "text_required" }, 400);

  // rate limit — classify.js 와 동일 정책, 단 키네임 prefix 로 분리해 별도 한도.
  const clientKey = `kw:${extractClientKey(req)}`;
  const rl = checkAndConsume(clientKey);
  if (!rl.ok) {
    // 키워드 화면에서는 rate limit 이어도 *폴백 키워드*로 흐름 유지 (안전한 기본값).
    return sendJson(res, {
      ...buildFallbackResponse(`rate_limit:${rl.reason}`),
      _meta: { stage: "rate_limit_fallback", retry_after_sec: rl.retryAfterSec ?? 60 },
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return sendJson(res, { error: "server_misconfigured" }, 500);
  }

  const client = new Anthropic();
  let llmOut;
  try {
    llmOut = await callClaude(client, buildUserMessage(text, meta));
  } catch (err) {
    return sendJson(res, {
      ...buildFallbackResponse("llm_call_failed"),
      _meta: { stage: "llm_error", error: err?.message ?? String(err) },
    });
  }

  const cleaned = extractJsonString(llmOut.text);
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return sendJson(res, {
      ...buildFallbackResponse("json_parse_failed"),
      _meta: { stage: "parse_error", raw: llmOut.text.slice(0, 400), usage: llmOut.usage },
    });
  }

  const v = validateSuggestions(parsed);
  if (!v.ok) {
    return sendJson(res, {
      ...buildFallbackResponse(`schema_invalid:${v.reason}`),
      _meta: {
        stage: "validate_error",
        reason: v.reason,
        raw: llmOut.text.slice(0, 400),
        usage: llmOut.usage,
      },
    });
  }

  const usage = llmOut.usage ?? {};
  const cacheHit = (usage.cache_read_input_tokens ?? 0) > 0;
  return sendJson(res, {
    suggestions: parsed.suggestions,
    _meta: {
      stage: "llm_ok",
      model: MODEL,
      cache_hit: cacheHit,
      usage: {
        input_tokens: usage.input_tokens ?? 0,
        output_tokens: usage.output_tokens ?? 0,
        cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
      },
    },
  });
}
