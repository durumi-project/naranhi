// 사례 71건을 LLM 시스템 프롬프트용 정적 문자열로 빌드.
//
// 실행: node scripts/buildCasesContext.mjs
// 출력: src/lib/llm/casesContext.generated.js
//
// Vercel Edge Runtime은 fs 미지원이라 *빌드 타임*에 정적 데이터를 만들어 둠.
// 사례 추가·수정 시 이 스크립트를 다시 실행해 generated 파일을 갱신해야 함.

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const PENDING_DIR = path.join(projectRoot, 'src/data/cases/PENDING');
const REVIEWED_DIR = path.join(projectRoot, 'src/data/cases/REVIEWED');
const OUT_PATH = path.join(projectRoot, 'src/lib/llm/casesContext.generated.js');

function loadCasesFrom(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8')));
}

function summariseCase(c) {
  const sub = (c.subtypes ?? []).filter(Boolean).join(',');
  const apply = (c.applies_to ?? []).slice(0, 6).join(',');
  const factors = (c.key_factors ?? []).slice(0, 4).join(' / ');
  const recognition = c.recognition ?? '';
  const disposition = c.disposition_summary ?? '';
  const safety = c.safety_flag ? ' ⚠️safety' : '';
  return [
    `── ${c.case_id} (${c.case_type})${safety} ──`,
    `분류: type=${c.type_main}${sub ? `+${sub}` : ''} / role=${c.role_focus} / stage=${c.stage_focus} / school=${c.school_level}`,
    apply ? `매칭: ${apply}` : null,
    `제목: ${c.friendly_title ?? ''}`,
    `요약: ${(c.friendly_summary ?? '').replace(/\s+/g, ' ').trim()}`,
    factors ? `핵심: ${factors}` : null,
    recognition ? `인정: ${recognition}` : null,
    disposition ? `처분: ${disposition}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function main() {
  const reviewed = loadCasesFrom(REVIEWED_DIR);
  const pending = loadCasesFrom(PENDING_DIR);
  const all = [...reviewed, ...pending];

  const header = `// 자동 생성됨 — scripts/buildCasesContext.mjs 가 src/data/cases/{REVIEWED,PENDING} 을 읽어 만듦.
// 직접 편집하지 말 것. 사례 변경 시: node scripts/buildCasesContext.mjs

`;

  const idArrayLiteral = JSON.stringify(
    all.map((c) => c.case_id),
    null,
    2
  );

  const casesText = all.map(summariseCase).join('\n\n');

  const body = `export const CASES_CONTEXT_TEXT = ${JSON.stringify(casesText)};

export const ALL_CASE_IDS = ${idArrayLiteral};

export const CASES_CONTEXT_META = {
  total: ${all.length},
  reviewed: ${reviewed.length},
  pending: ${pending.length},
  generated_at: ${JSON.stringify(new Date().toISOString())},
  estimated_chars: ${casesText.length},
};
`;

  mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, header + body, 'utf8');

  console.log(`✓ 사례 ${all.length}건 → ${path.relative(projectRoot, OUT_PATH)}`);
  console.log(`  REVIEWED ${reviewed.length} + PENDING ${pending.length}`);
  console.log(`  문자 수: ${casesText.length.toLocaleString()}`);
  console.log(`  추정 토큰: ~${Math.round(casesText.length / 2.3).toLocaleString()} tok (한글 약 2.3 char/tok)`);
}

main();
