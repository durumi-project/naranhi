// 일회성 스크립트 — src/data/cases.json 10건을 개별 파일로 분리.
// C-2 단계용. 데이터 변경 없음 — 그대로 복사.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');

const cases = JSON.parse(
  readFileSync(resolve(repoRoot, 'src/data/cases.json'), 'utf8')
);

const targetDir = resolve(repoRoot, 'src/data/cases/REVIEWED');

for (const c of cases) {
  const filePath = resolve(targetDir, `${c.case_id}.json`);
  writeFileSync(filePath, JSON.stringify(c, null, 2) + '\n', 'utf8');
  console.log(`  ✓ ${filePath}`);
}
console.log(`총 ${cases.length}건 분리 완료.`);
