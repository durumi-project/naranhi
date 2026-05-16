// 메모리 기반 Rate Limit — 세션 10 단계.
//
// 한계: Vercel Edge Function 인스턴스 단위로 카운터가 따로 돎. 인스턴스 사이 공유 없음.
// 따라서 *분산 환경에서의 정확한 한도 강제*는 보장 안 됨. 개발·소규모 운영용.
// 세션 12에서 Upstash Redis 또는 Vercel KV 로 마이그레이션 예정.
//
// 임계값 (팀 결정, 세션 10):
//   IP/세션 단위: 분당 5회 / 시간당 30회
//   전역 일일 한도: 1,000회 (예산 폭주 차단)

const PER_KEY_MINUTE_LIMIT = 5;
const PER_KEY_HOUR_LIMIT = 30;
const GLOBAL_DAY_LIMIT = 1000;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// key -> { timestamps: number[] }
const buckets = new Map();
let globalDayBucket = { start: Date.now(), count: 0 };

function pruneAndCount(timestamps, windowMs, now) {
  let i = 0;
  while (i < timestamps.length && now - timestamps[i] > windowMs) i++;
  if (i > 0) timestamps.splice(0, i);
  return timestamps.length;
}

function resetGlobalIfNeeded(now) {
  if (now - globalDayBucket.start > DAY_MS) {
    globalDayBucket = { start: now, count: 0 };
  }
}

/**
 * 호출 가능 여부 확인. 가능하면 카운터 증가 후 ok:true.
 *
 * @param {string} key — IP 또는 세션 식별자
 * @param {number} [nowMs] — 테스트 주입용 (기본 Date.now())
 * @returns {{ ok: boolean, retryAfterSec?: number, reason?: string }}
 */
export function checkAndConsume(key, nowMs = Date.now()) {
  resetGlobalIfNeeded(nowMs);
  if (globalDayBucket.count >= GLOBAL_DAY_LIMIT) {
    const retryAfterSec = Math.ceil((globalDayBucket.start + DAY_MS - nowMs) / 1000);
    return { ok: false, retryAfterSec, reason: 'global_daily_limit' };
  }

  const bucket = buckets.get(key) ?? { timestamps: [] };
  const inHour = pruneAndCount(bucket.timestamps, HOUR_MS, nowMs);
  if (inHour >= PER_KEY_HOUR_LIMIT) {
    const oldest = bucket.timestamps[0];
    return {
      ok: false,
      retryAfterSec: Math.ceil((oldest + HOUR_MS - nowMs) / 1000),
      reason: 'per_key_hourly_limit',
    };
  }

  const minuteWindowStart = nowMs - MINUTE_MS;
  const inMinute = bucket.timestamps.filter((t) => t >= minuteWindowStart).length;
  if (inMinute >= PER_KEY_MINUTE_LIMIT) {
    const oldestInMinute = bucket.timestamps.find((t) => t >= minuteWindowStart);
    return {
      ok: false,
      retryAfterSec: Math.ceil((oldestInMinute + MINUTE_MS - nowMs) / 1000),
      reason: 'per_key_minute_limit',
    };
  }

  bucket.timestamps.push(nowMs);
  buckets.set(key, bucket);
  globalDayBucket.count += 1;
  return { ok: true };
}

/**
 * 친화 메시지 — 한도 초과 응답 본문.
 */
export function buildRateLimitResponse(reason, retryAfterSec) {
  const message =
    reason === 'global_daily_limit'
      ? '오늘 도움 요청이 너무 많아 잠시 멈췄어요. 내일 다시 도와드릴게요.'
      : '잠깐만 기다려 주세요. 잠시 후 다시 시도해 주세요.';
  return {
    matched_case_ids: [],
    friendly_response: message,
    safety_signals: { has_safety_flag: false, reason: null },
    confidence: 0,
    _rate_limit_meta: { reason, retry_after_sec: retryAfterSec },
  };
}

// 테스트 보조 — 메모리 초기화. 운영 코드에서 호출 금지.
export function _resetForTests() {
  buckets.clear();
  globalDayBucket = { start: Date.now(), count: 0 };
}

export const LIMITS = {
  PER_KEY_MINUTE_LIMIT,
  PER_KEY_HOUR_LIMIT,
  GLOBAL_DAY_LIMIT,
};
