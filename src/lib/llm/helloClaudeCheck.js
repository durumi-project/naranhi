// 「나란히」 — M2 LLM 통합 최소 동작 체크
//
// 목적: Anthropic SDK가 .env.local의 ANTHROPIC_API_KEY로 정상 호출되는지 확인.
// 호출: npm run llm:check  (또는 node src/lib/llm/helloClaudeCheck.js)
//
// 보안: API 키는 .env.local 에서만 읽고, 코드·로그·커밋 메시지에 *절대* 노출 금지.

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

// .env.local을 프로젝트 루트 기준으로 명시 로드 (dotenv 기본은 .env만 읽음)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../..');
dotenv.config({ path: path.join(projectRoot, '.env.local') });

// Haiku 4.5 단가 ($/MTok). Anthropic 공식 가격 페이지 기준, 변경 시 갱신.
const PRICING = {
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
};

const MODEL = 'claude-haiku-4-5';

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY가 환경에 없음.');
    console.error('   .env.local 파일을 확인하세요. (.env.example 참고)');
    process.exit(1);
  }

  const client = new Anthropic();

  console.log(`🌱 「나란히」 LLM 최소 동작 체크`);
  console.log(`   모델: ${MODEL}`);
  console.log(`   호출 중...\n`);

  const start = Date.now();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: 'Hello, 나란히. 한국 학교폭력 안내 플랫폼이 너에게 첫 인사를 보냅니다. 한 문장으로 짧게 화답해 주세요.',
      },
    ],
  });
  const elapsedMs = Date.now() - start;

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');

  console.log(`📩 응답:\n   ${text}\n`);

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const price = PRICING[MODEL];
  const costUsd =
    (inputTokens / 1_000_000) * price.input +
    (outputTokens / 1_000_000) * price.output;

  console.log(`📊 사용 토큰`);
  console.log(`   입력:  ${inputTokens} tok`);
  console.log(`   출력:  ${outputTokens} tok`);
  console.log(`   합계:  ${inputTokens + outputTokens} tok`);
  console.log(`\n💰 비용 추산`);
  console.log(`   이번 호출: $${costUsd.toFixed(6)} (약 ${(costUsd * 1380).toFixed(3)}원)`);
  console.log(`   ※ Haiku 4.5 기준: input $${price.input}/MTok · output $${price.output}/MTok`);
  console.log(`\n⏱  소요 시간: ${elapsedMs} ms`);
  console.log(`\n✅ LLM 통합 최소 동작 확인 — M2 진입 OK`);
}

main().catch((err) => {
  console.error('❌ 호출 실패');
  console.error(`   ${err.message ?? err}`);
  if (err.status) console.error(`   HTTP ${err.status}`);
  process.exit(1);
});
